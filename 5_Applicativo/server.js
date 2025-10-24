// server.js - AGGIORNATO per tempo reale
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const db = require('./db.js');
const chat = require('./peer.js');
const rsa = require('./rsa_encrypt.js');
const networkDiscovery = require('./network_discovery.js');
const { deduplicatePeers } = require('./utils.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let currentUser = null;
let isSystemInitialized = false;

// Middleware per verificare se l'utente è autenticato
function requireAuth(req, res, next) {
    if (!currentUser) {
        return res.redirect('/login');
    }
    next();
}

// Middleware per passare user a tutte le view
app.use((req, res, next) => {
    res.locals.user = currentUser;
    next();
});

// 🏠 Home page - Chat di GRUPPO (solo messaggi broadcast)
app.get('/', requireAuth, async (req, res) => {
    try {
        const messages = await db.getGroupMessages();
        let peers = await networkDiscovery.getDiscoveredPeers();
        const connectedPeers = chat.getConnectedPeers();
        
        peers = peers.map(peer => {
            const isConnected = connectedPeers.some(connected => 
                connected.address === peer.ip && connected.port === peer.port
            );
            return {
                ...peer,
                isConnected: isConnected
            };
        });

        res.render('chat-group', {
            user: currentUser,
            messages: messages.reverse(),
            peers: peers,
            currentPage: 'group'
        });
    } catch (error) {
        console.error('Errore nel caricamento chat di gruppo:', error);
        res.status(500).render('error', { error: 'Errore nel caricamento della chat di gruppo' });
    }
});

// 💬 Chat PRIVATA con peer specifico
app.get('/chat/:peerId', requireAuth, async (req, res) => {
    try {
        const peerId = req.params.peerId;
        const [peerIp, peerPort] = peerId.split(':');
        
        const messages = await db.getPrivateMessages(currentUser.username, peerId);
        let peers = await networkDiscovery.getDiscoveredPeers();
        const connectedPeers = chat.getConnectedPeers();
        
        peers = peers.map(peer => {
            const isConnected = connectedPeers.some(connected => 
                connected.address === peer.ip && connected.port === peer.port
            );
            return {
                ...peer,
                isConnected: isConnected
            };
        });

        const currentPeer = peers.find(p => 
            p.ip === peerIp && p.port === (parseInt(peerPort) || 50000)
        );

        if (!currentPeer) {
            return res.status(404).render('error', { 
                error: 'Peer non trovato',
                currentPage: 'chat'
            });
        }

        res.render('chat-private', {
            user: currentUser,
            messages: messages.reverse(),
            peers: peers,
            currentPeer: currentPeer,
            currentPage: 'private'
        });
    } catch (error) {
        console.error('Errore nel caricamento chat privata:', error);
        res.status(500).render('error', { error: 'Errore nel caricamento della chat privata' });
    }
});

// 🔐 Pagina di login/registrazione
app.get('/login', (req, res) => {
    res.render('login', { currentPage: 'login' });
});

// 📋 Lista peer
app.get('/peers', requireAuth, async (req, res) => {
    try {
        let peers = await networkDiscovery.getDiscoveredPeers();
        const connectedPeers = chat.getConnectedPeers();
        
        peers = await Promise.all(peers.map(async peer => {
            const isConnected = connectedPeers.some(connected => 
                connected.address === peer.ip && connected.port === peer.port
            );
            
            const messages = await db.getPrivateMessages(currentUser.username, `${peer.ip}:${peer.port}`);
            
            return {
                ...peer,
                isConnected: isConnected,
                messageCount: messages.length,
                lastMessage: messages.length > 0 ? 
                    new Date(messages[0].timestamp).toLocaleString() : 'Mai'
            };
        }));

        res.render('peers', {
            user: currentUser,
            peers: peers,
            currentPage: 'peers'
        });
    } catch (error) {
        res.status(500).render('error', { error: 'Errore nel caricamento peer' });
    }
});

// ⚙️ Impostazioni
app.get('/settings', requireAuth, (req, res) => {
    res.render('settings', { 
        user: currentUser,
        currentPage: 'settings'
    });
});

// 🔍 API per scansione rete
app.post('/api/scan-network', requireAuth, async (req, res) => {
    try {
        await networkDiscovery.manualScan();
        res.json({ success: true, message: 'Scansione avviata' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 🔗 API per connettersi manualmente a un peer
app.post('/api/connect-peer', requireAuth, async (req, res) => {
    try {
        const { ip } = req.body;
        await chat.connectToPeer(ip, (message) => {
            // Invia notifica via WebSocket
            io.emit('system-notification', { 
                type: 'connection', 
                message: message,
                timestamp: new Date() 
            });
        }, currentUser);
        res.json({ success: true, message: 'Connessione avviata' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 🔌 API per disconnettersi da un peer
app.post('/api/disconnect-peer', requireAuth, async (req, res) => {
    try {
        const { peerAddress } = req.body;
        const success = chat.disconnectFromPeer(peerAddress);
        res.json({ success: success, message: success ? 'Disconnesso' : 'Peer non trovato' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 💬 API per inviare messaggi di GRUPPO (broadcast)
app.post('/api/send-group-message', requireAuth, async (req, res) => {
    try {
        const { message } = req.body;
        const results = await chat.sendGroupMessage(message, currentUser);
        
        // Invia il messaggio a tutti i client nella chat di gruppo
        io.emit('new-group-message', {
            id: Date.now(), // ID unico per il messaggio
            sender: currentUser.username,
            message: message,
            timestamp: new Date(),
            direction: 'outgoing',
            type: 'group'
        });
        
        res.json({ success: true, results: results });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 💬 API per inviare messaggi PRIVATI
app.post('/api/send-private-message', requireAuth, async (req, res) => {
    try {
        const { message, peerAddress } = req.body;
        
        const result = await chat.sendPrivateMessage(peerAddress, message, currentUser);
        
        // Invia il messaggio via socket per l'aggiornamento in tempo reale
        io.emit('new-private-message', {
            id: Date.now(), // ID unico per il messaggio
            sender: currentUser.username,
            message: message,
            timestamp: new Date(),
            direction: 'outgoing',
            peerAddress: peerAddress,
            type: 'private'
        });
        
        res.json({ success: true, result: result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 👥 API per lista peer
app.get('/api/peers', requireAuth, async (req, res) => {
    try {
        let peers = await networkDiscovery.getDiscoveredPeers();
        const connectedPeers = chat.getConnectedPeers();
        
        peers = peers.map(peer => {
            const isConnected = connectedPeers.some(connected => 
                connected.address === peer.ip && connected.port === peer.port
            );
            return {
                ...peer,
                isConnected: isConnected
            };
        });
        
        res.json({ success: true, peers: peers });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 💬 API per messaggi di gruppo
app.get('/api/group-messages', requireAuth, async (req, res) => {
    try {
        const messages = await db.getGroupMessages();
        res.json({ success: true, messages: messages.reverse() });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 💬 API per messaggi privati con un peer
app.get('/api/private-messages/:peerId', requireAuth, async (req, res) => {
    try {
        const peerId = req.params.peerId;
        const messages = await db.getPrivateMessages(currentUser.username, peerId);
        res.json({ success: true, messages: messages.reverse() });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 🔐 API per autenticazione
app.post('/api/login', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.json({ success: false, error: 'Username richiesto' });
        }

        let user = await db.getUser();
        
        if (!user) {
            console.log("🔑 Generazione chiavi crittografiche...");
            const key = rsa.generateKeys();
            user = await db.createUser(username, key.publicKey, key.privateKey);
        } else if (user.username !== username) {
            return res.json({ success: false, error: 'Username non corrispondente' });
        }

        currentUser = user;
        
        if (!isSystemInitialized) {
            await initializeSystem(user);
        }
        
        res.json({ success: true, user: user });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Inizializza il sistema
async function initializeSystem(user) {
    try {
        console.log("🔄 Inizializzazione database...");
        await db.initialize();
        
        console.log("🌐 Avvio servizio di discovery...");
        await networkDiscovery.initialize(user);
        
        console.log("🎧 Avvio server chat...");
        chat.startServer(handleIncomingMessage, user);
        
        isSystemInitialized = true;
        console.log("✅ Sistema inizializzato correttamente");
    } catch (error) {
        console.error('❌ Errore inizializzazione sistema:', error);
    }
}

// 🎯 Gestione messaggi in arrivo dal modulo peer
function handleIncomingMessage(message, peerInfo, chatType) {
    console.log(`📨 Messaggio in arrivo [${chatType}]: ${message}`);
    
    // Estrai il contenuto reale del messaggio (rimuovi prefissi)
    let cleanMessage = message;
    if (message.includes(' dice: ')) {
        cleanMessage = message.split(' dice: ')[1];
    }
    
    if (chatType === 'group') {
        // Invia a tutti i client nella chat di gruppo
        io.emit('new-group-message', {
            id: Date.now(),
            sender: peerInfo.username || peerInfo.address,
            message: cleanMessage,
            timestamp: new Date(),
            direction: 'incoming',
            type: 'group'
        });
    } else {
        // Invia solo ai client interessati alla chat privata
        const peerAddress = `${peerInfo.address}:${peerInfo.port}`;
        io.emit('new-private-message', {
            id: Date.now(),
            sender: peerInfo.username || peerInfo.address,
            message: cleanMessage,
            timestamp: new Date(),
            direction: 'incoming',
            peerAddress: peerAddress,
            type: 'private'
        });
    }
    
    // Notifica di sistema
    io.emit('system-notification', {
        type: 'new_message',
        message: `Nuovo messaggio da ${peerInfo.username || peerInfo.address}`,
        timestamp: new Date()
    });
}

// Gestione WebSocket per messaggi in tempo reale
io.on('connection', (socket) => {
    console.log('👤 Nuovo client connesso:', socket.id);
    
    // Unisciti alla chat di gruppo
    socket.on('join-group', () => {
        socket.join('group-chat');
        console.log(`👤 Client ${socket.id} joined group chat`);
    });
    
    // Unisciti a una chat privata
    socket.on('join-private', (peerId) => {
        socket.join(`private-${peerId}`);
        console.log(`👤 Client ${socket.id} joined private chat: ${peerId}`);
    });
    
    // Richiesta di aggiornamento lista peer
    socket.on('request-peers-update', () => {
        updateConnectedPeers();
    });
    
    socket.on('disconnect', () => {
        console.log('👤 Client disconnesso:', socket.id);
    });
});

// 🔄 Funzione per aggiornare la lista peer connessi
async function updateConnectedPeers() {
    try {
        let peers = await networkDiscovery.getDiscoveredPeers();
        const connectedPeers = chat.getConnectedPeers();
        
        peers = peers.map(peer => {
            const isConnected = connectedPeers.some(connected => 
                connected.address === peer.ip && connected.port === peer.port
            );
            return {
                ...peer,
                isConnected: isConnected
            };
        });
        
        io.emit('peers-updated', { peers: peers });
    } catch (error) {
        console.error('Errore aggiornamento peer:', error);
    }
}

// Avvio server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`🚀 Server avviato su http://localhost:${PORT}`);
    
    try {
        await db.initialize();
        console.log('✅ Database inizializzato');
    } catch (error) {
        console.error('❌ Errore inizializzazione database:', error);
    }
});

// Gestione chiusura pulita
process.on('SIGINT', async () => {
    console.log('👋 Chiusura applicazione...');
    
    if (currentUser) {
        console.log('🔄 Chiusura connessioni...');
        chat.closeAll();
        
        console.log('🔍 Fermando servizio discovery...');
        networkDiscovery.stop();
        
        console.log('💾 Chiusura database...');
        await db.close();
    }
    
    process.exit(0);
});
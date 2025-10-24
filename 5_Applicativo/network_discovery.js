// network_discovery.js - AGGIORNATO per connessione automatica
const db = require('./db.js');
const dgram = require('dgram');
const { normalizeIP } = require('./utils.js');
const chat = require('./peer.js'); // Importa il modulo chat

class NetworkDiscovery {
    constructor() {
        this.multicastGroup = '224.0.0.114';
        this.multicastPort = 50001;
        this.announceInterval = 30000;
        this.autoConnectInterval = 10000; // 10 secondi
        this.socket = null;
        this.isRunning = false;
        this.user = null;
    }

    async initialize(user) {
        this.user = user;
        await this.startMulticastListener();
        this.startAnnouncement();
        this.startAutoConnect();
    }

    // 🎧 Avvia l'ascolto multicast per scoperta peer
    async startMulticastListener() {
        this.socket = dgram.createSocket('udp4');
        
        this.socket.on('message', async (msg, rinfo) => {
            try {
                const message = JSON.parse(msg.toString());
                
                // Ignora i propri messaggi
                if (message.username === this.user.username) return;

                switch (message.type) {
                    case 'announce':
                        await this.handlePeerAnnounce(message, rinfo);
                        break;
                    case 'peer_exchange':
                        await this.handlePeerExchange(message, rinfo);
                        break;
                }
            } catch (error) {
                console.error('Errore nel processamento messaggio multicast:', error);
            }
        });

        this.socket.on('listening', () => {
            this.socket.addMembership(this.multicastGroup);
            console.log(`🔍 Multicast listener avviato su ${this.multicastGroup}:${this.multicastPort}`);
        });

        this.socket.bind(this.multicastPort);
        this.isRunning = true;
    }

    // 📢 Annuncia la propria presenza nella rete
    startAnnouncement() {
        // Annuncio immediato
        this.announcePresence();
        
        // Annuncio periodico
        this.announceTimer = setInterval(() => {
            this.announcePresence();
        }, this.announceInterval);
    }

    // 🔄 Connessione automatica ai peer
    startAutoConnect() {
        this.autoConnectTimer = setInterval(async () => {
            await this.autoConnectToPeers();
        }, this.autoConnectInterval);
    }

    async autoConnectToPeers() {
        if (!this.isRunning || !this.user) return;

        try {
            const peers = await db.getAllPeers();
            const connectedPeers = await chat.getConnectedPeers();
            
            for (const peer of peers) {
                // Non connetterti a te stesso
                if (peer.username === this.user.username) continue;
                
                // Verifica se già connesso
                const isConnected = connectedPeers.some(connected => 
                    connected.address === peer.ip && connected.port === peer.port
                );
                
                if (!isConnected) {
                    console.log(`🔗 Tentativo di connessione automatica a ${peer.username} (${peer.ip}:${peer.port})`);
                    await this.connectToPeer(peer.ip, peer.port);
                }
            }
        } catch (error) {
            console.error('Errore nella connessione automatica:', error);
        }
    }

    async connectToPeer(ip, port) {
        try {
            await chat.connectToPeer(ip, (message) => {
                console.log(`📨 Messaggio da ${ip}: ${message}`);
                // Qui puoi aggiungere la logica per inoltrare i messaggi via WebSocket
            }, this.user);
        } catch (error) {
            console.log(`❌ Connessione automatica a ${ip}:${port} fallita:`, error.message);
        }
    }

    async announcePresence() {
        if (!this.isRunning) return;

        const announcement = {
            type: 'announce',
            username: this.user.username,
            public_key: this.user.public_key,
            timestamp: Date.now()
        };

        this.sendMulticast(announcement);
    }

    // 👥 Gestione annunci nuovi peer
    async handlePeerAnnounce(message, rinfo) {
        const peerInfo = {
            ip: normalizeIP(rinfo.address),
            port: 50000,
            type: 'discovered',
            public_key: message.public_key,
            username: message.username,
            last_seen: Date.now()
        };

        // Salva nel database
        await db.savePeerWithKey(
            peerInfo.ip, 
            peerInfo.port, 
            peerInfo.type, 
            peerInfo.public_key, 
            peerInfo.username
        );

        console.log(`🔍 Peer scoperto: ${peerInfo.username} (${peerInfo.ip}:${peerInfo.port})`);
        
        // Connetti automaticamente al nuovo peer
        await this.connectToPeer(peerInfo.ip, peerInfo.port);
    }

    // 🔄 Scambio lista peer connessi
    async exchangePeers() {
        const myPeers = await db.getAllPeers();
        
        const exchangeMessage = {
            type: 'peer_exchange',
            username: this.user.username,
            peers: myPeers.map(peer => ({
                ip: peer.ip,
                port: peer.port,
                username: peer.username,
                public_key: peer.public_key
            })),
            timestamp: Date.now()
        };

        this.sendMulticast(exchangeMessage);
    }

    // 📨 Gestione scambio peer
    async handlePeerExchange(message, rinfo) {
        for (const peerData of message.peers) {
            // Non aggiungere se stesso
            if (peerData.username === this.user.username) continue;

            const normalizedIP = normalizeIP(peerData.ip);
            
            const existingPeer = await db.getPeerByAddress(normalizedIP, peerData.port);
            
            if (!existingPeer) {
                await db.savePeerWithKey(
                    normalizedIP,
                    peerData.port,
                    'discovered',
                    peerData.public_key,
                    peerData.username
                );
                
                console.log(`🔄 Peer aggiunto da scambio: ${peerData.username}`);
                
                // Connetti automaticamente al nuovo peer
                await this.connectToPeer(normalizedIP, peerData.port);
            }
        }
    }

    // 📤 Invio messaggio multicast
    sendMulticast(message) {
        if (!this.isRunning || !this.socket) return;

        try {
            const data = Buffer.from(JSON.stringify(message));
            this.socket.send(data, this.multicastPort, this.multicastGroup);
        } catch (error) {
            console.error('Errore nell\'invio multicast:', error);
        }
    }

    // 🔍 Scansione manuale della rete
    async manualScan() {
        console.log("🔍 Avvio scansione manuale della rete...");
        await this.announcePresence();
        console.log("✅ Scansione completata.");
    }

    // 📋 Ottieni lista peer scoperti
    async getDiscoveredPeers() {
        const peers = await db.getAllPeers();
        const { deduplicatePeers } = require('./utils.js');
        return deduplicatePeers(peers);
    }

    // ⏹️ Ferma il servizio di discovery
    stop() {
        this.isRunning = false;
        
        if (this.announceTimer) {
            clearInterval(this.announceTimer);
        }
        
        if (this.autoConnectTimer) {
            clearInterval(this.autoConnectTimer);
        }
        
        if (this.socket) {
            this.socket.close();
        }
        
        console.log('🔍 Servizio di discovery fermato');
    }
}

module.exports = new NetworkDiscovery();
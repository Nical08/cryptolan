// network_discovery.js
const db = require('./db.js');
const dgram = require('dgram');

class NetworkDiscovery {
    constructor() {
        this.multicastGroup = '224.0.0.114';
        this.multicastPort = 50001;
        this.announceInterval = 30000; // 30 secondi
        this.socket = null;
        this.isRunning = false;
    }

    async initialize(user) {
        this.user = user;
        await this.startMulticastListener();
        this.startAnnouncement();
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
            ip: rinfo.address,
            port: 50000, // Porta TCP predefinita per le connessioni
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

            // Verifica se il peer è già noto
            const existingPeer = await db.getPeerByAddress(peerData.ip, peerData.port);
            
            if (!existingPeer) {
                await db.savePeerWithKey(
                    peerData.ip,
                    peerData.port,
                    'discovered',
                    peerData.public_key,
                    peerData.username
                );
                
                console.log(`🔄 Peer aggiunto da scambio: ${peerData.username}`);
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
        console.log("✅ Scansione completata. Usa 'Lista peer disponibili' per vedere i risultati.");
    }

    // 📋 Ottieni lista peer scoperti
    async getDiscoveredPeers() {
        return await db.getAllPeers();
    }

    // ⏹️ Ferma il servizio di discovery
    stop() {
        this.isRunning = false;
        
        if (this.announceTimer) {
            clearInterval(this.announceTimer);
        }
        
        if (this.socket) {
            this.socket.close();
        }
        
        console.log('🔍 Servizio di discovery fermato');
    }
}

module.exports = new NetworkDiscovery();
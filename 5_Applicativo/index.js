// index.js netsh advfirewall firewall add rule name="Multicast discovery" dir=in action=allow protocol=UDP localport=50001
const readline = require("readline");
const chat = require("./peer.js");
const db = require("./db.js");
const rsa = require("./rsa_encrypt.js");
const networkDiscovery = require('./network_discovery.js');

class ChatApplication {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.user = null;
        this.isChatActive = false;
    }

    // 🎯 UTILITY FUNCTIONS
    ask(question) {
        return new Promise(resolve => {
            this.rl.question(question, answer => resolve(answer.trim()));
        });
    }

    clearScreen() {
        process.stdout.write('\x1Bc');
        console.log("🚀 Chat Application P2P - Secure Messaging\n");
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 🔐 AUTHENTICATION
    async authentication() {
        let user = await db.getUser();

        if (!user) {
            this.clearScreen();
            console.log("👤 REGISTRAZIONE NUOVO UTENTE\n");
            const username = await this.ask("Inserisci username: ");
            
            if (!username) {
                console.log("❌ Username non valido");
                return this.authentication();
            }

            console.log("🔑 Generazione chiavi crittografiche...");
            const key = rsa.generateKeys();
            
            user = await db.createUser(username, key.publicKey, key.privateKey);
            console.log("✅ Utente creato:", username);
        } else {
            console.log("✅ Accesso effettuato come:", user.username);
        }

        return user;
    }

    // 🚀 APPLICATION START
    async startApp() {
        try {
            this.clearScreen();
            console.log("🔄 Inizializzazione database...");
            await db.initialize();
            
            console.log("🔐 Autenticazione...");
            this.user = await this.authentication();
            
            console.log("🌐 Avvio servizio di discovery...");
            await networkDiscovery.initialize(this.user);
            
            console.log("✅ Sistema pronto!\n");
            await this.delay(1000);
            await this.startServer();
            this.showMainMenu();
        } catch (error) {
            console.error("❌ Errore durante l'avvio:", error.message);
            process.exit(1);
        }
    }

    // 📱 MAIN MENU
    async showMainMenu() {
        this.clearScreen();
        console.log("=== MENU PRINCIPALE ===");
        console.log("1) 🔗 Connettiti a un peer");
        console.log("2) 📋 Lista peer connessi");
        console.log("3) 🔍 Scansione rete");
        console.log("4) 👥 Lista peer disponibili");
        console.log("5) 💬 Modalità chat");
        console.log("6) 📨 Messaggi salvati");
        console.log("7) ⚙️  Informazioni sistema");
        console.log("8) 🚪 Esci");

        const choice = await this.ask("\nSeleziona un'opzione: ");

        switch (choice) {
            
            case "1":
                await this.connectToPeer();
                break;
            case "2":
                await this.listConnectedPeers();
                break;
            case "3":
                await this.scanNetwork();
                break;
            case "4":
                await this.showAvailablePeers();
                break;
            case "5":
                await this.startChat();
                break;
            case "6":
                await this.showSavedMessages();
                break;
            case "7":
                await this.showSystemInfo();
                break;
            case "8":
                await this.exitProgram();
                break;
            default:
                console.log("❌ Opzione non valida");
                await this.delay(1000);
                this.showMainMenu();
        }
    }

    // 🎧 SERVER MANAGEMENT
    async startServer() {
        this.clearScreen();
        console.log("🎧 SERVER IN ASCOLTO\n");
        
        try {
            chat.startServer((message) => {
                console.log(`📨 ${message}`);
            }, this.user);
            
            
            
            
            this.showMainMenu();
        } catch (error) {
            console.log("❌ Errore nell'avvio del server:", error.message);
            await this.delay(2000);
            this.showMainMenu();
        }
    }

    // 🔗 PEER CONNECTION
    async connectToPeer() {
        this.clearScreen();
        console.log("🔗 CONNESSIONE A PEER\n");
        
        const ip = await this.ask("Inserisci IP del peer: ");
        
        if (!ip) {
            console.log("❌ IP non valido");
            await this.delay(1000);
            return this.showMainMenu();
        }

        try {
            console.log(`🔗 Connessione a ${ip}...`);
            await chat.connectToPeer(ip, (message) => {
                console.log(`📨 ${message}`);
            }, this.user);
            
            console.log("✅ Connessione avviata");
            await this.delay(2000);
            this.showMainMenu();
        } catch (error) {
            console.log("❌ Errore di connessione:", error.message);
            await this.delay(2000);
            this.showMainMenu();
        }
    }

    // 📋 CONNECTED PEERS
    async listConnectedPeers() {
        this.clearScreen();
        console.log("📋 PEER CONNESSI\n");
        
        chat.listPeers();
        
        console.log("\nPremi INVIO per tornare al menu");
        await this.ask("");
        this.showMainMenu();
    }

    // 🔍 NETWORK SCAN
    async scanNetwork() {
        this.clearScreen();
        console.log("🔍 SCANSIONE RETE\n");
        
        try {
            console.log("🔄 Invio richiesta di scoperta...");
            await networkDiscovery.manualScan();
            
            console.log("\n⏳ Attendere alcuni secondi per i risultati...");
            await this.delay(3000);
            
            this.showMainMenu();
        } catch (error) {
            console.log("❌ Errore nella scansione:", error.message);
            await this.delay(2000);
            this.showMainMenu();
        }
    }

    // 👥 AVAILABLE PEERS
    async showAvailablePeers() {
        this.clearScreen();
        console.log("👥 PEER DISPONIBILI NELLA RETE\n");
        
        try {
            const discoveredPeers = await networkDiscovery.getDiscoveredPeers();
            
            if (discoveredPeers.length === 0) {
                console.log("❌ Nessun peer disponibile.");
                console.log("💡 Esegui una scansione della rete prima.");
                await this.delay(1000);
                this.showMainMenu();
            } else {
                discoveredPeers.forEach((peer, i) => {
                    const type = peer.type === 'discovered' ? '🔍 Scoperto' : 
                               peer.type === 'incoming' ? '⬅️ In entrata' : 
                               peer.type === 'outgoing' ? '➡️ In uscita' : '❓ Sconosciuto';
                    
                    const status = peer.public_key ? "🔒 Crittato" : "🔓 In chiaro";
                    const lastSeen = peer.last_seen ? 
                        new Date(peer.last_seen).toLocaleString() : 'Mai visto';
                    
                    console.log(`[${i+1}] ${peer.username || 'Sconosciuto'}`);
                    console.log(`    📍 ${peer.ip}:${peer.port}`);
                    console.log(`    📊 ${type} | ${status}`);
                    console.log(`    ⏰ Ultimo contatto: ${lastSeen}`);
                    console.log("");
                });

                const answer = await this.ask("Inserisci numero per connetterti o 'm' per menu: ");
                
                if (answer.toLowerCase() !== 'm') {
                    const index = parseInt(answer) - 1;
                    if (index >= 0 && index < discoveredPeers.length) {
                        const selectedPeer = discoveredPeers[index];
                        await this.connectToSelectedPeer(selectedPeer);
                    } else {
                        console.log("❌ Numero non valido");
                        await this.delay(1000);
                        this.showMainMenu();
                    }
                } else {
                    this.showMainMenu();
                }
            }
        } catch (error) {
            console.log("❌ Errore nel recupero peer:", error.message);
            await this.delay(2000);
            this.showMainMenu();
        }
    }

    async connectToSelectedPeer(peer) {
        this.clearScreen();
        console.log(`🔗 CONNESSIONE A: ${peer.username} (${peer.ip})\n`);
        
        try {
            await chat.connectToPeer(peer.ip, (message) => {
                console.log(`📨 ${message}`);
            }, this.user);
            
            console.log("✅ Connessione avviata");
            await this.delay(2000);
            this.showMainMenu();
        } catch (error) {
            console.log("❌ Errore di connessione:", error.message);
            await this.delay(2000);
            this.showMainMenu();
        }
    }

    // 💬 CHAT MODE
    async startChat() {
        this.clearScreen();
        console.log("💬 MODALITÀ CHAT ATTIVA\n");
        console.log("Comandi disponibili:");
        console.log("  !menu - Torna al menu principale");
        console.log("  !exit - Esci dall'applicazione");
        console.log("  !clear - Pulisci la schermata");
        console.log("  !peers - Mostra peer connessi");
        console.log("\n" + "=".repeat(50) + "\n");

        this.isChatActive = true;

        this.rl.on("line", async (msg) => {
            if (!this.isChatActive) return;

            switch (msg.trim()) {
                case "!menu":
                    this.isChatActive = false;
                    this.rl.removeAllListeners("line");
                    this.showMainMenu();
                    break;
                case "!exit":
                    await this.exitProgram();
                    break;
                case "!clear":
                    this.clearScreen();
                    console.log("💬 Modalità chat - Schermata pulita\n");
                    break;
                case "!peers":
                    chat.listPeers();
                    break;
                default:
                    if (msg.trim()) {
                        await chat.sendMessage(msg, this.user);
                        console.log(`➡️  Tu: ${msg}`);
                    }
                    break;
            }
        });
    }

    // 📨 SAVED MESSAGES
    async showSavedMessages() {
        this.clearScreen();
        console.log("📨 MESSAGGI SALVATI\n");
        
        try {
            const messages = await db.getMessagesByUser(this.user.username);
            
            if (messages.length === 0) {
                console.log("📭 Nessun messaggio salvato.");
            } else {
                console.log(`📊 Trovati ${messages.length} messaggi:\n`);
                
                for (const msg of messages) {
                    let content = msg.message;
                    
                    if (rsa.isEncrypted(content)) {
                        try {
                            content = rsa.decryptMessage(this.user.private_key, content);
                            content = "🔒 " + content;
                        } catch (e) {
                            content = "🔓 [Non decifrabile] " + content;
                        }
                    }
                    
                    const direction = msg.direction === 'outgoing' ? '➡️ Inviati' : '⬅️ Ricevuti';
                    const time = new Date(msg.timestamp).toLocaleString();
                    const peerInfo = msg.peer_address ? `a/da ${msg.peer_address}` : '';
                    
                    console.log(`[${time}] ${direction} ${peerInfo}`);
                    console.log(`   ${content}`);
                    console.log("");
                }
            }
            
            console.log("\nPremi INVIO per tornare al menu");
            await this.ask("");
            this.showMainMenu();
        } catch (error) {
            console.log("❌ Errore nel recupero messaggi:", error.message);
            await this.delay(2000);
            this.showMainMenu();
        }
    }

    // ⚙️ SYSTEM INFO
    async showSystemInfo() {
        this.clearScreen();
        console.log("⚙️  INFORMAZIONI SISTEMA\n");
        
        console.log(`👤 Utente: ${this.user.username}`);
        console.log(`🔑 Chiave pubblica: ${this.user.public_key.substring(0, 50)}...`);
        console.log(`🌐 Porta chat: 50000 (TCP)`);
        console.log(`🔍 Porta discovery: 50001 (UDP Multicast)`);
        console.log(`📊 Database: chat_app.db`);
        
        const peers = await networkDiscovery.getDiscoveredPeers();
        console.log(`👥 Peer conosciuti: ${peers.length}`);
        
        console.log("\nPremi INVIO per tornare al menu");
        await this.ask("");
        this.showMainMenu();
    }

    // 🚪 EXIT PROGRAM
    async exitProgram() {
        this.clearScreen();
        console.log("👋 USCITA DAL PROGRAMMA\n");
        
        console.log("🔄 Chiusura connessioni...");
        chat.closeAll();
        
        console.log("🔍 Fermando servizio discovery...");
        networkDiscovery.stop();
        
        console.log("💾 Chiusura database...");
        await db.close();
        
        console.log("✅ Sistema fermato correttamente");
        
        this.rl.close();
        process.exit(0);
    }
}

// 🚀 START THE APPLICATION
const app = new ChatApplication();
app.startApp().catch(console.error);
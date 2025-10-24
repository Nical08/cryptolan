// peer.js - AGGIORNATO per callback migliorata
const net = require("net");
const db = require('./db.js');
const rsa = require('./rsa_encrypt.js');
const { normalizeIP } = require('./utils.js');

let sockets = [];
const PORT = 50000;

let messageHandler = null;

function startServer(onMessage, user) {
    messageHandler = onMessage; 
    
    const server = net.createServer((socket) => {
        const remoteAddress = normalizeIP(socket.remoteAddress);
        console.log(`✅ Connessione entrante da ${remoteAddress}:${socket.remotePort}`);
        
        const peerInfo = {
            socket: socket,
            address: remoteAddress,
            port: 50000,
            publicKey: null,
            username: null,
            lastActivity: Date.now()
        };
        sockets.push(peerInfo);

        socket.on("data", async (data) => {
            const message = data.toString();
            
            if (message.startsWith("__handshake__")) {
                await handleHandshake(peerInfo, message, user);
            } else {
                let displayMessage = message;
                let originalMessage = message;
                let isEncrypted = false;
                let chatType = 'private';
                
    
                if (message.includes("__group__")) {
                    chatType = 'group';
                    displayMessage = displayMessage.replace("__group__", "");
                    originalMessage = originalMessage.replace("__group__", "");
                }
                
                if (message.startsWith("__encrypted__") || message.startsWith("__hybrid_encrypted__")) {
                    try {
                        displayMessage = rsa.decryptMessage(user.private_key, message);
                        originalMessage = displayMessage;
                        isEncrypted = true;
                    } catch (e) {
                        console.error("Errore nella decifratura:", e);
                        displayMessage = "🔒 [Messaggio cifrato non decifrabile]";
                        isEncrypted = true;
                    }
                }
                
                if (messageHandler) {
                    messageHandler(displayMessage, peerInfo, chatType);
                }

                await db.saveMessage(
                    peerInfo.username, 
                    user.username, 
                    originalMessage, 
                    'incoming', 
                    `${peerInfo.address}:${peerInfo.port}`,
                    chatType
                );
            }
            
            peerInfo.lastActivity = Date.now();
        });

        socket.on("close", () => {
            console.log(`❌ Peer ${peerInfo.username || peerInfo.address} disconnesso`);
            sockets = sockets.filter(s => s.socket !== socket);
            
            if (messageHandler) {
                messageHandler(`Peer ${peerInfo.username || peerInfo.address} disconnesso`, peerInfo, 'system');
            }
        });

        socket.on("error", (error) => {
            console.log(`❌ Errore connessione con ${peerInfo.username || peerInfo.address}:`, error.message);
            sockets = sockets.filter(s => s.socket !== socket);
        });
    });

    server.listen(PORT, () => {
        console.log(`📡 Server in ascolto sulla porta ${PORT}`);
    });

    server.on("error", (error) => {
        console.log("❌ Errore server:", error.message);
    });
}

async function handleHandshake(peerInfo, message, user) {
    const payload = message.replace("__handshake__:", "");
    const data = JSON.parse(payload);
    
    console.log(`🤝 Handshake ricevuto da ${peerInfo.address}:`, data.username);
    
    peerInfo.publicKey = data.key;
    peerInfo.username = data.username;
    
    await db.savePeerWithKey(peerInfo.address, peerInfo.port, 'incoming', data.key, data.username);
    
    const responseHandshake = "__handshake__:" + JSON.stringify({ 
        username: user.username, 
        key: user.public_key 
    });
    peerInfo.socket.write(responseHandshake);

    if (messageHandler) {
        messageHandler(`Nuovo peer connesso: ${data.username}`, peerInfo, 'system');
    }
}

async function connectToPeer(ip, onMessage, user) {
  return new Promise((resolve, reject) => {
    const normalizedIP = normalizeIP(ip);
    const client = new net.Socket();

    const connectionTimeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`Timeout di connessione a ${normalizedIP}:${PORT}`));
    }, 5000);

    client.connect(PORT, normalizedIP, async () => {
      clearTimeout(connectionTimeout);
      console.log(`🔗 Connesso al peer ${normalizedIP}:${PORT}`);
      
      const peerInfo = {
        socket: client,
        address: normalizedIP,
        port: PORT,
        publicKey: null,
        username: null,
        lastActivity: Date.now()
      };
      sockets.push(peerInfo);

      const handshakeData = "__handshake__:" + JSON.stringify({ 
        username: user.username, 
        key: user.public_key 
      });
      client.write(handshakeData);
      
      resolve(peerInfo);
    });

    client.on("data", async (data) => {
      const message = data.toString();
      
      if (message.startsWith("__handshake__")) {
        const payload = message.replace("__handshake__:", "");
        const data = JSON.parse(payload);
        
        const peerInfo = sockets.find(s => s.socket === client);
        if (peerInfo) {
          peerInfo.publicKey = data.key;
          peerInfo.username = data.username;
          
          await db.savePeerWithKey(peerInfo.address, peerInfo.port, 'outgoing', data.key, data.username);
          
          console.log(`🤝 Handshake completato con ${data.username}`);
        }
      } else {
        let displayMessage = message;
        let originalMessage = message;
        let isEncrypted = false;
        let chatType = 'private';
        
        // 🔍 Determina il tipo di chat dal messaggio
        if (message.includes("__group__")) {
          chatType = 'group';
          displayMessage = displayMessage.replace("__group__", "");
          originalMessage = originalMessage.replace("__group__", "");
        }
        
        if (message.startsWith("__encrypted__") || message.startsWith("__hybrid_encrypted__")) {
          try {
            displayMessage = rsa.decryptMessage(user.private_key, message);
            originalMessage = displayMessage;
            isEncrypted = true;
          } catch (e) {
            console.error("Errore nella decifratura:", e);
            displayMessage = "🔒 [Messaggio cifrato non decifrabile]";
            isEncrypted = true;
          }
        }
        
        const peerInfo = sockets.find(s => s.socket === client);
        const finalMessage = isEncrypted ? 
          `🔒 ${peerInfo?.username || normalizedIP} dice: ${displayMessage}` :
          `💬 ${peerInfo?.username || normalizedIP} dice: ${displayMessage}`;
        
        onMessage(finalMessage);
        
        // 💾 Salva il messaggio con il tipo corretto
        await db.saveMessage(
          peerInfo?.username, 
          user.username, 
          originalMessage, 
          'incoming', 
          `${normalizedIP}:${PORT}`,
          chatType
        );
      }
      
      const peerInfo = sockets.find(s => s.socket === client);
      if (peerInfo) {
        peerInfo.lastActivity = Date.now();
      }
    });

    client.on("close", () => {
      clearTimeout(connectionTimeout);
      console.log(`❌ Connessione chiusa con ${normalizedIP}:${PORT}`);
      sockets = sockets.filter(s => s.socket !== client);
    });

    client.on("error", (error) => {
      clearTimeout(connectionTimeout);
      console.log(`❌ Errore connessione con ${normalizedIP}:${PORT}:`, error.message);
      sockets = sockets.filter(s => s.socket !== client);
      reject(error);
    });
  });
}

// 🔄 Invio messaggio di gruppo (broadcast a tutti)
async function sendGroupMessage(msg, user) {
  const results = [];
  
  for (const peerInfo of sockets) {
    if (!peerInfo.socket.destroyed) {
      try {
        let messageToSend = msg;
        let isEncrypted = false;
        
        if (peerInfo.publicKey) {
          messageToSend = rsa.encryptMessage(peerInfo.publicKey, msg);
          isEncrypted = true;
        }
        
        // 🔖 Aggiungi identificatore gruppo
        messageToSend = "__group__" + messageToSend;
        
        peerInfo.socket.write(messageToSend);
        
        // 💾 Salva come messaggio di gruppo
        await db.saveMessage(
          user.username, 
          'ALL', // Receiver è "ALL" per i messaggi di gruppo
          msg, 
          'outgoing', 
          `${peerInfo.address}:${peerInfo.port}`,
          'group'
        );
        
        console.log(`📢 Messaggio gruppo a ${peerInfo.username || peerInfo.address}: ${isEncrypted ? '🔒' : '🔓'} "${msg}"`);
        results.push({ success: true, peer: peerInfo.address, type: 'group' });
      } catch (error) {
        console.error(`❌ Errore invio gruppo a ${peerInfo.address}:`, error.message);
        results.push({ success: false, peer: peerInfo.address, error: error.message });
      }
    }
  }
  
  return results;
}

// 👤 Invio messaggio privato a un peer specifico
async function sendPrivateMessage(peerAddress, msg, user) {
  const [ip, port] = peerAddress.split(':');
  const normalizedIP = normalizeIP(ip);
  const peerPort = parseInt(port) || 50000;
  
  const peerInfo = sockets.find(s => 
    s.address === normalizedIP && s.port === peerPort
  );
  
  if (!peerInfo) {
    throw new Error(`Peer ${normalizedIP}:${peerPort} non connesso`);
  }

  if (peerInfo.socket.destroyed) {
    throw new Error(`Connessione con ${normalizedIP}:${peerPort} chiusa`);
  }

  let messageToSend = msg;
  let isEncrypted = false;

  if (peerInfo.publicKey) {
    messageToSend = rsa.encryptMessage(peerInfo.publicKey, msg);
    isEncrypted = true;
  }

  // 🔖 NON aggiungere identificatore gruppo (è privato)
  peerInfo.socket.write(messageToSend);
  
  // 💾 Salva come messaggio privato
  await db.saveMessage(
    user.username, 
    peerInfo.username, 
    msg, 
    'outgoing', 
    peerAddress,
    'private'
  );

  console.log(`📤 Messaggio privato a ${peerInfo.username || normalizedIP}: ${isEncrypted ? '🔒' : '🔓'} "${msg}"`);
  
  return { success: true, encrypted: isEncrypted, type: 'private' };
}

// 👥 Ottieni lista peer connessi
function getConnectedPeers() {
  return sockets.map(peer => ({
    address: peer.address,
    port: peer.port,
    username: peer.username,
    publicKey: !!peer.publicKey,
    lastActivity: peer.lastActivity
  }));
}

function listPeers() {
  const connectedPeers = getConnectedPeers();
  
  if (connectedPeers.length === 0) {
    console.log("⚠️ Nessun peer connesso");
  } else {
    console.log("📋 Peer connessi:");
    connectedPeers.forEach((peer, i) => {
      const status = peer.publicKey ? "🔒" : "🔓";
      const lastSeen = new Date(peer.lastActivity).toLocaleTimeString();
      console.log(`  [${i+1}] ${peer.username || 'Sconosciuto'} (${peer.address}:${peer.port}) ${status} - Ultima attività: ${lastSeen}`);
    });
  }
}

function closeAll() {
  sockets.forEach(s => {
    if (!s.socket.destroyed) {
      s.socket.destroy();
    }
  });
  sockets = [];
}

// 🔄 Disconnetti da un peer specifico
function disconnectFromPeer(peerAddress) {
  const [ip, port] = peerAddress.split(':');
  const normalizedIP = normalizeIP(ip);
  const peerPort = parseInt(port) || 50000;
  
  const peerInfo = sockets.find(s => 
    s.address === normalizedIP && s.port === peerPort
  );
  
  if (peerInfo && !peerInfo.socket.destroyed) {
    peerInfo.socket.destroy();
    sockets = sockets.filter(s => s !== peerInfo);
    console.log(`🔌 Disconnesso da ${peerInfo.username || normalizedIP}:${peerPort}`);
    return true;
  }
  
  return false;
}

module.exports = {
  startServer,
  connectToPeer,
  sendGroupMessage,
  sendPrivateMessage,
  getConnectedPeers,
  listPeers,
  disconnectFromPeer,
  closeAll
};
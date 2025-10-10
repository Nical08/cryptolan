// peer.js
const net = require("net");
const db = require('./db.js');
const rsa = require('./rsa_encrypt.js');

let sockets = [];
const PORT = 50000;

function startServer(onMessage, user) {
  const server = net.createServer((socket) => {
    console.log(`✅ Connessione entrante da ${socket.remoteAddress}:${socket.remotePort}`);
    
    const peerInfo = {
      socket: socket,
      address: socket.remoteAddress,
      port: socket.remotePort,
      publicKey: null,
      username: null
    };
    sockets.push(peerInfo);

    socket.on("data", async (data) => {
      const message = data.toString();
      
      if (message.startsWith("__handshake__")) {
        await handleHandshake(peerInfo, message, user);
      } else if (message.startsWith("__encrypted__") || message.startsWith("__hybrid_encrypted__")) {
        // Messaggio cifrato
        const decrypted = rsa.decryptMessage(user.private_key, message);
        onMessage(`🔒 ${peerInfo.username || peerInfo.address} dice: ${decrypted}`);
        
        // Salva il messaggio nel database
        await db.saveMessage(peerInfo.username, user.username, message, 'incoming', `${peerInfo.address}:${peerInfo.port}`);
      } else {
        // Messaggio in chiaro
        onMessage(`💬 ${peerInfo.username || peerInfo.address} dice: ${message}`);
        await db.saveMessage(peerInfo.username, user.username, message, 'incoming', `${peerInfo.address}:${peerInfo.port}`);
      }
    });

    socket.on("close", () => {
      console.log(`❌ Peer ${peerInfo.username || peerInfo.address} disconnesso`);
      sockets = sockets.filter(s => s.socket !== socket);
    });
  });

  server.listen(PORT, () => {
    console.log(`📡 Server in ascolto sulla porta ${PORT}`);
  });
}

async function handleHandshake(peerInfo, message, user) {
  const payload = message.replace("__handshake__:", "");
  const data = JSON.parse(payload);
  
  console.log(`🤝 Handshake ricevuto da ${peerInfo.address}:`, data.username);
  
  // Salva le informazioni del peer
  peerInfo.publicKey = data.key;
  peerInfo.username = data.username;
  
  // Salva nel database
  await db.savePeerWithKey(peerInfo.address, peerInfo.port, 'incoming', data.key, data.username);
  
  // Invia la nostra handshake di risposta
  const responseHandshake = "__handshake__:" + JSON.stringify({ 
    username: user.username, 
    key: user.public_key 
  });
  peerInfo.socket.write(responseHandshake);
}

async function connectToPeer(ip, onMessage, user) {
  const client = new net.Socket();

  client.connect(PORT, ip, async () => {
    console.log(`🔗 Connesso al peer ${ip}:${PORT}`);
    
    const peerInfo = {
      socket: client,
      address: ip,
      port: PORT,
      publicKey: null,
      username: null
    };
    sockets.push(peerInfo);

    // Invia handshake
    const handshakeData = "__handshake__:" + JSON.stringify({ 
      username: user.username, 
      key: user.public_key 
    });
    client.write(handshakeData);
  });

  client.on("data", async (data) => {
    const message = data.toString();
    
    if (message.startsWith("__handshake__")) {
      const payload = message.replace("__handshake__:", "");
      const data = JSON.parse(payload);
      
      // Trova il peerInfo corrispondente
      const peerInfo = sockets.find(s => s.socket === client);
      if (peerInfo) {
        peerInfo.publicKey = data.key;
        peerInfo.username = data.username;
        
        // Salva nel database
        await db.savePeerWithKey(peerInfo.address, peerInfo.port, 'outgoing', data.key, data.username);
        
        console.log(`🤝 Handshake completato con ${data.username}`);
      }
    } else if (message.startsWith("__encrypted__") || message.startsWith("__hybrid_encrypted__")) {
      // Messaggio cifrato
      const decrypted = rsa.decryptMessage(user.private_key, message);
      const peerInfo = sockets.find(s => s.socket === client);
      onMessage(`🔒 ${peerInfo?.username || ip} dice: ${decrypted}`);
      
      // Salva il messaggio nel database
      await db.saveMessage(peerInfo?.username, user.username, message, 'incoming', `${ip}:${PORT}`);
    } else {
      // Messaggio in chiaro
      const peerInfo = sockets.find(s => s.socket === client);
      onMessage(`💬 ${peerInfo?.username || ip} dice: ${message}`);
      await db.saveMessage(peerInfo?.username, user.username, message, 'incoming', `${ip}:${PORT}`);
    }
  });

  client.on("close", () => {
    console.log(`❌ Connessione chiusa con ${ip}:${PORT}`);
    sockets = sockets.filter(s => s.socket !== client);
  });
}

async function sendMessage(msg, user) {
  for (const peerInfo of sockets) {
    if (!peerInfo.socket.destroyed) {
      let messageToSend = msg;
      
      // Se abbiamo la chiave pubblica del peer, cifra il messaggio
      if (peerInfo.publicKey) {
        messageToSend = rsa.encryptMessage(peerInfo.publicKey, msg);
      }
      
      peerInfo.socket.write(messageToSend);
      
      // Salva il messaggio nel database
      await db.saveMessage(user.username, peerInfo.username, messageToSend, 'outgoing', `${peerInfo.address}:${peerInfo.port}`);
    }
  }
}

function listPeers() {
  if (sockets.length === 0) {
    console.log("⚠️ Nessun peer connesso");
  } else {
    console.log("📋 Peer connessi:");
    sockets.forEach((peer, i) => {
      const status = peer.publicKey ? "🔒" : "🔓";
      console.log(`  [${i+1}] ${peer.username || 'Sconosciuto'} (${peer.address}:${peer.port}) ${status}`);
    });
  }
}

function closeAll() {
  sockets.forEach(s => s.socket.destroy());
  sockets = [];
}

module.exports = {
  startServer,
  connectToPeer,
  sendMessage,
  listPeers,
  closeAll
};
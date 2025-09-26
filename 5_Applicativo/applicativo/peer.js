const net = require("net");

let sockets = [];
const PORT = 50000;

function startServer(onMessage) {
  const server = net.createServer((socket) => {
    console.log(`✅ Connessione entrante da ${socket.remoteAddress}:${socket.remotePort}`);
    sockets.push(socket);

    socket.on("data", (data) => {
      onMessage(`💬 Peer dice: ${data.toString()}`);
    });

    socket.on("close", () => {
      console.log(`❌ Peer disconnesso`);
      sockets = sockets.filter(s => s !== socket);
    });
  });

  server.listen(PORT, () => {
    console.log(`📡 Server in ascolto sulla porta ${PORT}`);
  });
}

function connectToPeer(ip, onMessage) {
  const client = new net.Socket();

  client.connect(PORT, ip, () => {
    console.log(`🔗 Connesso al peer ${ip}:${PORT}`);
    sockets.push(client);
  });

  client.on("data", (data) => {
    onMessage(`💬 Peer dice: ${data.toString()}`);
  });

  client.on("close", () => {
    console.log(`❌ Connessione chiusa con ${ip}:${PORT}`);
    sockets = sockets.filter(s => s !== client);
  });
}

function sendMessage(msg) {
  sockets.forEach(socket => {
    if (!socket.destroyed) socket.write(msg);
  });
}

function listPeers() {
  if (sockets.length === 0) {
    console.log("⚠️ Nessun peer connesso");
  } else {
    console.log("📋 Peer connessi:");
    sockets.forEach((s, i) => {
      console.log(`  [${i+1}] ${s.remoteAddress}:${s.remotePort}`);
    });
  }
}

function closeAll() {
  sockets.forEach(s => s.destroy());
  sockets = [];
}

module.exports = {
  startServer,
  connectToPeer,
  sendMessage,
  listPeers,
  closeAll
};

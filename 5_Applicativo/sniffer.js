// sniffer.js - Simple TCP sniffer
const net = require('net');

const PORT = 50000;

const server = net.createServer((socket) => {
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`📡 Connessione da: ${clientInfo}`);
    
    socket.on('data', (data) => {
        const message = data.toString();
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`\n[${timestamp}] da ${clientInfo}:`);
        
        if (message.startsWith('__encrypted__') || message.startsWith('__hybrid_encrypted__')) {
            console.log('   🔒 MESSAGGIO CIFRATO');
            console.log('   Dati:', message.substring(0, 100) + '...');
        } else if (message.startsWith('__handshake__')) {
            console.log('   🤝 HANDSHAKE');
            try {
                const payload = JSON.parse(message.replace('__handshake__:', ''));
                console.log('   Utente:', payload.username);
                console.log('   Chiave:', payload.key.substring(0, 50) + '...');
            } catch (e) {
                console.log('   Dati:', message);
            }
        } else {
            console.log('   🔓 MESSAGGIO IN CHIARO:', message);
        }
    });
    
    socket.on('close', () => {
        console.log(`❌ Disconnesso: ${clientInfo}`);
    });
});

server.listen(PORT, () => {
    console.log(`👂 Sniffer in ascolto sulla porta ${PORT}\n`);
});
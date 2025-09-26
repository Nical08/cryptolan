const net = require("net");

const ip = "10.20.5.86"; // IP del peer
const port = 50000;

const client = new net.Socket();

client.setTimeout(3000); // timeout 3 secondi

client.connect(port, ip, () => {
  console.log(`✅ Connessione riuscita a ${ip}:${port}`);
  client.destroy();
});

client.on("timeout", () => {
  console.log(`⏱ Timeout: impossibile connettersi a ${ip}:${port}`);
  client.destroy();
});

client.on("error", (err) => {
  console.log(`❌ Errore: ${err.message}`);
});

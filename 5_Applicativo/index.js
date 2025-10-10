// index.js
const readline = require("readline");
const chat = require("./peer.js");
const db = require("./db.js");
const rsa = require("./rsa_encrypt.js");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let user = null;

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer));
  });
}

async function autentication() {
  let user = await db.getUser();

  if (!user) {
    const key = rsa.generateKeys();
    const username = await ask("Enter username: ");
    
    user = await db.createUser(username, key.publicKey, key.privateKey);
    console.log("✅ User created:", username);
  } else {
    console.log("👤 User found:", user.username);
  }

  return user;
}

async function startApp() {
  await db.initialize();
  user = await autentication();
  showMenu(user);
}

function showMenu(user) {
  console.log("\n=== MENU ===");
  console.log("1) Avvia server (in ascolto)");
  console.log("2) Connettiti a un peer");
  console.log("3) Lista peer connessi");
  console.log("4) Chat");
  console.log("5) Messaggi salvati");
  console.log("6) Esci");

  rl.question("Seleziona un'opzione: ", (choice) => {
    switch (choice.trim()) {
      case "1":
        chat.startServer(console.log, user);
        showMenu(user);
        break;
      case "2":
        rl.question("Inserisci IP del peer: ", (ip) => {
          chat.connectToPeer(ip, console.log, user);
          showMenu(user);
        });
        break;
      case "3":
        chat.listPeers();
        showMenu(user);
        break;
      case "4":
        startChat(user);
        break;
      case "5":
        showSavedMessages(user);
        break;
      case "6":
        exitProgram();
        break;
      default:
        console.log("❌ Opzione non valida");
        showMenu(user);
    }
  });
}

async function startChat(user) {
  console.log("💬 Modalità chat attiva. Digita !menu per tornare al menu, !exit per uscire.");
  
  rl.on("line", async (msg) => {
    if (msg === "!menu") {
      rl.removeAllListeners("line");
      showMenu(user);
    } else if (msg === "!exit") {
      exitProgram();
    } else {
      await chat.sendMessage(msg, user);
    }
  });
}

async function showSavedMessages(user) {
  console.log("\n📨 Messaggi salvati:");
  const messages = await db.getMessagesByUser(user.username);
  
  if (messages.length === 0) {
    console.log("Nessun messaggio salvato.");
  } else {
    for (const msg of messages) {
      let content = msg.message;
      
      // Prova a decifrare se è cifrato
      if (rsa.isEncrypted(content)) {
        try {
          content = rsa.decryptMessage(user.private_key, content);
          content = "🔒 " + content;
        } catch (e) {
          content = "🔓 [Non decifrabile] " + content;
        }
      }
      
      const direction = msg.direction === 'outgoing' ? '➡️ Inviati' : '⬅️ Ricevuti';
      const time = new Date(msg.timestamp).toLocaleString();
      const peerInfo = msg.peer_address ? `da ${msg.peer_address}` : '';
      console.log(`[${time}] ${direction} ${peerInfo}: ${content}`);
    }
  }
  
  showMenu(user);
}

function exitProgram() {
  console.log("👋 Uscita dal programma...");
  chat.closeAll();
  db.close();
  rl.close();
  process.exit(0);
}

startApp();
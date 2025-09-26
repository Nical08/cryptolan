const readline = require("readline");
const chat = require("./peer.js");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function showMenu() {
  console.log("\n=== MENU ===");
  console.log("1) Avvia server (in ascolto)");
  console.log("2) Connettiti a un peer");
  console.log("3) Lista peer connessi");
  console.log("4) Chat");
  console.log("5) Esci");

  rl.question("Seleziona un'opzione: ", (choice) => {
    switch (choice.trim()) {
      case "1":
        chat.startServer(console.log);
        showMenu();
        break;
      case "2":
        rl.question("Inserisci IP del peer: ", (ip) => {
          chat.connectToPeer(ip, console.log);
          showMenu();
        });
        break;
      case "3":
        chat.listPeers();
        showMenu();
        break;
      case "4":
        startChat();
        break;
      case "5":
        exitProgram();
        break;
      default:
        console.log("❌ Opzione non valida");
        showMenu();
    }
  });
}

function startChat() {
  console.log("💬 Modalità chat attiva. Digita !menu per tornare al menu, !exit per uscire.");
  rl.on("line", (msg) => {
    if (msg === "!menu") {
      showMenu();
    } else if (msg === "!exit") {
      exitProgram();
    } else {
      chat.sendMessage(msg);
    }
  });
}

function exitProgram() {
  console.log("👋 Uscita dal programma...");
  chat.closeAll();
  rl.close();
  process.exit(0);
}

// === START ===
showMenu();

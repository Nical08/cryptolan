const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db = null;

async function initialize() {
  const dbPath = path.join(__dirname, 'chat_app.db');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Crea le tabelle se non esistono
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    DROP TABLE IF EXISTS peers;
    
    CREATE TABLE peers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      port INTEGER NOT NULL,
      type TEXT NOT NULL,
      public_key TEXT,
      username TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Gestisci la tabella messages separatamente per preservare i dati
  try {
    // Prova a creare la tabella messages con il nuovo schema
    await db.exec(`
      CREATE TABLE IF NOT EXISTS messages_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_username TEXT,
        receiver_username TEXT,
        message TEXT NOT NULL,
        direction TEXT NOT NULL,
        peer_address TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Controlla se esiste la vecchia tabella
    const oldTable = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='messages'"
    );
    
    if (oldTable) {
      // Copia i dati dalla vecchia tabella alla nuova
      await db.exec(`
        INSERT INTO messages_new (message, direction, peer_address, timestamp)
        SELECT message, direction, peer_address, timestamp FROM messages
      `);
      
      // Elimina la vecchia tabella
      await db.exec('DROP TABLE messages');
    }
    
    // Rinomina la nuova tabella
    await db.exec('ALTER TABLE messages_new RENAME TO messages');
    
  } catch (error) {
    console.log('Tabella messages già aggiornata o errore durante l\'aggiornamento:', error);
  }

  console.log('✅ Database inizializzato');
}


async function createUser(username, publicKey, privateKey) {
  const result = await db.run(
    'INSERT INTO users (username, public_key, private_key) VALUES (?, ?, ?)',
    [username, publicKey, privateKey]
  );
  
  return {
    id: result.lastID,
    username,
    public_key: publicKey,
    private_key: privateKey
  };
}

async function getUser() {
  return await db.get(
    'SELECT * FROM users LIMIT 1'
  );
}

async function getPeerByAddress(ip, port) {
  return await db.get(
    'SELECT * FROM peers WHERE ip = ? AND port = ?',
    [ip, port]
  );
}

async function savePeerWithKey(ip, port, type, publicKey, username) {
  // Controlla se il peer esiste già
  const existingPeer = await getPeerByAddress(ip, port);
  
  if (existingPeer) {
    // Aggiorna il peer esistente
    await db.run(
      'UPDATE peers SET type = ?, public_key = ?, username = ? WHERE ip = ? AND port = ?',
      [type, publicKey, username, ip, port]
    );
  } else {
    // Crea un nuovo peer
    await db.run(
      'INSERT INTO peers (ip, port, type, public_key, username) VALUES (?, ?, ?, ?, ?)',
      [ip, port, type, publicKey, username]
    );
  }
}

async function getPeerPublicKey(ip, port) {
  const peer = await getPeerByAddress(ip, port);
  return peer ? peer.public_key : null;
}

async function getAllPeers() {
  return await db.all(
    'SELECT * FROM peers ORDER BY created_at DESC'
  );
}

async function saveMessage(senderUsername, receiverUsername, message, direction, peerAddress) {
  await db.run(
    'INSERT INTO messages (sender_username, receiver_username, message, direction, peer_address) VALUES (?, ?, ?, ?, ?)',
    [senderUsername, receiverUsername, message, direction, peerAddress]
  );
}

async function getMessagesByUser(username) {
  return await db.all(`
    SELECT * FROM messages 
    WHERE sender_username = ? OR receiver_username = ? 
    ORDER BY timestamp DESC
    LIMIT 50
  `, [username, username]);
}

async function close() {
  if (db) {
    await db.close();
  }
}

module.exports = {
  initialize,
  createUser,
  getUser,
  getPeerByAddress,
  savePeerWithKey,
  getPeerPublicKey,
  getAllPeers,
  saveMessage,
  getMessagesByUser,
  close
};
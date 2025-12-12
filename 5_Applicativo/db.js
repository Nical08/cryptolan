// db.js - AGGIORNATO per separazione messaggi
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

  // ✅ Crea le tabelle solo se non esistono
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS peers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      port INTEGER NOT NULL,
      type TEXT NOT NULL,
      public_key TEXT,
      username TEXT,
      last_seen INTEGER, 
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_username TEXT,
      receiver_username TEXT,
      message TEXT NOT NULL,
      direction TEXT NOT NULL,
      peer_address TEXT,
      chat_type TEXT NOT NULL DEFAULT 'private', -- 'private' o 'group'
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

//  Funzioni di gestione utenti
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
  return await db.get('SELECT * FROM users LIMIT 1');
}

// 🧩 Funzioni di gestione peer
async function getPeerByAddress(ip, port) {
  return await db.get(
    'SELECT * FROM peers WHERE ip = ? AND port = ?',
    [ip, port]
  );
}

async function savePeerWithKey(ip, port, type, publicKey, username) {
  const existingPeer = await getPeerByAddress(ip, port);
  
  if (existingPeer) {
    await db.run(
      'UPDATE peers SET type = ?, public_key = ?, username = ?, last_seen = ? WHERE ip = ? AND port = ?',
      [type, publicKey, username, Date.now(), ip, port]
    );
  } else {
    await db.run(
      'INSERT INTO peers (ip, port, type, public_key, username, last_seen) VALUES (?, ?, ?, ?, ?, ?)',
      [ip, port, type, publicKey, username, Date.now()]
    );
  }
}

async function getPeerPublicKey(ip, port) {
  const peer = await getPeerByAddress(ip, port);
  return peer ? peer.public_key : null;
}

async function getAllPeers() {
  return await db.all('SELECT * FROM peers ORDER BY last_seen DESC');
}

//  Funzioni di gestione messaggi - SEPARATI per tipo
async function saveMessage(senderUsername, receiverUsername, message, direction, peerAddress, chatType = 'private') {
  await db.run(
    'INSERT INTO messages (sender_username, receiver_username, message, direction, peer_address, chat_type) VALUES (?, ?, ?, ?, ?, ?)',
    [senderUsername, receiverUsername, message, direction, peerAddress, chatType]
  );
}

//  Ottieni messaggi di gruppo (solo broadcast)
async function getGroupMessages() {
  return await db.all(`
    SELECT * FROM messages 
    WHERE chat_type = 'group'
    ORDER BY timestamp DESC
    LIMIT 100
  `);
}

//  Ottieni messaggi privati con un peer specifico
async function getPrivateMessages(userUsername, peerAddress) {
  return await db.all(`
    SELECT * FROM messages 
    WHERE chat_type = 'private' 
    AND ( (sender_username = ? AND peer_address = ?) OR (receiver_username = ? AND peer_address = ?) )
    ORDER BY timestamp DESC
    LIMIT 100
  `, [userUsername, peerAddress, userUsername, peerAddress]);
}

//  Ottieni tutti i messaggi per un utente (per compatibilità)
async function getMessagesByUser(username) {
  return await db.all(`
    SELECT * FROM messages 
    WHERE sender_username = ? OR receiver_username = ? 
    ORDER BY timestamp DESC
    LIMIT 100
  `, [username, username]);
}

//  Ottieni conteggio messaggi non letti per peer
async function getUnreadCounts(userUsername) {
  // Per semplicità, consideriamo tutti i messaggi come "letti" quando visualizzati
  // Puoi implementare una logica più avanzata con una colonna 'read'
  return await db.all(`
    SELECT peer_address, COUNT(*) as unread_count
    FROM messages 
    WHERE chat_type = 'private' 
    AND receiver_username = ? 
    AND direction = 'incoming'
    GROUP BY peer_address
  `, [userUsername]);
}

// Chiusura del database
async function close() {
  if (db) {
    await db.close();
    console.log('🔒 Connessione al database chiusa');
  }
}

// 📦 Esporta tutte le funzioni
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
  getGroupMessages,
  getPrivateMessages,
  getUnreadCounts,
  close
};
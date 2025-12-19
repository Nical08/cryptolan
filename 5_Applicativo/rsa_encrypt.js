// rsa_encrypt.js
const crypto = require('crypto');
const database = require('./db.js');

function generateKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048, 
    publicKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
    },
  });
  return { publicKey, privateKey };
}

function encryptMessage(publicKey, message) {
  try {
    // Per messaggi lunghi, usiamo crittografia ibrida
    if (message.length > 200) {
      return hybridEncrypt(publicKey, message);
    }
    
    const encryptedData = crypto.publicEncrypt(publicKey, Buffer.from(message, 'utf8'));
    return "__encrypted__:" + encryptedData.toString('base64');
  } catch (error) {
    console.error("Errore nella cifratura:", error);
    return message; // Fallback
  }
}

function decryptMessage(privateKey, encryptedMessage) {
  try {
    if (encryptedMessage.startsWith("__encrypted__:")) {
      const encryptedData = encryptedMessage.replace("__encrypted__:", "");
      const decryptedData = crypto.privateDecrypt(
        privateKey,
        Buffer.from(encryptedData, 'base64')
      );
      return decryptedData.toString('utf8');
    } else if (encryptedMessage.startsWith("__hybrid_encrypted__:")) {
      return hybridDecrypt(privateKey, encryptedMessage);
    }
    return encryptedMessage;
  } catch (error) {
    console.error("Errore nella decifratura:", error);
    return encryptedMessage;
  }
}

function hybridEncrypt(publicKey, message) {

  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  

  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  let encrypted = cipher.update(message, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const encryptedKey = crypto.publicEncrypt(publicKey, aesKey);
  
  return `__hybrid_encrypted__:${encryptedKey.toString('base64')}:${iv.toString('base64')}:${encrypted}`;
}

function hybridDecrypt(privateKey, hybridMessage) {
  const parts = hybridMessage.replace("__hybrid_encrypted__:", "").split(":");
  const encryptedKey = Buffer.from(parts[0], 'base64');
  const iv = Buffer.from(parts[1], 'base64');
  const encryptedData = parts[2];

  const aesKey = crypto.privateDecrypt(privateKey, encryptedKey);
  

  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}


function isEncrypted(message) {
  return message.startsWith("__encrypted__:") || message.startsWith("__hybrid_encrypted__:");
}

module.exports = {
  generateKeys,
  encryptMessage,
  decryptMessage,
  isEncrypted
};
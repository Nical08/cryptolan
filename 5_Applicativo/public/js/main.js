// main.js
const socket = io();

// Gestione invio messaggi
document.getElementById('messageForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    try {
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageInput.value = '';
        } else {
            console.error('Errore invio messaggio:', data.error);
        }
    } catch (error) {
        console.error('Errore invio messaggio:', error);
    }
});

// Gestione connessione peer
document.getElementById('connectForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const ipInput = document.getElementById('peerIp');
    const ip = ipInput.value.trim();
    
    if (!ip) {
        alert('Per favore inserisci un indirizzo IP');
        return;
    }
    
    try {
        const response = await fetch('/api/connect-peer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ip })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Connessione avviata con successo!');
            ipInput.value = '';
            loadPeers(); // Ricarica la lista peer
        } else {
            alert('Errore: ' + data.error);
        }
    } catch (error) {
        console.error('Errore connessione:', error);
        alert('Errore di connessione');
    }
});

// Funzioni globali
async function scanNetwork() {
    try {
        const response = await fetch('/api/scan-network', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Scansione rete avviata! I risultati saranno disponibili tra qualche secondo.');
            setTimeout(loadPeers, 3000); // Ricarica i peer dopo 3 secondi
        } else {
            alert('Errore: ' + data.error);
        }
    } catch (error) {
        console.error('Errore scansione:', error);
        alert('Errore di connessione');
    }
}

async function loadPeers() {
    try {
        const response = await fetch('/api/peers');
        const data = await response.json();
        
        if (data.success) {
            updatePeersList(data.peers);
        }
    } catch (error) {
        console.error('Errore caricamento peer:', error);
    }
}

function updatePeersList(peers) {
    const peersGrid = document.getElementById('peersGrid');
    const peersList = document.getElementById('peersList');
    
    if (peersGrid) {
        peersGrid.innerHTML = peers.map(peer => `
            <div class="peer-card">
                <div class="peer-header">
                    <div class="peer-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="peer-info">
                        <h4>${peer.username || 'Sconosciuto'}</h4>
                        <p class="peer-address">${peer.ip}:${peer.port}</p>
                    </div>
                    <div class="peer-status ${peer.public_key ? 'encrypted' : 'plain'}">
                        ${peer.public_key ? '🔒' : '🔓'}
                    </div>
                </div>
                
                <div class="peer-details">
                    <div class="detail">
                        <span class="label">Tipo:</span>
                        <span class="value">${peer.type}</span>
                    </div>
                    <div class="detail">
                        <span class="label">Ultimo visto:</span>
                        <span class="value">${peer.last_seen ? new Date(peer.last_seen).toLocaleString() : 'Mai'}</span>
                    </div>
                </div>
                
                <div class="peer-actions">
                    <button class="btn btn-sm btn-primary" 
                            onclick="connectToPeer('${peer.ip}')">
                        <i class="fas fa-plug"></i> Connetti
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    if (peersList) {
        peersList.innerHTML = peers.map(peer => `
            <div class="peer-item">
                <div class="peer-info">
                    <h4>${peer.username || 'Sconosciuto'}</h4>
                    <p class="peer-address">${peer.ip}</p>
                </div>
                <div class="peer-status ${peer.public_key ? 'encrypted' : 'plain'}">
                    ${peer.public_key ? '🔒' : '🔓'}
                </div>
            </div>
        `).join('');
    }
}

async function connectToPeer(ip) {
    try {
        const response = await fetch('/api/connect-peer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ip })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Connessione avviata a ${ip}`);
        } else {
            alert('Errore: ' + data.error);
        }
    } catch (error) {
        console.error('Errore connessione:', error);
        alert('Errore di connessione');
    }
}

// Gestione WebSocket per messaggi in tempo reale
socket.on('new-message', (data) => {
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${data.direction === 'outgoing' ? 'outgoing' : 'incoming'}`;
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="sender">${data.sender}</span>
                <span class="time">${new Date(data.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="message-content">
                ${data.message}
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});

socket.on('system-message', (message) => {
    console.log('Messaggio di sistema:', message);
    // Puoi mostrare notifiche del sistema se necessario
});

// Carica i peer quando la pagina è pronta
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('peersGrid') || document.getElementById('peersList')) {
        loadPeers();
    }
    
    // Auto-scroll dei messaggi
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});
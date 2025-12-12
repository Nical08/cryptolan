// utils.js - FUNZIONI AGGIUNTE
function normalizeIP(ip) {
    if (!ip) return ip;
    
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    
    return ip;
}

function getPeerKey(peer) {
    const normalizedIP = normalizeIP(peer.ip);
    return `${normalizedIP}:${peer.port}`; //restituisce solo nel formato ip:porta per avere un univocita
}

function deduplicatePeers(peers) {
    // Crea una mappa per evitare duplicati: chiave = identificatore unico del peer
    const peerMap = new Map();
    
    peers.forEach(peer => {
        // Otteniamo una chiave unica per distinguere i peer (es. IP, pubkey, ecc.)
        const key = getPeerKey(peer);

        // Controlliamo se esiste già un peer con la stessa chiave
        const existingPeer = peerMap.get(key);
        
        if (!existingPeer) {
            // Nessun duplicato → aggiungi direttamente
            peerMap.set(key, peer);
        } else {
            // Esiste già → uniamo le informazioni

            const mergedPeer = {
                ...existingPeer,  // Copia tutte le proprietà del peer esistente…
                ...peer,          // …e poi sovrascrive con quelle del peer più recente
         
                // Se il peer attuale è stato visto più recentemente, prendiamo il suo tipo
                type: peer.last_seen > existingPeer.last_seen 
                        ? peer.type 
                        : existingPeer.type,

                // Manteniamo il valore last_seen più alto (cioè il più recente)
                last_seen: Math.max(peer.last_seen || 0, existingPeer.last_seen || 0),

                // Manteniamo username e public_key, scegliendo quello presente/non vuoto
                username: peer.username || existingPeer.username,
                public_key: peer.public_key || existingPeer.public_key
            };

            // Aggiorniamo la mappa con il peer unificato
            peerMap.set(key, mergedPeer);
        }
    });
    
    // Ritorniamo la lista dei peer unificati, ordinati per ultimo avvistamento (decrescente)
    return Array.from(peerMap.values()).sort((a, b) => 
        (b.last_seen || 0) - (a.last_seen || 0)
    );
}


function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Mai';
    
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Ora';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays < 7) return `${diffDays} giorni fa`;
    
    return date.toLocaleDateString(); //serve per restituire la dfferenza da oggi
}

module.exports = {
    normalizeIP,
    getPeerKey,
    deduplicatePeers,
    formatRelativeTime
};
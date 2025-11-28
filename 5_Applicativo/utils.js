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
    const peerMap = new Map();
    
    peers.forEach(peer => {
        const key = getPeerKey(peer);
        const existingPeer = peerMap.get(key);
        
        if (!existingPeer) {
            peerMap.set(key, peer);
        } else {
            const mergedPeer = {
                ...existingPeer, //copia tutte le proprieta 
                ...peer, //le sovrascrive 
                type: peer.last_seen > existingPeer.last_seen ? peer.type : existingPeer.type, //prende il valore piu recente
                last_seen: Math.max(peer.last_seen || 0, existingPeer.last_seen || 0), //valore massimo
                username: peer.username || existingPeer.username, 
                public_key: peer.public_key || existingPeer.public_key
            };
            peerMap.set(key, mergedPeer);
        }
    });
    
    return Array.from(peerMap.values()).sort((a, b) => 
        (b.last_seen || 0) - (a.last_seen || 0) //ordina i peer dall ultimo visto al meno recente
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
// login.js
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const button = e.target.querySelector('button');
    const originalText = button.innerHTML;
    
    if (!username) {
        alert('Per favore inserisci un username');
        return;
    }
    
    // Mostra loading
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Accesso in corso...';
    button.disabled = true;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reindirizza alla chat
            window.location.href = '/';
        } else {
            alert('Errore: ' + data.error);
            button.innerHTML = originalText;
            button.disabled = false;
        }
    } catch (error) {
        console.error('Errore login:', error);
        alert('Errore di connessione');
        button.innerHTML = originalText;
        button.disabled = false;
    }
});
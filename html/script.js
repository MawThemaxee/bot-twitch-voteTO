/**
 * Client WebSocket pour l'overlay de vote
 * Met à jour l'affichage en temps réel
 */

class VoteOverlay {
    constructor() {
        this.ws = null;
        this.currentVoteState = null;
        this.timerInterval = null;
        this.init();
    }

    init() {
        // Déterminer l'URL WebSocket (fonctionne aussi sur HTTPS)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✓ Connecté au serveur');
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'voteState') {
                    this.updateVoteState(message.data);
                }
            } catch (error) {
                console.error('Erreur de parsing du message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('Erreur WebSocket:', error);
        };

        this.ws.onclose = () => {
            console.log('Déconnecté du serveur, reconnexion dans 3s...');
            setTimeout(() => this.init(), 3000);
        };
    }

    /**
     * Mettre à jour l'état du vote
     */
    updateVoteState(voteState) {
        this.currentVoteState = voteState;

        const activeVoteElement = document.getElementById('activeVote');

        if (!voteState.active) {
            // Masquer le vote actif
            activeVoteElement.classList.remove('active');
            
            // Arrêter le timer
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        } else {
            // Afficher le vote actif
            activeVoteElement.classList.add('active');

            // Mettre à jour les éléments
            document.getElementById('targetName').textContent = voteState.target;
            document.getElementById('voteCount').textContent = voteState.votes;
            document.getElementById('voteThreshold').textContent = voteState.threshold;

            // Calculer et afficher le pourcentage
            const percentage = (voteState.votes / voteState.threshold) * 100;
            document.getElementById('progressFill').style.width = Math.min(percentage, 100) + '%';

            // Démarrer/mettre à jour le timer
            this.startTimer(voteState.timeLeft);
        }
    }

    /**
     * Démarrer le timer de compte à rebours
     */
    startTimer(timeLeftMs) {
        // Arrêter le timer existant
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        const startTime = Date.now();
        const initialTimeLeft = timeLeftMs;

        const updateTimer = () => {
            const elapsed = Date.now() - startTime;
            const timeLeft = Math.max(0, initialTimeLeft - elapsed);

            const seconds = Math.floor(timeLeft / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;

            const timerElement = document.getElementById('timeLeft');
            timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        };

        updateTimer(); // Mise à jour immédiate
        this.timerInterval = setInterval(updateTimer, 100);
    }
}

// Initialiser l'overlay au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    new VoteOverlay();
});

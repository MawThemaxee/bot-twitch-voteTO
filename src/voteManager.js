/**
 * Gestionnaire de vote - gère le suivi des votes et la logique d'interdiction
 * Suit les votes actifs et exécute les interdictions lorsque le seuil est atteint
 */

const logger = require('./logger');

class VoteManager {
  constructor(threshold = 3, banDurationMinutes = 5, voteDurationSeconds = 60) {
    this.threshold = threshold;
    this.banDurationMinutes = banDurationMinutes;
    this.voteDurationSeconds = voteDurationSeconds;
    this.activeVote = null;
    this.voteTimeouts = new Map(); // Suivi des délais d'expiration des votes
  }

  /**
   * Démarrer un nouveau vote pour interdire un utilisateur
   * @param {string} targetUser - Nom d'utilisateur sur lequel voter
   * @param {string} initiator - Nom d'utilisateur qui a démarré le vote
   * @returns {boolean} - True si le vote a démarré, false si un vote est déjà actif
   */
  startVote(targetUser, initiator) {
    if (this.activeVote) {
      logger.warn(
        `Un vote est déjà actif pour ${this.activeVote.target}, impossible de démarrer un nouveau vote`
      );
      return false;
    }

    const durationMs = this.voteDurationSeconds * 1000;
    
    this.activeVote = {
      target: targetUser,
      initiator: initiator,
      votes: new Set(),
      startTime: Date.now(),
      expiresAt: Date.now() + durationMs,
    };

    logger.info(`Vote démarré pour ${targetUser} par ${initiator} (${this.voteDurationSeconds}s)`);

    // Fin automatique du vote après la durée définie
    const timeout = setTimeout(() => {
      logger.info(
        `Le vote pour ${targetUser} a expiré (${this.activeVote.votes.size}/${this.threshold} votes)`
      );
      this.endVote(false);
    }, durationMs);

    this.voteTimeouts.set(targetUser, timeout);

    return { success: true, duration: this.voteDurationSeconds };
  }

  /**
   * Ajouter un vote d'un utilisateur
   * @param {string} username - Nom d'utilisateur votant
   * @returns {Object} - { votes, threshold, isMet }
   */
  addVote(username) {
    if (!this.activeVote) {
      return { votes: 0, threshold: this.threshold, isMet: false };
    }

    // Empêcher les votes en doublon du même utilisateur
    if (this.activeVote.votes.has(username)) {
      logger.debug(`${username} a déjà voté, doublon ignoré`);
      return {
        votes: this.activeVote.votes.size,
        threshold: this.threshold,
        isMet: false,
      };
    }

    this.activeVote.votes.add(username);
    const voteCount = this.activeVote.votes.size;
    const isMet = voteCount >= this.threshold;

    logger.info(
      `Vote ajouté : ${voteCount}/${this.threshold} pour ${this.activeVote.target}`
    );

    return { votes: voteCount, threshold: this.threshold, isMet };
  }

  /**
   * Vérifier si le seuil est atteint
   * @returns {boolean}
   */
  isThresholdMet() {
    if (!this.activeVote) return false;
    return this.activeVote.votes.size >= this.threshold;
  }

  /**
   * Obtenir l'état du vote actuel
   * @returns {Object|null} - Informations de vote actuelles ou null s'il n'y a pas de vote actif
   */
  getVoteStatus() {
    if (!this.activeVote) return null;

    return {
      target: this.activeVote.target,
      votes: this.activeVote.votes.size,
      threshold: this.threshold,
      percentage: Math.round(
        (this.activeVote.votes.size / this.threshold) * 100
      ),
      voters: Array.from(this.activeVote.votes),
    };
  }

  /**
   * Terminer le vote actuel (succès ou échec)
   * @param {boolean} success - Si le vote a réussi
   * @returns {Object|null} - Résultat du vote ou null
   */
  endVote(success) {
    if (!this.activeVote) return null;

    const result = {
      target: this.activeVote.target,
      initiator: this.activeVote.initiator,
      votes: this.activeVote.votes.size,
      threshold: this.threshold,
      success: success,
      reason: success ? 'Seuil atteint' : 'Vote expiré',
    };

    // Effacer le délai d'attente
    const timeout = this.voteTimeouts.get(this.activeVote.target);
    if (timeout) {
      clearTimeout(timeout);
      this.voteTimeouts.delete(this.activeVote.target);
    }

    this.activeVote = null;
    return result;
  }

  /**
   * Annuler le vote actuel
   * @returns {boolean} - True si le vote a été annulé
   */
  cancelVote() {
    if (!this.activeVote) return false;

    logger.info(`Vote pour ${this.activeVote.target} annulé`);
    const timeout = this.voteTimeouts.get(this.activeVote.target);
    if (timeout) {
      clearTimeout(timeout);
      this.voteTimeouts.delete(this.activeVote.target);
    }

    this.activeVote = null;
    return true;
  }

  /**
   * Vérifier si un vote est actuellement actif
   * @returns {boolean}
   */
  hasActiveVote() {
    return this.activeVote !== null;
  }
}

module.exports = VoteManager;

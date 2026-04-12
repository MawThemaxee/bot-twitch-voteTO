/**
 * Gestionnaire de commandes pour les commandes de chat
 * Analyse et distribue les commandes comme !votban, !yes, !no, !votestatus
 */

const logger = require('./logger');

class CommandHandler {
  constructor(context) {
    this.context = context; // voteManager, client, config, etc.
    this.commands = this.setupCommands();
  }

  /**
   * Configurer les commandes disponibles
   * @returns {Object} - Carte des gestionnaires de commandes
   */
  setupCommands() {
    return {
      '!votban': this.handleVotban.bind(this),
      '!yes': this.handleYes.bind(this),
      '!no': this.handleNo.bind(this),
      '!votestatus': this.handleVoteStatus.bind(this),
      '!cancelvote': this.handleCancelVote.bind(this),
    };
  }

  /**
   * Analyser et exécuter la commande
   * @param {string} username - Utilisateur exécutant la commande
   * @param {string} text - Message de chat
   * @param {Object} userstate - État de l'utilisateur avec badges, etc.
   * @returns {string|null} - Réponse à envoyer au chat
   */
  parse(username, text, userstate) {
    // Extraire la commande et les arguments
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (!this.commands[command]) {
      return null; // Commande non reconnue
    }

    logger.debug(`Commande : ${command} de ${username}`, args);

    try {
      return this.commands[command](username, args, userstate);
    } catch (error) {
      logger.error(`Erreur lors de l'exécution de la commande ${command}`, error);
      return 'Une erreur est survenue lors de l\'exécution de cette commande.';
    }
  }

  /**
   * Gérer la commande !votban <nom d'utilisateur>
   * Initie un vote pour interdire un utilisateur
   */
  handleVotban(username, args, userstate) {
    if (args.length === 0) {
      return 'Utilisation : !votban @nom_d\'utilisateur';
    }

    const targetUser = args[0].replace('@', '').toLowerCase();

    if (targetUser === username.toLowerCase()) {
      return 'Vous ne pouvez pas voter pour vous interdire.';
    }

    if (this.context.voteManager.hasActiveVote()) {
      const status = this.context.voteManager.getVoteStatus();
      return `Un vote est déjà actif pour ${status.target}. Utilisez !cancelvote pour annuler.`;
    }

    const result = this.context.voteManager.startVote(targetUser, username);

    if (!result.success) {
      return result.error || `Impossible de démarrer le vote pour ${targetUser}.`;
    }

    return `Vote démarré pour interdire ${targetUser} ! (${result.duration}s) Tapez !yes pour voter pour l'interdiction (besoin de ${this.context.config.voteThreshold} votes).`;
  }

  /**
   * Gérer la commande !yes
   * Voter en faveur de l'interdiction
   */
  handleYes(username, args, userstate) {
    if (!this.context.voteManager.hasActiveVote()) {
      return;
    }

    const result = this.context.voteManager.addVote(username);

    if (!result.isMet) {
      return `Vote enregistré ! ${result.votes}/${result.threshold} votes nécessaires.`;
    }

    // Seuil atteint!
    const voteResult = this.context.voteManager.endVote(true);
    const targetUser = voteResult.target;
    const banDuration = this.context.config.banDurationMinutes * 60; // Convertir en secondes

    // Exécuter le délai d'expiration via l'API Twitch
    this.context.client.timeout(
      targetUser,
      banDuration,
      `${this.context.config.banReason} (${voteResult.votes} votes)`
    );

    const banMsg = `Le chat a voté pour interdire ${targetUser} pendant ${this.context.config.banDurationMinutes} minutes !`;
    logger.info(
      `Interdiction exécutée : ${targetUser} par ${voteResult.initiator} (${voteResult.votes} votes)`
    );

    return banMsg;
  }

  /**
   * Gérer la commande !no
   * Voter contre l'interdiction
   */
  handleNo(username, args, userstate) {
    if (!this.context.voteManager.hasActiveVote()) {
      return;
    }

    // Pour l'instant, !no reconnaît simplement la commande
    // Fonctionnalité étendue : pourrait compter les votes contre et annuler le vote si le seuil est élevé
    return 'Vote contre l\'interdiction enregistré.';
  }

  /**
   * Gérer la commande !votestatus
   * Afficher l'état du vote actuel
   */
  handleVoteStatus(username, args, userstate) {
    const status = this.context.voteManager.getVoteStatus();

    if (!status) {
      return 'Aucun vote actif.';
    }

    return `Vote pour ${status.target} : ${status.votes}/${status.threshold} votes (${status.percentage}%)`;
  }

  /**
   * Gérer la commande !cancelvote
   * Annuler le vote actuel (modérateurs uniquement)
   */
  handleCancelVote(username, args, userstate) {
    const isMod = this.context.client.isModerator(userstate);
    if (!isMod) {
      return 'Seuls les modérateurs peuvent annuler les votes.';
    }

    const cancelled = this.context.voteManager.cancelVote();

    if (!cancelled) {
      return 'Aucun vote actif à annuler.';
    }

    return 'Vote annulé par le modérateur.';
  }

}

module.exports = CommandHandler;

/**
 * Point d'entrée du bot de vote-pour-interdiction Twitch
 * Logique bot principale qui relie le client, le gestionnaire de vote et les commandes
 */

const TwitchClient = require('./src/client');
const CommandHandler = require('./src/commands');
const VoteManager = require('./src/voteManager');
const logger = require('./src/logger');
const { config, validateConfig } = require('./src/config');
const idFetcher = require('./src/idFetcher');

class TwitchVoteBotError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TwitchVoteBotError';
  }
}

/**
 * Classe du bot principal
 */
class TwitchVoteBot {
  constructor() {
    // Valider d'abord la configuration
    const errors = validateConfig();
    if (errors.length > 0) {
      errors.forEach((error) => logger.error(error));
      throw new TwitchVoteBotError('Validation de la configuration échouée');
    }

    logger.info('Initialisation du bot de vote Twitch');

    // Initialiser les composants
    this.config = config;
    this.voteManager = new VoteManager(
      config.voteThreshold,
      config.banDurationMinutes,
      config.voteDurationSeconds
    );
    this.client = new TwitchClient(config);
    this.commandHandler = null; // Initialiser après que le client soit prêt
  }

  /**
   * Démarrer le bot
   */
  async start() {
    try {
      logger.info('Démarrage du bot...');

      // Récupérer automatiquement les IDs si nécessaire
      logger.info('Vérification de la configuration des IDs...');
      const ids = await idFetcher.initializeIds(this.config);
      
      if (ids.broadcasterId && ids.moderatorId) {
        // Mettre à jour la config avec les IDs récupérés
        this.config.broadcasterId = ids.broadcasterId;
        this.config.moderatorId = ids.moderatorId;
        logger.info(`✓ IDs configurés - Broadcaster: ${ids.broadcasterId}, Moderator: ${ids.moderatorId}`);
      } else {
        logger.warn('⚠ IDs non disponibles - Certaines fonctionnalités peuvent ne pas fonctionner');
      }

      // Se connecter à Twitch
      await this.client.connect();

      // Initialiser le gestionnaire de commandes avec le contexte
      this.commandHandler = new CommandHandler({
        client: this.client,
        voteManager: this.voteManager,
        config: this.config,
      });

      // Enregistrer le gestionnaire de messages
      this.client.onMessageReceived((messageData) => {
        this.handleChatMessage(messageData);
      });

      logger.info('Bot démarré avec succès');
    } catch (error) {
      logger.error('Erreur lors du démarrage du bot', error);
      throw error;
    }
  }

  /**
   * Gérer les messages de chat entrants
   * @param {Object} messageData - { username, message, userstate, isModerator, isBroadcaster }
   */
  handleChatMessage(messageData) {
    const { username, message, userstate } = messageData;

    // Vérifier si le message est une commande
    if (!message.startsWith('!')) {
      return;
    }

    logger.debug(`Traitement de la commande potentielle : ${message}`);

    try {
      const response = this.commandHandler.parse(username, message, userstate);

      if (response) {
        logger.info(`Envoi de la réponse à ${username} : ${response}`);
        this.client.chat(response);
      }
    } catch (error) {
      logger.error('Erreur lors du traitement du message', error);
      this.client.chat('Une erreur est survenue lors du traitement de votre commande.');
    }
  }

  /**
   * Arrêter gracieusement le bot
   */
  async shutdown() {
    logger.info('Arrêt du bot...');
    if (this.client) {
      await this.client.disconnect();
    }
    logger.info('Bot arrêté avec succès');
  }
}

/**
 * Point d'entrée principal
 */
async function main() {
  try {
    const bot = new TwitchVoteBot();
    await bot.start();

    // Gérer l'arrêt gracieux
    process.on('SIGINT', async () => {
      logger.info('SIGINT reçu, arrêt en cours...');
      await bot.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM reçu, arrêt en cours...');
      await bot.shutdown();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Erreur fatale', error);
    process.exit(1);
  }
}

// Exécuter si c'est le module principal
if (require.main === module) {
  main().catch((error) => {
    logger.error('Erreur non gérée dans main', error);
    process.exit(1);
  });
}

module.exports = TwitchVoteBot;

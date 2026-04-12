/**
 * Client de chat Twitch utilisant tmi.js
 * Gère la connexion au chat Twitch et l'analyse des messages
 */

const tmi = require('tmi.js');
const logger = require('./logger');
const { config } = require('./config');

class TwitchClient {
  constructor(options = {}) {
    this.config = { ...config, ...options };
    this.client = null;
    this.connected = false;
    this.messageHandlers = [];
  }

  /**
   * Se connecter au chat Twitch
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      logger.info(`Connexion à Twitch en tant que ${this.config.botUsername}`);

      this.client = new tmi.client({
        options: {
          debug: this.config.debug,
          messagesLogLevel: this.config.debug ? 'info' : 'warn',
        },
        connection: {
          reconnect: true,
          secure: true,
        },
        identity: {
          username: this.config.botUsername,
          password: this.config.oauthToken,
        },
        channels: [this.config.channel],
      });

      // Enregistrer les gestionnaires d'événements
      this.client.on('connected', this.onConnected.bind(this));
      this.client.on('disconnected', this.onDisconnected.bind(this));
      this.client.on('message', this.onMessage.bind(this));
      this.client.on('messagedeleted', this.onMessageDeleted.bind(this));
      this.client.on('timeout', this.onTimeout.bind(this));
      this.client.on('ban', this.onBan.bind(this));

      await this.client.connect();
      logger.info('Demande de connexion envoyée, en attente de confirmation...');
    } catch (error) {
      logger.error('Erreur lors de la connexion à Twitch', error);
      throw error;
    }
  }

  /**
   * Gérer la connexion réussie
   */
  onConnected() {
    this.connected = true;
    logger.info(`✓ Connecté au chat Twitch en tant que ${this.config.botUsername}`);
    logger.info(`✓ Surveillance du canal: #${this.config.channel}`);
  }

  /**
   * Gérer la déconnexion
   */
  onDisconnected(reason) {
    this.connected = false;
    logger.warn(`Déconnecté de Twitch : ${reason}`);
  }

  /**
   * Gérer le message de chat entrant
   * @param {string} channel - Nom du canal
   * @param {Object} userstate - Informations utilisateur (badges, couleur, etc.)
   * @param {string} message - Texte du message
   * @param {boolean} self - Si le message provient du bot lui-même
   */
  onMessage(channel, userstate, message, self) {
    // Ignorer les messages du bot
    if (self) return;

    const username = userstate['display-name'] || userstate.username;
    logger.debug(`Message du chat de ${username} : ${message}`);

    // Déclencher les gestionnaires
    this.messageHandlers.forEach((handler) => {
      handler({
        username,
        message,
        userstate,
        isModerator: this.isModerator(userstate),
        isBroadcaster: userstate['room-id'] === userstate['user-id'],
      });
    });
  }

  /**
   * Gérer les messages supprimés
   */
  onMessageDeleted(channel, username, deletedMessage, userstate) {
    logger.info(`Message supprimé de ${username} : ${deletedMessage}`);
  }

  /**
   * Gérer le délai d'expiration de l'utilisateur
   */
  onTimeout(channel, username, reason, duration) {
    logger.info(`${username} a un délai d'expiration de ${duration}s : ${reason}`);
  }

  /**
   * Gérer l'interdiction d'utilisateur
   */
  onBan(channel, username, reason, userstate) {
    logger.info(`${username} est interdit : ${reason}`);
  }

  /**
   * Envoyer un message de chat
   * @param {string} message - Message à envoyer
   */
  async chat(message) {
    if (!this.connected) {
      logger.warn('Non connecté à Twitch, impossible d\'envoyer un message');
      return;
    }

    try {
      await this.client.say(this.config.channel, message);
      logger.debug(`Message envoyé : ${message}`);
    } catch (error) {
      logger.error('Erreur lors de l\'envoi du message', error);
    }
  }

  /**
   * Vérifier si l'utilisateur est modérateur
   * @param {Object} userstate - État de l'utilisateur de tmi.js
   * @returns {boolean}
   */
  isModerator(userstate) {
    // Vérifier les badges du modérateur ou du statut de diffuseur
    if (!userstate.badges) return false;

    const isMod = userstate.badges.moderator === '1';
    const isBroadcaster = userstate.badges.broadcaster === '1';

    return isMod || isBroadcaster;
  }

  /**
   * Enregistrer un gestionnaire pour les messages de chat
   * @param {Function} handler - Fonction à appeler pour chaque message
   */
  onMessageReceived(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Interdire un utilisateur
   * @param {string} username - Nom d'utilisateur à interdire
   * @param {string} reason - Raison de l'interdiction
   * @returns {Promise<void>}
   */
  async ban(username, reason = '') {
    if (!this.connected) {
      logger.warn('Non connecté, impossible d\'interdire l\'utilisateur');
      return;
    }

    try {
      await this.client.ban(this.config.channel, username, reason);
      logger.info(`${username} est interdit : ${reason}`);
    } catch (error) {
      logger.error(`Erreur lors de l'interdiction de ${username}`, error);
    }
  }

  /**
   * Mettre en délai d'attente un utilisateur
   * @param {string} username - Nom d'utilisateur à mettre en délai
   * @param {number} duration - Durée en secondes
   * @param {string} reason - Raison du délai d'attente
   * @returns {Promise<void>}
   */
  async timeout(username, duration, reason = '') {
    if (!this.connected) {
      logger.warn('Non connecté, impossible de mettre l\'utilisateur en délai');
      return;
    }

    try {
      await this.client.timeout(
        this.config.channel,
        username,
        duration,
        reason
      );
      logger.info(`${username} a un délai d'expiration de ${duration}s : ${reason}`);
    } catch (error) {
      logger.error(`Erreur lors de la mise en délai de ${username}`, error);
    }
  }

  /**
   * Déconnecter de Twitch
   */
  async disconnect() {
    if (this.client) {
      logger.info('Déconnexion de Twitch');
      await this.client.disconnect();
      this.client = null;
      this.connected = false;
    }
  }
}

module.exports = TwitchClient;

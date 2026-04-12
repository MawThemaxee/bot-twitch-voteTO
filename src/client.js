/**
 * Client de chat Twitch utilisant ws (WebSocket)
 * Gère la connexion au chat Twitch et l'analyse des messages IRC
 */

const WebSocket = require('ws');
const logger = require('./logger');
const { config } = require('./config');

class TwitchClient {
  constructor(options = {}) {
    this.config = { ...config, ...options };
    this.ws = null;
    this.connected = false;
    this.messageHandlers = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  /**
   * Se connecter au chat Twitch via WebSocket
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Connexion à Twitch en tant que ${this.config.botUsername}`);

        const wsUrl = 'wss://irc-ws.chat.twitch.tv:443';
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          logger.debug('WebSocket ouvert, envoi de l\'authentification');
          this.sendIRC(`CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands`);
          this.sendIRC(`PASS ${this.config.oauthToken}`);
          this.sendIRC(`NICK ${this.config.botUsername}`);
          this.sendIRC(`JOIN #${this.config.channel}`);
        });

        this.ws.on('message', (data) => {
          this.onRawMessage(data.toString());
        });

        this.ws.on('error', (error) => {
          logger.error('Erreur WebSocket', error);
          this.handleReconnect(reject);
        });

        this.ws.on('close', () => {
          this.connected = false;
          logger.warn('WebSocket fermé');
          this.handleReconnect(reject);
        });

        // Attendre la connexion avec un timeout
        const timeout = setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Délai de connexion dépassé'));
          }
        }, 5000);

        setTimeout(() => clearTimeout(timeout), 5000);
        resolve();
      } catch (error) {
        logger.error('Erreur lors de la connexion', error);
        reject(error);
      }
    });
  }

  /**
   * Envoyer une commande IRC
   */
  sendIRC(command) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(command + '\r\n');
      logger.debug(`IRC envoyé : ${command}`);
    }
  }

  /**
   * Gérer la reconnexion automatique
   */
  handleReconnect(reject) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      logger.warn(`Reconnexion dans ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch((error) => {
          logger.error('Erreur lors de la reconnexion', error);
          if (reject) reject(error);
        });
      }, delay);
    } else {
      logger.error('Dépassement du nombre de tentatives de reconnexion');
      if (reject) reject(new Error('Impossible de se reconnecter à Twitch'));
    }
  }

  /**
   * Traiter les messages IRC bruts
   */
  onRawMessage(data) {
    const lines = data.split('\r\n').filter(line => line.length > 0);

    lines.forEach((line) => {
      if (line === 'PING :tmi.twitch.tv') {
        this.sendIRC('PONG :tmi.twitch.tv');
        return;
      }

      // Parser le message IRC
      const message = this.parseIRC(line);
      if (!message) return;

      // Gérer différents types de messages
      if (message.command === '001') {
        // Connexion réussie
        this.connected = true;
        this.reconnectAttempts = 0;
        this.onConnected();
      } else if (message.command === 'PRIVMSG') {
        this.onMessage(message);
      }
    });
  }

  /**
   * Parser un message IRC
   */
  parseIRC(line) {
    try {
      let tags = {};
      let source = null;
      let command = null;
      let parameters = [];

      let offset = 0;

      // Parser les tags
      if (line[0] === '@') {
        const nextSpace = line.indexOf(' ');
        const rawTags = line.slice(1, nextSpace).split(';');
        rawTags.forEach((tag) => {
          const [key, value] = tag.split('=');
          tags[key] = value;
        });
        offset = nextSpace + 1;
      }

      // Parser la source et la commande
      if (line[offset] === ':') {
        const nextSpace = line.indexOf(' ', offset);
        source = line.slice(offset + 1, nextSpace);
        offset = nextSpace + 1;
      }

      const nextSpace = line.indexOf(' ', offset);
      if (nextSpace === -1) {
        command = line.slice(offset);
      } else {
        command = line.slice(offset, nextSpace);
        offset = nextSpace + 1;

        // Parser les paramètres
        if (offset < line.length) {
          if (line[offset] === ':') {
            parameters = [line.slice(offset + 1)];
          } else {
            const parts = line.slice(offset).split(' :');
            parameters = parts[0].split(' ').concat(parts.slice(1));
          }
        }
      }

      return { tags, source, command, parameters };
    } catch (error) {
      logger.debug(`Erreur lors du parsing IRC : ${error.message}`);
      return null;
    }
  }

  /**
   * Gérer la connexion réussie
   */
  onConnected() {
    logger.info(`✓ Connecté au chat Twitch en tant que ${this.config.botUsername}`);
    logger.info(`✓ Surveillance du canal : #${this.config.channel}`);
  }

  /**
   * Gérer les messages de chat
   */
  onMessage(ircMessage) {
    const { tags, source, parameters } = ircMessage;
    const username = source.split('!')[0];
    const message = parameters[1];
    const channel = parameters[0];

    logger.debug(`Message de ${username} : ${message}`);

    // Déclencher les gestionnaires
    this.messageHandlers.forEach((handler) => {
      handler({
        username,
        message,
        userstate: tags,
        isModerator: this.isModerator(tags),
        isBroadcaster: this.isBroadcaster(tags),
        channel,
      });
    });
  }

  /**
   * Vérifier si l'utilisateur est modérateur
   */
  isModerator(tags) {
    if (!tags.badges) return false;
    const badgesStr = tags.badges;
    return badgesStr.includes('moderator/1') || badgesStr.includes('broadcaster/1');
  }

  /**
   * Vérifier si l'utilisateur est le diffuseur
   */
  isBroadcaster(tags) {
    if (!tags.badges) return false;
    return tags.badges.includes('broadcaster/1');
  }

  /**
   * Envoyer un message de chat
   */
  async chat(message) {
    if (!this.connected) {
      logger.warn('Non connecté à Twitch, impossible d\'envoyer un message');
      return;
    }

    try {
      this.sendIRC(`PRIVMSG #${this.config.channel} :${message}`);
      logger.debug(`Message envoyé : ${message}`);
    } catch (error) {
      logger.error('Erreur lors de l\'envoi du message', error);
    }
  }

  /**
   * Enregistrer un gestionnaire pour les messages de chat
   */
  onMessageReceived(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Interdire un utilisateur
   */
  async ban(username, reason = '') {
    if (!this.connected) {
      logger.warn('Non connecté, impossible d\'interdire l\'utilisateur');
      return;
    }

    try {
      const msg = reason ? `/ban ${username} ${reason}` : `/ban ${username}`;
      this.sendIRC(`PRIVMSG #${this.config.channel} :${msg}`);
      logger.info(`${username} est interdit : ${reason}`);
    } catch (error) {
      logger.error(`Erreur lors de l'interdiction de ${username}`, error);
    }
  }

  /**
   * Mettre en délai d'attente un utilisateur
   */
  async timeout(username, duration, reason = '') {
    if (!this.connected) {
      logger.warn('Non connecté, impossible de mettre l\'utilisateur en délai');
      return;
    }

    try {
      const msg = reason 
        ? `/timeout ${username} ${duration} ${reason}` 
        : `/timeout ${username} ${duration}`;
      this.sendIRC(`PRIVMSG #${this.config.channel} :${msg}`);
      logger.info(`${username} a un délai d'expiration de ${duration}s : ${reason}`);
    } catch (error) {
      logger.error(`Erreur lors de la mise en délai de ${username}`, error);
    }
  }

  /**
   * Déconnecter de Twitch
   */
  async disconnect() {
    if (this.ws) {
      logger.info('Déconnexion de Twitch');
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }
}

module.exports = TwitchClient;

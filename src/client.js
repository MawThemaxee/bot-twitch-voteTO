/**
 * Client de chat Twitch utilisant ws (WebSocket)
 * Gère la connexion au chat Twitch et l'analyse des messages IRC
 */

const WebSocket = require('ws');
const https = require('https');
const logger = require('./logger');
const { config } = require('./config');

class TwitchClient {
  constructor(options = {}) {
    // Stocker une référence au config (pas une copie) pour que les mises à jour ultérieures soient visibles
    this.config = options || config;
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
   * Interdire un utilisateur via l'API Helix
   */
  async ban(username, reason = '') {
    if (!this.connected) {
      logger.warn('Non connecté, impossible d\'interdire l\'utilisateur');
      return;
    }

    if (!this.config.broadcasterId || !this.config.moderatorId || !this.config.clientId) {
      logger.error('Configuration manquante pour l\'API Helix (broadcasterId, moderatorId, clientId)');
      return;
    }

    try {
      // D'abord, obtenir l'ID de l'utilisateur
      const userId = await this.getUserId(username);
      if (!userId) {
        logger.error(`Impossible de trouver l'ID utilisateur pour ${username}`);
        return;
      }

      // Puis interdire l'utilisateur
      const postData = JSON.stringify({
        data: {
          user_id: userId,
          reason: reason || `Interdit par le bot`
        }
      });

      const options = {
        hostname: 'api.twitch.tv',
        path: `/helix/moderation/bans?broadcaster_id=${this.config.broadcasterId}&moderator_id=${this.config.moderatorId}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.oauthToken.replace('oauth:', '')}`,
          'Client-ID': this.config.clientId,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            logger.info(`${username} a été interdit : ${reason}`);
          } else {
            logger.error(`Erreur interdiction ${username}: ${res.statusCode} - ${data}`);
          }
        });
      });

      req.on('error', (error) => {
        logger.error(`Erreur lors de l'interdiction de ${username}`, error);
      });

      req.write(postData);
      req.end();
    } catch (error) {
      logger.error(`Erreur lors de l'interdiction de ${username}`, error);
    }
  }

  /**
   * Mettre en délai d'attente un utilisateur via l'API Helix
   */
  async timeout(username, duration, reason = '') {
    if (!this.connected) {
      logger.warn('Non connecté, impossible de mettre l\'utilisateur en délai');
      return;
    }

    if (!this.config.broadcasterId || !this.config.moderatorId || !this.config.clientId) {
      logger.error('Configuration manquante pour l\'API Helix (broadcasterId, moderatorId, clientId)');
      return;
    }

    try {
      // D'abord, obtenir l'ID de l'utilisateur
      const userId = await this.getUserId(username);
      if (!userId) {
        logger.error(`Impossible de trouver l'ID utilisateur pour ${username}`);
        return;
      }

      // Puis faire le timeout
      const postData = JSON.stringify({
        data: {
          user_id: userId,
          duration: duration,
          reason: reason || `Timeout du vote par le bot`
        }
      });

      const options = {
        hostname: 'api.twitch.tv',
        path: `/helix/moderation/bans?broadcaster_id=${this.config.broadcasterId}&moderator_id=${this.config.moderatorId}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.oauthToken.replace('oauth:', '')}`,
          'Client-ID': this.config.clientId,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            logger.info(`${username} a un délai d'expiration de ${duration}s : ${reason}`);
          } else {
            logger.error(`Erreur timeout ${username}: ${res.statusCode} - ${data}`);
          }
        });
      });

      req.on('error', (error) => {
        logger.error(`Erreur lors de la mise en délai de ${username}`, error);
      });

      req.write(postData);
      req.end();
    } catch (error) {
      logger.error(`Erreur lors de la mise en délai de ${username}`, error);
    }
  }

  /**
   * Obtenir l'ID d'un utilisateur via l'API Helix
   */
  async getUserId(username) {
    return new Promise((resolve) => {
      if (!this.config.clientId) {
        logger.error('Client ID manquant');
        resolve(null);
        return;
      }

      const options = {
        hostname: 'api.twitch.tv',
        path: `/helix/users?login=${username}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.oauthToken.replace('oauth:', '')}`,
          'Client-ID': this.config.clientId,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.data && response.data.length > 0) {
              resolve(response.data[0].id);
            } else {
              resolve(null);
            }
          } catch (error) {
            logger.error('Erreur parsing getUserId', error);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        logger.error('Erreur getUserId', error);
        resolve(null);
      });

      req.end();
    });
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

/**
 * Twitch WebSocket client
 * Handles TMI (Twitch Messaging Interface) connection and IRC protocol
 */

const WebSocket = require('ws');
const logger = require('./logger');
const { config } = require('./config');

class TwitchClient {
  constructor(options = {}) {
    this.config = { ...config, ...options };
    this.ws = null;
    this.reconnectAttempts = 0;
    this.connected = false;
    this.messageHandlers = [];
    this.commandHandlers = {};

    // Bind methods to preserve context
    this.connect = this.connect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.send = this.send.bind(this);
  }

  /**
   * Connect to Twitch TMI server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      logger.info(`Connecting to Twitch TMI at ${this.config.tmiServer}`);

      this.ws = new WebSocket(this.config.tmiServer);

      this.ws.on('open', () => {
        logger.info('WebSocket connected, authenticating...');
        this.authenticate();
        resolve();
      });

      this.ws.on('message', this.handleMessage);

      this.ws.on('error', (error) => {
        logger.error('WebSocket error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        if (this.connected) {
          logger.warn('WebSocket disconnected, attempting to reconnect...');
          this.connected = false;
          this.reconnect();
        }
      });
    });
  }

  /**
   * Reconnect with exponential backoff
   */
  reconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error(
        `Failed to reconnect after ${this.config.maxReconnectAttempts} attempts`
      );
      return;
    }

    this.reconnectAttempts += 1;
    const delay =
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect()
        .then(() => {
          this.reconnectAttempts = 0;
        })
        .catch((err) => {
          logger.error('Reconnection failed', err);
          this.reconnect();
        });
    }, delay);
  }

  /**
   * Authenticate with Twitch
   */
  authenticate() {
    this.send(`PASS ${this.config.oauthToken}`);
    this.send(`NICK ${this.config.botUsername}`);
    this.send(`JOIN #${this.config.channel}`);

    // Request messages, room state, and other metadata
    this.send('CAP REQ :twitch.tv/membership');
    this.send('CAP REQ :twitch.tv/tags');
    this.send('CAP REQ :twitch.tv/commands');

    logger.info(
      `Authenticating as ${this.config.botUsername} in #${this.config.channel}`
    );
  }

  /**
   * Send raw IRC message to Twitch
   * @param {string} message - IRC message to send
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket not ready, message not sent', message);
      return;
    }

    logger.debug(`Sending: ${message}`);
    this.ws.send(`${message}\r\n`);
  }

  /**
   * Send chat message to channel
   * @param {string} message - Chat message to send
   */
  chat(message) {
    this.send(`PRIVMSG #${this.config.channel} :${message}`);
  }

  /**
   * Handle incoming IRC messages
   * @param {Buffer} data - Raw message data
   */
  handleMessage(data) {
    const message = data.toString();
    logger.debug(`Received: ${message.trim()}`);

    // Split message into lines (can have multiple)
    const lines = message.split('\r\n').filter((line) => line.length > 0);

    lines.forEach((line) => {
      // Handle PING/PONG
      if (line.startsWith('PING')) {
        this.send(line.replace('PING', 'PONG'));
        logger.debug('Responded to PING with PONG');
        return;
      }

      // Handle successful login
      if (line.includes('001') && line.includes('Welcome')) {
        this.connected = true;
        logger.info('Successfully logged in to Twitch');
        return;
      }

      // Handle chat messages (PRIVMSG)
      if (line.includes('PRIVMSG')) {
        const parsed = this.parseMessage(line);
        if (parsed) {
          logger.debug(`Chat message from ${parsed.username}: ${parsed.text}`);
          this.messageHandlers.forEach((handler) => handler(parsed));
        }
        return;
      }

      // Handle other messages (NOTICE, USERNOTICE, etc.)
      if (this.config.debug) {
        logger.debug(`IRC message: ${line}`);
      }
    });
  }

  /**
   * Parse IRC message to extract username and text
   * @param {string} raw - Raw IRC message
   * @returns {Object|null} { username, text } or null if not parseable
   */
  parseMessage(raw) {
    // Match format: :username!user@host PRIVMSG #channel :message text
    const match = raw.match(/:(\w+)!.*PRIVMSG #\w+ :(.+)/);
    if (match) {
      return {
        username: match[1],
        text: match[2],
      };
    }
    return null;
  }

  /**
   * Register a handler for chat messages
   * @param {Function} handler - Function to call for each message
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Disconnect from Twitch
   */
  disconnect() {
    if (this.ws) {
      logger.info('Disconnecting from Twitch');
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }
}

module.exports = TwitchClient;

/**
 * Twitch Vote-to-Ban Bot Entry Point
 * Main bot logic that ties together client, vote manager, and commands
 */

const TwitchClient = require('./src/client');
const CommandHandler = require('./src/commands');
const VoteManager = require('./src/voteManager');
const logger = require('./src/logger');
const { config, validateConfig } = require('./src/config');

class TwitchVoteBotError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TwitchVoteBotError';
  }
}

/**
 * Main bot class
 */
class TwitchVoteBot {
  constructor() {
    // Validate configuration first
    const errors = validateConfig();
    if (errors.length > 0) {
      errors.forEach((error) => logger.error(error));
      throw new TwitchVoteBotError('Configuration validation failed');
    }

    logger.info('Initializing Twitch Vote Bot');

    // Initialize components
    this.config = config;
    this.voteManager = new VoteManager(
      config.voteThreshold,
      config.banDurationMinutes
    );
    this.client = new TwitchClient(config);
    this.commandHandler = null; // Initialize after client is ready
  }

  /**
   * Start the bot
   */
  async start() {
    try {
      logger.info('Starting bot...');

      // Connect to Twitch
      await this.client.connect();

      // Initialize command handler with context
      this.commandHandler = new CommandHandler({
        client: this.client,
        voteManager: this.voteManager,
        config: this.config,
      });

      // Register message handler
      this.client.onMessage((parsedMessage) => {
        this.handleChatMessage(parsedMessage);
      });

      logger.info('Bot started successfully');
    } catch (error) {
      logger.error('Failed to start bot', error);
      throw error;
    }
  }

  /**
   * Handle incoming chat messages
   * @param {Object} parsedMessage - { username, text }
   */
  handleChatMessage(parsedMessage) {
    const { username, text } = parsedMessage;

    // Check if message is a command
    if (!text.startsWith('!')) {
      return;
    }

    logger.debug(`Processing potential command: ${text}`);

    try {
      const response = this.commandHandler.parse(username, text);

      if (response) {
        logger.info(`Sending response to ${username}: ${response}`);
        this.client.chat(response);
      }
    } catch (error) {
      logger.error('Error handling message', error);
      this.client.chat('An error occurred processing your command.');
    }
  }

  /**
   * Gracefully shutdown the bot
   */
  shutdown() {
    logger.info('Shutting down bot...');
    if (this.client) {
      this.client.disconnect();
    }
    logger.info('Bot shutdown complete');
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const bot = new TwitchVoteBot();
    await bot.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down...');
      bot.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down...');
      bot.shutdown();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Fatal error', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error in main', error);
    process.exit(1);
  });
}

module.exports = TwitchVoteBot;

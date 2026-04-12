/**
 * Configuration loader for Twitch bot
 * Loads environment variables with fallback defaults
 */

require('dotenv').config();

const config = {
  // Twitch credentials
  channel: process.env.TWITCH_CHANNEL || 'testchannel',
  botUsername: process.env.TWITCH_BOT_USERNAME || 'testbot',
  oauthToken: process.env.TWITCH_OAUTH_TOKEN || 'oauth:test',

  // Vote configuration
  voteThreshold: parseInt(process.env.VOTE_THRESHOLD || '3', 10),
  banDurationMinutes: parseInt(process.env.BAN_DURATION_MINUTES || '5', 10),

  // Server configuration
  tmiServer: 'wss://irc-ws.chat.twitch.tv:443',
  reconnectDelay: parseInt(process.env.RECONNECT_DELAY || '3000', 10),
  maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '10', 10),

  // Debug mode
  debug: process.env.DEBUG === 'true',
};

// Validate required config
const validateConfig = () => {
  const errors = [];

  if (!config.channel || config.channel === 'testchannel') {
    errors.push('TWITCH_CHANNEL environment variable is required');
  }
  if (!config.botUsername || config.botUsername === 'testbot') {
    errors.push('TWITCH_BOT_USERNAME environment variable is required');
  }
  if (!config.oauthToken || config.oauthToken === 'oauth:test') {
    errors.push('TWITCH_OAUTH_TOKEN environment variable is required');
  }

  return errors;
};

module.exports = {
  config,
  validateConfig,
};

/**
 * Chargeur de configuration pour le bot Twitch
 * Charge les variables d'environnement avec des valeurs par défaut
 */

require('dotenv').config();

const config = {
  // Identifiants Twitch
  channel: process.env.TWITCH_CHANNEL || 'testchannel',
  botUsername: process.env.TWITCH_BOT_USERNAME || 'testbot',
  oauthToken: process.env.TWITCH_OAUTH_TOKEN || 'oauth:test',

  // Configuration du vote
  voteThreshold: parseInt(process.env.VOTE_THRESHOLD || '3', 10),
  banDurationMinutes: parseInt(process.env.BAN_DURATION_MINUTES || '5', 10),
  voteDurationSeconds: parseInt(process.env.VOTE_DURATION_SECONDS || '60', 10),

  // Mode débogage
  debug: process.env.DEBUG === 'true',
};

// Valider la configuration requise
const validateConfig = () => {
  const errors = [];

  if (!config.channel || config.channel === 'testchannel') {
    errors.push('La variable d\'environnement TWITCH_CHANNEL est requise');
  }
  if (!config.botUsername || config.botUsername === 'testbot') {
    errors.push('La variable d\'environnement TWITCH_BOT_USERNAME est requise');
  }
  if (!config.oauthToken || config.oauthToken === 'oauth:test') {
    errors.push('La variable d\'environnement TWITCH_OAUTH_TOKEN est requise');
  }

  return errors;
};

module.exports = {
  config,
  validateConfig,
};

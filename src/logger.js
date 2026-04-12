/**
 * Utilitaire de journalisation pour le bot Twitch
 * Fournit la journalisation INFO, WARN, ERROR avec horodatages
 */

const { config } = require('./config');

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
};

const timestamp = () => new Date().toISOString();

const logger = {
  /**
   * Enregistrer les messages d'information
   * @param {string} message
   * @param {any} data - Données supplémentaires facultatives à enregistrer
   */
  info: (message, data = null) => {
    const prefix = `${colors.cyan}[INFO]${colors.reset} ${timestamp()}`;
    const msg = data ? `${message} ${JSON.stringify(data)}` : message;
    console.log(`${prefix} ${msg}`);
  },

  /**
   * Enregistrer les messages d'avertissement
   * @param {string} message
   * @param {any} data - Données supplémentaires facultatives à enregistrer
   */
  warn: (message, data = null) => {
    const prefix = `${colors.yellow}[AVERTISSEMENT]${colors.reset} ${timestamp()}`;
    const msg = data ? `${message} ${JSON.stringify(data)}` : message;
    console.warn(`${prefix} ${msg}`);
  },

  /**
   * Enregistrer les messages d'erreur
   * @param {string} message
   * @param {Error|any} error - Objet erreur ou données supplémentaires
   */
  error: (message, error = null) => {
    const prefix = `${colors.red}[ERREUR]${colors.reset} ${timestamp()}`;
    let errorStr = '';
    if (error) {
      if (error instanceof Error) {
        errorStr = ` ${error.message}`;
        if (config.debug && error.stack) {
          errorStr += `\n${error.stack}`;
        }
      } else {
        errorStr = ` ${JSON.stringify(error)}`;
      }
    }
    console.error(`${prefix} ${message}${errorStr}`);
  },

  /**
   * Enregistrer les messages de débogage (seulement si DEBUG=true)
   * @param {string} message
   * @param {any} data - Données supplémentaires facultatives à enregistrer
   */
  debug: (message, data = null) => {
    if (!config.debug) return;
    const prefix = `${colors.green}[DÉBOGAGE]${colors.reset} ${timestamp()}`;
    const msg = data ? `${message} ${JSON.stringify(data)}` : message;
    console.log(`${prefix} ${msg}`);
  },
};

module.exports = logger;

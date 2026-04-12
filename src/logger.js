/**
 * Logger utility for Twitch bot
 * Provides INFO, WARN, ERROR logging with timestamps
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
   * Log info messages
   * @param {string} message
   * @param {any} data - Optional additional data to log
   */
  info: (message, data = null) => {
    const prefix = `${colors.cyan}[INFO]${colors.reset} ${timestamp()}`;
    const msg = data ? `${message} ${JSON.stringify(data)}` : message;
    console.log(`${prefix} ${msg}`);
  },

  /**
   * Log warning messages
   * @param {string} message
   * @param {any} data - Optional additional data to log
   */
  warn: (message, data = null) => {
    const prefix = `${colors.yellow}[WARN]${colors.reset} ${timestamp()}`;
    const msg = data ? `${message} ${JSON.stringify(data)}` : message;
    console.warn(`${prefix} ${msg}`);
  },

  /**
   * Log error messages
   * @param {string} message
   * @param {Error|any} error - Optional error object or additional data
   */
  error: (message, error = null) => {
    const prefix = `${colors.red}[ERROR]${colors.reset} ${timestamp()}`;
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
   * Log debug messages (only if DEBUG=true)
   * @param {string} message
   * @param {any} data - Optional additional data to log
   */
  debug: (message, data = null) => {
    if (!config.debug) return;
    const prefix = `${colors.green}[DEBUG]${colors.reset} ${timestamp()}`;
    const msg = data ? `${message} ${JSON.stringify(data)}` : message;
    console.log(`${prefix} ${msg}`);
  },
};

module.exports = logger;

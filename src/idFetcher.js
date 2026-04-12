/**
 * Récupérateur d'ID Twitch
 * Récupère automatiquement les IDs broadcaster et moderator via l'API Helix
 * Les stocke en cache pour éviter les appels API répétés
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const CACHE_FILE = path.join(__dirname, '..', '.ids.json');

/**
 * Charger les IDs depuis le cache
 */
const loadFromCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cached = JSON.parse(data);
      logger.info('IDs chargés depuis le cache');
      return cached;
    }
  } catch (error) {
    logger.warn('Erreur lors de la lecture du cache des IDs', error.message);
  }
  return null;
};

/**
 * Sauvegarder les IDs dans le cache
 */
const saveToCache = (broadcasterId, moderatorId) => {
  try {
    const cache = { broadcasterId, moderatorId, timestamp: new Date().toISOString() };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    logger.info('IDs sauvegardés en cache');
  } catch (error) {
    logger.warn('Erreur lors de la sauvegarde du cache des IDs', error.message);
  }
};

/**
 * Récupérer l'ID utilisateur depuis l'API Twitch
 */
const getUserId = (username, oauthToken, clientId) => {
  return new Promise((resolve) => {
    if (!clientId || !oauthToken) {
      logger.error('CLIENT_ID ou OAUTH_TOKEN manquant');
      resolve(null);
      return;
    }

    const options = {
      hostname: 'api.twitch.tv',
      path: `/helix/users?login=${encodeURIComponent(username)}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${oauthToken.replace('oauth:', '')}`,
        'Client-ID': clientId,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            if (response.data && response.data.length > 0) {
              const id = response.data[0].id;
              logger.info(`ID trouvé pour ${username}: ${id}`);
              resolve(id);
            } else {
              logger.error(`Utilisateur non trouvé: ${username}`);
              resolve(null);
            }
          } else {
            logger.error(`Erreur API (${res.statusCode}): ${data}`);
            resolve(null);
          }
        } catch (error) {
          logger.error('Erreur parsing getUserId', error.message);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      logger.error('Erreur réseau getUserId', error.message);
      resolve(null);
    });

    req.end();
  });
};

/**
 * Récupérer les IDs broadcaster et moderator automatiquement
 */
const fetchIds = async (channel, botUsername, oauthToken, clientId) => {
  logger.info('Récupération automatique des IDs Twitch...');

  // Vérifier le cache d'abord
  const cached = loadFromCache();
  if (cached && cached.broadcasterId && cached.moderatorId) {
    logger.info('Utilisation des IDs en cache');
    return {
      broadcasterId: cached.broadcasterId,
      moderatorId: cached.moderatorId,
    };
  }

  // Récupérer les IDs si pas en cache
  logger.info(`Récupération de l'ID du diffuseur: ${channel}`);
  const broadcasterId = await getUserId(channel, oauthToken, clientId);

  if (!broadcasterId) {
    logger.error(`Impossible de récupérer l'ID du diffuseur pour ${channel}`);
    return { broadcasterId: null, moderatorId: null };
  }

  logger.info(`Récupération de l'ID du modérateur: ${botUsername}`);
  const moderatorId = await getUserId(botUsername, oauthToken, clientId);

  if (!moderatorId) {
    logger.error(`Impossible de récupérer l'ID du modérateur pour ${botUsername}`);
    return { broadcasterId, moderatorId: null };
  }

  // Sauvegarder en cache
  saveToCache(broadcasterId, moderatorId);

  return { broadcasterId, moderatorId };
};

/**
 * Initialiser et retourner les IDs
 */
const initializeIds = async (config) => {
  // Si les IDs sont déjà configurés via .env, les utiliser
  if (config.broadcasterId && config.moderatorId) {
    logger.info('IDs trouvés dans les variables d\'environnement');
    return {
      broadcasterId: config.broadcasterId,
      moderatorId: config.moderatorId,
    };
  }

  // Sinon, les récupérer automatiquement
  if (!config.clientId) {
    logger.error('TWITCH_CLIENT_ID non configuré. Impossible de récupérer les IDs automatiquement.');
    logger.info('Configurez TWITCH_CLIENT_ID dans votre fichier .env ou fournissez les IDs manuellement.');
    return {
      broadcasterId: config.broadcasterId || null,
      moderatorId: config.moderatorId || null,
    };
  }

  try {
    const ids = await fetchIds(
      config.channel,
      config.botUsername,
      config.oauthToken,
      config.clientId
    );

    if (ids.broadcasterId && ids.moderatorId) {
      logger.info('✓ IDs récupérés et mis en cache automatiquement');
    } else {
      logger.error('✗ Erreur lors de la récupération des IDs');
    }

    return ids;
  } catch (error) {
    logger.error('Erreur lors de la récupération des IDs', error.message);
    return {
      broadcasterId: config.broadcasterId || null,
      moderatorId: config.moderatorId || null,
    };
  }
};

/**
 * Effacer le cache
 */
const clearCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      logger.info('Cache des IDs supprimé');
    }
  } catch (error) {
    logger.error('Erreur lors de la suppression du cache', error.message);
  }
};

module.exports = {
  fetchIds,
  initializeIds,
  loadFromCache,
  saveToCache,
  clearCache,
};

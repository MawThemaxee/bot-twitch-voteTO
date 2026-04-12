#!/usr/bin/env node

/**
 * Générateur de jeton OAuth simple pour un bot Twitch
 * Approche manuelle - l'utilisateur copie le code depuis le navigateur
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCÈS]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[AVERTISSEMENT]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERREUR]${colors.reset} ${msg}`),
};

/**
 * Échanger le code d'autorisation contre un jeton d'accès
 */
function exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
  return new Promise((resolve, reject) => {
    // Format en tant que x-www-form-urlencoded (PAS JSON!)
    const postData = `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&code=${encodeURIComponent(code)}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const options = {
      hostname: 'id.twitch.tv',
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
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
          if (response.access_token) {
            resolve(response.access_token);
          } else if (response.status === 400) {
            reject(new Error(`Erreur : ${response.message}`));
          } else {
            reject(new Error(`Aucun jeton d'accès dans la réponse : ${data}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Enregistrer la configuration dans le fichier .env
 */
function saveEnvFile(config) {
  const envPath = path.join(__dirname, '.env');
  const content = `# Configuration du bot Twitch
# Générée par setup-oauth-simple.js

TWITCH_CHANNEL=${config.channel}
TWITCH_BOT_USERNAME=${config.botUsername}
TWITCH_OAUTH_TOKEN=oauth:${config.token}
BAN_DURATION_MINUTES=${config.banDuration}
VOTE_THRESHOLD=${config.voteThreshold}
DEBUG=${config.debug}
`;

  fs.writeFileSync(envPath, content);
  log.success(`Fichier .env créé à ${envPath}`);
}

/**
 * Flux de configuration principal
 */
async function main() {
  console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}
${colors.cyan}║      Bot de vote Twitch - Configuration OAuth simple      ║${colors.reset}
${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}
`);

  try {
    const clientId = await question(
      `${colors.yellow}Entrez votre identifiant client Twitch :${colors.reset} `
    );
    const clientSecret = await question(
      `${colors.yellow}Entrez votre secret client Twitch :${colors.reset} `
    );
    const channel = await question(
      `${colors.yellow}Entrez le nom de votre canal Twitch (sans #) :${colors.reset} `
    );
    const botUsername = await question(
      `${colors.yellow}Entrez le nom d'utilisateur du bot (votre compte ou un compte de bot) :${colors.reset} `
    );

    // Construire l'URL d'autorisation
    const redirectUri = 'http://localhost:3000';
    const scopes = 'chat:read%20chat:edit%20channel:moderate';
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;

    log.info('Ouverture de l\'URL d\'autorisation dans votre navigateur...');
    console.log(`\n${colors.yellow}Copiez cette URL et ouvrez-la dans votre navigateur :${colors.reset}`);
    console.log(authUrl);
    console.log(`\n${colors.green}Étapes :${colors.reset}`);
    console.log('1. Cliquez sur le lien ci-dessus ou collez-le dans votre navigateur');
    console.log('2. Cliquez sur "Autoriser" sur la page Twitch');
    console.log('3. Vous serez redirigé vers http://localhost:3000?code=xxx');
    console.log('4. Copiez le code de l\'URL (la partie après "code=")');
    console.log('5. Collez-le ci-dessous\n');

    const code = await question(
      `${colors.yellow}Collez le code d'autorisation :${colors.reset} `
    );

    if (!code) {
      log.error('Aucun code fourni');
      process.exit(1);
    }

    log.info('Échange du code contre un jeton...');
    const token = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

    log.success('Jeton obtenu avec succès !');

    const banDuration = await question(
      `${colors.yellow}Durée de l'interdiction en minutes (par défaut 5) :${colors.reset} `
    );
    const voteThreshold = await question(
      `${colors.yellow}Seuil de vote (par défaut 3) :${colors.reset} `
    );
    const debug = await question(
      `${colors.yellow}Activer le mode débogage ? (true/false, par défaut false) :${colors.reset} `
    );

    const config = {
      token: token.replace('oauth:', ''),
      channel: channel.toLowerCase(),
      botUsername: botUsername.toLowerCase(),
      banDuration: banDuration || '5',
      voteThreshold: voteThreshold || '3',
      debug: debug === 'true' ? 'true' : 'false',
    };

    saveEnvFile(config);

    log.success('Configuration terminée ! 🎉');
    console.log(`
${colors.green}Votre bot est prêt à être utilisé !${colors.reset}

Prochaines étapes :
1. Exécutez : ${colors.cyan}npm run dev${colors.reset}
2. Le bot se connectera à votre canal Twitch
3. Essayez de taper : ${colors.cyan}!help${colors.reset}

Assurez-vous que votre compte de bot est modérateur dans votre canal !
`);

    rl.close();
  } catch (error) {
    log.error(`La configuration a échoué : ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

// Exécuter la configuration
main();

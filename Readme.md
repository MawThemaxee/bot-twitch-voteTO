# Bot Twitch de vote pour interdiction temporaire

Un bot Twitch qui permet aux utilisateurs de voter pour des interdictions temporaires dans un chat Twitch. Le bot écoute des commandes spécifiques dans le chat et compte les votes pour interdire temporairement un utilisateur. Le bot peut être configuré pour définir la durée de l'interdiction temporaire et le seuil de votes requis pour exécuter l'interdiction.

## Fonctionnalités

- Écoute les commandes spécifiques dans le chat Twitch pour initier un vote pour une interdiction temporaire.
- Compte les votes des utilisateurs dans le chat et exécute une interdiction temporaire si le seuil est atteint.
- Durée de l'interdiction et seuil de vote configurables.

## Installation

1. Clonez le référentiel ou téléchargez le code source.
2. Accédez au répertoire du projet et installez les dépendances avec npm :
   ```bash
   npm install
   ```

## Utilisation
0. ````bash
   cp .env.example .env
   npm install
   ````
1. Créez un fichier `.env` à la racine du projet et ajoutez les variables d'environnement nécessaires (voir le fichier `.env.example` pour référence).

2. **Configuration API Helix (Facile !)** :
      
   Vous n'avez besoin que de :
   - **TWITCH_CLIENT_ID** : Obtenez-le de la [Twitch Developer Console](https://dev.twitch.tv/console/apps) ou sur [Twitch Token Generator](https://twitchtokengenerator.com/).

   - **TWITCH_BROADCASTER_ID** : Par défaut, le bot récupère automatiquement l'ID du diffuseur (broadcaster) à partir du nom de la chaîne configuré dans `TWITCH_CHANNEL`. Vous n'avez pas besoin de le fournir manuellement.

   - **TWITCH_MODERATOR_ID** : Par défaut, le bot récupère automatiquement l'ID du modérateur à partir du nom d'utilisateur du bot configuré dans `TWITCH_BOT_USERNAME`. Vous n'avez pas besoin de le fournir manuellement.
   
   Les autres IDs sont récupérés automatiquement et mis en cache pour les prochains démarrages..

3. Créez un compte Twitch pour votre bot et obtenez un OAuth Token pour ce compte. Vous pouvez utiliser des outils en ligne comme [Twitch Token Generator](https://twitchtokengenerator.com/) pour générer un token avec les scopes nécessaires.
   
   **Scopes requis** : `chat:read`, `chat:edit`, `channel:moderate`

4. Démarrez le bot en mode développement (avec redémarrage automatique) :
   ```bash
   npm run dev
   ```
   
   Au premier démarrage, le bot va récupérer et mettre en cache vos IDs automatiquement ! 🚀

5. Dans le chat de votre chaîne Twitch, utilisez la commande `!votban @nom_d'utilisateur` pour initier un vote pour interdire temporairement un utilisateur. Les autres utilisateurs peuvent voter avec `!yes` ou `!no`.
6. Utilisez `!votestatus` pour afficher l'état actuel du vote.

7. Web Overlay : Si vous avez activé le serveur web dans la configuration, vous pouvez accéder à l'overlay de vote en ouvrant `http://localhost:3000/` dans votre navigateur. Vous pouvez intégrer cet overlay dans votre logiciel de streaming avec l'URL de votre machine qui sera affichée dans la console au démarrage du serveur web.

## Dépendances
- `nodejs` : Un environnement d'exécution JavaScript côté serveur version 14 ou supérieure.
- `nodemon` : Un utilitaire qui redémarre automatiquement l'application Node quand des changements de fichiers sont détectés
- `ws` : Une bibliothèque WebSocket pour se connecter au server IRC de Twitch.
- `dotenv` : Un module sans dépendances qui charge les variables d'environnement d'un fichier .env dans process.env.

## Configuration

Vous pouvez configurer le bot en modifiant les variables dans votre fichier `.env` :

| Variable | Description | Défaut |
|----------|-------------|--------|
| `TWITCH_CHANNEL` | Nom du canal Twitch | - (requis) |
| `TWITCH_BOT_USERNAME` | Nom d'utilisateur du bot | - (requis) |
| `TWITCH_OAUTH_TOKEN` | Token OAuth du bot | - (requis) |
| `TWITCH_CLIENT_ID` | Client ID Twitch | - (requis pour API Helix) |
| `TWITCH_BROADCASTER_ID` | ID du diffuseur Twitch | - (requis pour API Helix) |
| `TWITCH_MODERATOR_ID` | ID du modérateur Twitch | - (requis pour API Helix) |
| `WEB_SERVER_ENABLED` | Activer le serveur web pour l'overlay (true/false) | `false` |
| `WEB_SERVER_PORT` | Port du serveur web | `3000` |
| `WEB_SERVER_HOST` | Hôte du serveur web | `0.0.0.0` |
| `BAN_DURATION_MINUTES` | Durée du timeout en minutes | `5` |
| `BAN_REASON` | Raison du timeout affichée dans Twitch | `Vote pour interdiction` |
| `VOTE_THRESHOLD` | Nombre de votes nécessaires pour exécuter le ban | `3` |
| `VOTE_DURATION_SECONDS` | Durée du vote en secondes | `60` |
| `DEBUG` | Activer le mode débogage (true/false) | `false` |
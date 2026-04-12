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

1. Créez un fichier `.env` à la racine du projet et ajoutez les variables d'environnement nécessaires (voir le fichier `.env.example` pour référence).
2. creez un compte Twitch pour votre bot et obtenez un OAuth Token pour ce compte. Vous pouvez utiliser des outils en ligne comme [Twitch Token Generator](https://twitchtokengenerator.com/) pour générer un token avec les scopes nécessaires (généralement `chat:edit` et `chat:read`).
3. Déployer le OAuth Token pour votre bot Twitch en utilisant le script `setup-oauth-simple.js` :
   ```bash
   npm run setup
   ```
4. Démarrez le bot en mode développement (avec redémarrage automatique) :
   ```bash
   npm run dev
   ```
5. Dans le chat de votre chaîne Twitch, utilisez la commande `!votban @nom_d'utilisateur` pour initier un vote pour interdire temporairement un utilisateur. Les autres utilisateurs peuvent voter avec `!yes` ou `!no`.
6. Utilisez `!votestatus` pour afficher l'état actuel du vote.

## Dépendances

- `nodemon` : Un utilitaire qui redémarre automatiquement l'application Node quand des changements de fichiers sont détectés
- `tmi.js` : Une bibliothèque pour interagir avec l'API de Twitch, permettant de créer des bots de chat Twitch.
- `dotenv` : Un module sans dépendances qui charge les variables d'environnement d'un fichier .env dans process.env.
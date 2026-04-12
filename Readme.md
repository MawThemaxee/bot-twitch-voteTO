# Bot Twitch to vote form ban temp
This is a Twitch bot that allows users to vote for temporary bans in a Twitch chat. The bot listens for specific commands in the chat and tallies votes for banning a user temporarily. The bot can be configured to set the duration of the temporary ban and the threshold of votes required to execute the ban.
## Features
- Listens for specific commands in Twitch chat to initiate a vote for a temporary ban.
- Tallies votes from users in the chat and executes a temporary ban if the threshold is met.
- Configurable ban duration and vote threshold.

## Installation
1. Clone the repository or download the source code.
2. Navigate to the project directory and install the dependencies using npm:
   ```bash
   npm install
   ```
## Usage
1. Configure the bot by setting up the necessary environment variables (e.g., Twitch API credentials).
2. Start the bot using the following command:
   ```bash
   npm start
   ```
3. The bot will connect to the Twitch chat and listen for commands to initiate votes for temporary bans.

## Dependencies
- `nodemon`: A utility that automatically restarts the node application when file changes are detected
- `ws`: A WebSocket library for Node.js to handle real-time communication with Twitch chat.
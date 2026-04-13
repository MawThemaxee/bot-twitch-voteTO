/**
 * Serveur HTTP pour afficher la page HTML et gérer les WebSocket
 * Permet l'affichage de l'overlay de vote sur le stream via OBS
 */

const http = require('http');
const fs = require('path');
const path = require('path');
const WebSocket = require('ws');
const logger = require('./logger');

class WebServer {
  constructor(port = 3000) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.currentVoteState = null;
  }

  /**
   * Démarrer le serveur HTTP et WebSocket
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        // Créer le serveur HTTP
        this.server = http.createServer((req, res) => {
          this.handleRequest(req, res);
        });

        // Créer le serveur WebSocket
        this.wss = new WebSocket.Server({ server: this.server });

        this.wss.on('connection', (ws) => {
          this.handleWebSocketConnection(ws);
        });

        // Démarrer le serveur
        this.server.listen(this.port, '0.0.0.0', () => {
          const os = require('os');
          const interfaces = os.networkInterfaces();
          let localIP = 'localhost';
          
          // Trouver l'adresse IP locale
          for (const name of Object.keys(interfaces)) {
            const iface = interfaces[name].find(addr => addr.family === 'IPv4' && !addr.internal);
            if (iface) {
              localIP = iface.address;
              break;
            }
          }
          
          logger.info(`✓ Serveur web démarré`);
          logger.info(`  - Localhost: http://localhost:${this.port}`);
          logger.info(`  - OBS Browser Source: http://${localIP}:${this.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Erreur du serveur HTTP', error);
          reject(error);
        });
      } catch (error) {
        logger.error('Erreur lors du démarrage du serveur', error);
        reject(error);
      }
    });
  }

  /**
   * Gérer les requêtes HTTP
   */
  handleRequest(req, res) {
    if (req.url === '/' || req.url === '/index.html') {
      // Servir la page HTML
      const htmlPath = path.join(__dirname, '..', 'html', 'overlay.html');
      
      try {
        const html = require('fs').readFileSync(htmlPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch (error) {
        logger.error('Erreur de lecture du fichier HTML', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Erreur 500 - Serveur interne');
      }
    } else if (req.url === '/style.css') {
      // Servir le CSS
      const cssPath = path.join(__dirname, '..', 'html', 'style.css');
      
      try {
        const css = require('fs').readFileSync(cssPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
        res.end(css);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('CSS non trouvé');
      }
    } else if (req.url === '/script.js') {
      // Servir le JS
      const jsPath = path.join(__dirname, '..', 'html', 'script.js');
      
      try {
        const js = require('fs').readFileSync(jsPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(js);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('JS non trouvé');
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 - Non trouvé');
    }
  }

  /**
   * Gérer les connexions WebSocket
   */
  handleWebSocketConnection(ws) {
    logger.debug('Nouvelle connexion WebSocket');
    this.clients.add(ws);

    // Envoyer l'état actuel au client
    if (this.currentVoteState) {
      ws.send(JSON.stringify({
        type: 'voteState',
        data: this.currentVoteState
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'voteState',
        data: {
          active: false,
          target: null,
          votes: 0,
          threshold: 0,
          timeLeft: 0
        }
      }));
    }

    ws.on('close', () => {
      this.clients.delete(ws);
      logger.debug('Connexion WebSocket fermée');
    });

    ws.on('error', (error) => {
      logger.error('Erreur WebSocket', error);
      this.clients.delete(ws);
    });
  }

  /**
   * Mettre à jour l'état du vote et notifier tous les clients
   */
  broadcastVoteState(voteState) {
    this.currentVoteState = voteState;

    const message = JSON.stringify({
      type: 'voteState',
      data: voteState
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Arrêter le serveur
   */
  stop() {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close();
      }
      if (this.server) {
        this.server.close(() => {
          logger.info('Serveur web arrêté');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = WebServer;

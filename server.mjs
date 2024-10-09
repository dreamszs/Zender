import { createServer } from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { performance } from 'node:perf_hooks'; // For uptime calculation

// Set up the Express app
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(__dirname + '/public'));

// Create HTTP server using Express
const server = createServer(app);

// Create a WebSocket server
const wss = new WebSocketServer({ server });

let activeUsers = {};  // Stores UUID: { username, lastChanged }
let connectedClients = {};  // Stores active WebSocket connections
const serverStartTime = performance.now(); // Server start time

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000; // 2 weeks in milliseconds

// Helper function to calculate uptime
function getUptime() {
    const uptimeMilliseconds = performance.now() - serverStartTime;
    const uptimeSeconds = Math.floor((uptimeMilliseconds / 1000) % 60);
    const uptimeMinutes = Math.floor((uptimeMilliseconds / 1000 / 60) % 60);
    const uptimeHours = Math.floor((uptimeMilliseconds / 1000 / 60 / 60) % 24);
    const uptimeDays = Math.floor(uptimeMilliseconds / 1000 / 60 / 60 / 24);
    return `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`;
}

// Broadcast function to send a message to all clients
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// WebSocket message handler
wss.on('connection', (ws) => {
    ws.uuid = null;  // Initialize UUID for new client
    connectedClients[ws] = true;

    // Send current user count and uptime to all connected clients
    broadcast({ type: 'user-count', count: Object.keys(connectedClients).length });
    broadcast({ type: 'uptime', uptime: getUptime() });

    ws.on('message', (data) => {
        try {
            const messageData = JSON.parse(data);
            const { uuid, username, type } = messageData;

            if (type === 'message') {
                // Broadcast message to all clients
                broadcast({ type: 'message', content: `${username}: ${messageData.content}` });
            } else if (type === 'username-check') {
                const now = Date.now();

                if (!activeUsers[uuid]) {
                    // New user, allow them to set the username if it's not taken
                    if (Object.values(activeUsers).some(user => user.username === username)) {
                        ws.send(JSON.stringify({ type: 'username-taken' }));
                    } else {
                        activeUsers[uuid] = { username, lastChanged: now };
                        ws.uuid = uuid; // Store the user's UUID with the connection
                        ws.send(JSON.stringify({ type: 'username-accepted', username }));
                    }
                } else {
                    const { lastChanged } = activeUsers[uuid];
                    const timeSinceLastChange = now - lastChanged;

                    if (timeSinceLastChange < TWO_WEEKS) {
                        ws.send(JSON.stringify({ type: 'username-change-restricted' }));
                    } else if (Object.values(activeUsers).some(user => user.username === username)) {
                        ws.send(JSON.stringify({ type: 'username-taken' }));
                    } else {
                        activeUsers[uuid] = { username, lastChanged: now };
                        ws.send(JSON.stringify({ type: 'username-accepted', username }));
                    }
                }
            } else if (type === 'get-info') {
                // Send online users and uptime
                ws.send(JSON.stringify({ type: 'user-count', count: Object.keys(connectedClients).length }));
                ws.send(JSON.stringify({ type: 'uptime', uptime: getUptime() }));
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        delete connectedClients[ws];  // Remove disconnected client
        broadcast({ type: 'user-count', count: Object.keys(connectedClients).length });  // Update online user count
    });
});

// Start the server on port 8080
server.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});

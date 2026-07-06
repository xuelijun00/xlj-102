const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const { setBroadcast } = require('./utils/broadcast');

if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'subscribe') {
        ws.role = data.role;
        ws.userId = data.userId;
      }
    } catch (e) {
      console.error('WebSocket message parse error:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

const broadcast = (event) => {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(event));
    }
  });
};

setBroadcast(broadcast);

const authRoutes = require('./routes/auth');
const sampleRoutes = require('./routes/samples');
const userRoutes = require('./routes/users');

app.use('/api/auth', authRoutes);
app.use('/api/samples', sampleRoutes);
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

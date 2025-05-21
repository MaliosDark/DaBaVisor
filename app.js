// app.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const generateMermaid = require('./server/mermaidGenerator');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

require('./server/socket')(io);

app.use(express.static('public'));

app.get('/diagram', async (req, res) => {
  const diagrams = await generateMermaid();
  res.json(diagrams);
});


server.listen(3070, () => {
  console.log('Server running on http://localhost:3070');
});
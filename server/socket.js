const generateMermaid = require('./mermaidGenerator');

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('Client connected');

    setInterval(async () => {
      const diagram = await generateMermaid();
      socket.emit('updateDiagram', diagram);
    }, 5000);
  });
};
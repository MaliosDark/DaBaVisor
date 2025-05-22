// server/socket.js

const { createClient: createRedisClient } = require('redis');
const { Client: PgClient } = require('pg');
const configs = require('./db/connections');
const generateMermaid = require('./mermaidGenerator');

module.exports = function(io) {
  // Emit full diagrams
  async function emitAll() {
    try {
      const diagrams = await generateMermaid();
      io.emit('updateDiagram', diagrams);
      console.log(`Emitted updateDiagram with ${diagrams.length} diagrams: ${diagrams.map(d => d.name).join(', ')}`);
    } catch (e) {
      console.error('Error generating diagrams:', e);
    }
  }

  // Emit a single-edge flow event
  function emitFlow(name, from, to) {
    console.log(`Emitting dataFlow: ${name}, ${from} --> ${to}`);
    setTimeout(() => {
      io.emit('dataFlow', { name, from, to });
    }, 1000); // 1000ms delay
  }

  // Redis keyspace notifications
  configs.filter(c => c.type === 'redis').forEach(cfg => {
    (async () => {
      try {
        const sub = createRedisClient({ socket: { host: cfg.host, port: cfg.port } });
        await sub.connect();
        await sub.configSet('notify-keyspace-events', 'KEA');
        await sub.pSubscribe('__keyevent@0__:*', async (message) => {
          console.log(`Received Redis key event: ${message}`);
          await emitAll();

          // Parse Redis key
          const parts = message.split(':');
          const agent = parts[0];
          const subkey = parts.slice(1).join(':');
          const name = `${cfg.name}/${agent}`;
          const from = `${cfg.name}_${agent}_core`;

          // Skip invalid keys
          if (!subkey || subkey === agent || parts.length < 2) {
            console.warn(`Skipping invalid key: ${message} (no valid subkey)`);
            return;
          }

          // Match nodeId from mermaidGenerator.js
          const to = `${cfg.name}_${message.replace(/[:]/g, '_')}`;
          emitFlow(name, from, to);
        });
        console.log(`✅ Redis listener on ${cfg.name}`);
      } catch (err) {
        console.warn(`⚠️ Redis listener failed for ${cfg.name}:`, err.message);
      }
    })();
  });

  // Postgres LISTEN/NOTIFY (unchanged)
  configs.filter(c => c.type === 'postgres').forEach(cfg => {
    (async () => {
      const pg = new PgClient(cfg);
      try {
        await pg.connect();
        await pg.query('LISTEN table_update');
        pg.on('notification', async msg => {
          await emitAll();
          const [tbl, col] = msg.payload.split(':');
          const name = `${cfg.name}/${tbl}`;
          const from = `${cfg.name}_${tbl}`;
          const to = `${cfg.name}_${tbl}_${col}`;
          emitFlow(name, from, to);
        });
        console.log(`✅ Postgres listener on ${cfg.name}`);
      } catch (err) {
        console.warn(`⚠️ Postgres listener failed for ${cfg.name}:`, err.message);
      }
    })();
  });

  // Fallback polling
  setInterval(emitAll, 5000);

  io.on('connection', async socket => {
    console.log('Client connected:', socket.id);
    await emitAll();
  });
};
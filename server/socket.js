// server/socket.js

const { createClient: createRedisClient } = require('redis');
const { Client: PgClient } = require('pg');
const configs = require('./db/connections');
const generateMermaid = require('./mermaidGenerator');

module.exports = function(io) {
  // 1) Emit full diagrams to everyone
  async function emitAll() {
    try {
      const diagrams = await generateMermaid();
      io.emit('updateDiagram', diagrams);
    } catch (e) {
      console.error('Error generating diagrams:', e);
    }
  }

  // 2) Emit single‐edge flow events
  function emitFlow(name, from, to) {
    io.emit('dataFlow', { name, from, to });
  }

  // Setup Redis keyspace notifications
  configs.filter(c => c.type === 'redis').forEach(cfg => {
    (async () => {
      try {
        const sub = createRedisClient({ socket: { host: cfg.host, port: cfg.port } });
        await sub.connect();
        await sub.configSet('notify-keyspace-events', 'KEA');
        await sub.pSubscribe('__keyevent@0__:*', async (message) => {
          // full refresh
          await emitAll();
          // live‐flow parse
          const [agent, ...rest] = message.split(':');
          const name = `${cfg.name}/${agent}`;
          const from = `${agent}_core`;
          const to   = `${agent}_${rest.join(':')}`;
          emitFlow(name, from, to);
        });
        console.log(`✅ Redis listener on ${cfg.name}`);
      } catch (err) {
        console.warn(`⚠️ Redis listener failed for ${cfg.name}:`, err.message);
      }
    })();
  });

  // Setup Postgres LISTEN/NOTIFY
  configs.filter(c => c.type === 'postgres').forEach(cfg => {
    (async () => {
      const pg = new PgClient(cfg);
      try {
        await pg.connect();
        await pg.query('LISTEN table_update'); // your DB trigger must NOTIFY table_update with payload "table:column"
        pg.on('notification', async msg => {
          await emitAll();
          // payload like "users:email"
          const [tbl, col] = msg.payload.split(':');
          const name = `${cfg.name}/${tbl}`;
          const from = `${tbl}`;
          const to   = `${tbl}_${col}`;
          emitFlow(name, from, to);
        });
        console.log(`✅ Postgres listener on ${cfg.name}`);
      } catch (err) {
        console.warn(`⚠️ Postgres listener failed for ${cfg.name}:`, err.message);
      }
    })();
  });

  // Fallback polling every 5s
  setInterval(emitAll, 5000);

  // Immediately send snapshot on connect
  io.on('connection', async socket => {
    console.log('Client connected:', socket.id);
    await emitAll();
  });
};

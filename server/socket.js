// server/socket.js

const { createClient: createRedisClient } = require('redis');
const { Client: PgClient } = require('pg');
const configs = require('./db/connections');
const generateMermaid = require('./mermaidGenerator');

module.exports = function(io) {
  // emit full diagrams
  async function emitAll() {
    try {
      const diagrams = await generateMermaid();
      io.emit('updateDiagram', diagrams);
    } catch (e) {
      console.error('Error generating diagrams:', e);
    }
  }

  // emit a single-edge flow event
  function emitFlow(name, from, to) {
    io.emit('dataFlow', { name, from, to });
  }

  // Redis keyspace notifications
  configs.filter(c => c.type === 'redis').forEach(cfg => {
    (async () => {
      try {
        const sub = createRedisClient({ socket: { host: cfg.host, port: cfg.port } });
        await sub.connect();
        await sub.configSet('notify-keyspace-events', 'KEA');
        await sub.pSubscribe('__keyevent@0__:*', async (message) => {
          // full refresh
          await emitAll();

          // parse flow: e.g. "agent:key"
          const [agent, ...rest] = message.split(':');
          const name = `${cfg.name}/${agent}`;
          const from = `${cfg.name}_${agent}_core`;
          const to   = `${cfg.name}_${agent}_${rest.join(':')}`.replace(/[:]/g,'_');
          emitFlow(name, from, to);
        });
        console.log(`✅ Redis listener on ${cfg.name}`);
      } catch (err) {
        console.warn(`⚠️ Redis listener failed for ${cfg.name}:`, err.message);
      }
    })();
  });

  // Postgres LISTEN/NOTIFY
  configs.filter(c => c.type === 'postgres').forEach(cfg => {
    (async () => {
      const pg = new PgClient(cfg);
      try {
        await pg.connect();
        await pg.query('LISTEN table_update'); // payload: "table:column"
        pg.on('notification', async msg => {
          // full refresh
          await emitAll();

          const [tbl, col] = msg.payload.split(':');
          const name = `${cfg.name}/${tbl}`;
          const from = `${cfg.name}_${tbl}`;       // core node ID matches client
          const to   = `${cfg.name}_${tbl}_${col}`; // child node ID
          emitFlow(name, from, to);
        });
        console.log(`✅ Postgres listener on ${cfg.name}`);
      } catch (err) {
        console.warn(`⚠️ Postgres listener failed for ${cfg.name}:`, err.message);
      }
    })();
  });

  // fallback polling
  setInterval(emitAll, 5000);

  io.on('connection', async socket => {
    console.log('Client connected:', socket.id);
    await emitAll();
  });
};

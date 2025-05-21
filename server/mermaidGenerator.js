// server/MermaidGenerator.js

const getConnections = require('./db');

module.exports = async function generateMermaid() {
  const instances = await getConnections();
  const results = [];

  for (const { name: dbName, conn, type } of instances) {
    if (type === 'sqlite') {
      // fetch all tables
      const tables = await new Promise((res, rej) => {
        conn.all(
          "SELECT name FROM sqlite_master WHERE type='table'",
          [],
          (err, rows) => (err ? rej(err) : res(rows.map(r => r.name)))
        );
      });

      for (const table of tables) {
        // start a new graph for each table
        let diagram = 'graph TD\n';
        diagram += `  ${dbName}_${table}["${table} (${dbName})"]\n`;

        // fetch columns
        const columns = await new Promise((res, rej) => {
          conn.all(
            `PRAGMA table_info(${table})`,
            [],
            (err, rows) => (err ? rej(err) : res(rows))
          );
        });

        for (const col of columns) {
          diagram += `  ${dbName}_${table} --> ${dbName}_${table}_${col.name}["${col.name}: ${col.type}"]\n`;
        }

        results.push({
          name: `${dbName}/${table}`,
          diagram
        });
      }
    }

    if (type === 'redis') {
      // fetch all keys
      const keys = await conn.keys('*');
      const agentMap = {};

      // group keys by agent prefix
      for (const key of keys) {
        const [agent, ...rest] = key.split(':');
        const subkey = rest.join(':');
        if (!agentMap[agent]) agentMap[agent] = [];
        agentMap[agent].push({ fullKey: key, subkey });
      }

      // emit one graph per agent
      for (const agent of Object.keys(agentMap)) {
        let diagram = 'graph TD\n';
        const coreId = `${dbName}_${agent}_core`;
        diagram += `  ${coreId}["${agent} (core)"]\n`;

        for (const { fullKey, subkey } of agentMap[agent]) {
          const nodeId = `${dbName}_${fullKey.replace(/[:]/g, '_')}`;
          const keyType = await conn.type(fullKey);
          diagram += `  ${coreId} --> ${nodeId}["${subkey} (${keyType})"]\n`;

          if (keyType === 'hash') {
            const fields = await conn.hKeys(fullKey);
            for (const field of fields) {
              diagram += `  ${nodeId} --> ${nodeId}_${field}["${field}"]\n`;
            }
          } else if (keyType === 'list') {
            diagram += `  ${nodeId} --> ${nodeId}_list["List Items..."]\n`;
          } else if (keyType === 'string') {
            diagram += `  ${nodeId} --> ${nodeId}_val["Value"]\n`;
          } else if (keyType === 'set') {
            diagram += `  ${nodeId} --> ${nodeId}_set["Set Items..."]\n`;
          } else if (keyType === 'zset') {
            diagram += `  ${nodeId} --> ${nodeId}_zset["Sorted Set..."]\n`;
          }
        }

        results.push({
          name: `${dbName}/${agent}`,
          diagram
        });
      }
    }
  }

  return results;
};

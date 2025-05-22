// server/mermaidGenerator.js

const getConnections = require('./db');

// You can tweak this threshold to suit your typical graph sizes
const SMALL_DIAGRAM_THRESHOLD = 300; // characters

module.exports = async function generateMermaid() {
  const instances = await getConnections();
  const results = [];

  for (const { name: dbName, conn, type } of instances) {
    if (type === 'sqlite') {
      // Fetch all tables
      const tables = await new Promise((res, rej) => {
        conn.all(
          "SELECT name FROM sqlite_master WHERE type='table'",
          [],
          (err, rows) => (err ? rej(err) : res(rows.map(r => r.name)))
        );
      });

      for (const table of tables) {
        // Build one graph per table
        let diagram = 'graph TD\n';
        diagram += `  ${dbName}_${table}["${table} (${dbName})"]\n`;

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

        const isSmall = diagram.length < SMALL_DIAGRAM_THRESHOLD;
        results.push({
          name: `${dbName}/${table}`,
          diagram,
          isSmall
        });
      }
    }

    if (type === 'redis') {
      const keys = await conn.keys('*');
      const agentMap = {};

      for (const key of keys) {
        const [agent, ...rest] = key.split(':');
        const subkey = rest.join(':') || null; // Null if no subkey
        if (!subkey || subkey === agent) {
          console.warn(`Skipping key with no valid subkey in diagram: ${key}`);
          continue; // Skip keys like "nova001"
        }
        console.log(`Processing Redis key: ${key}, agent: ${agent}, subkey: ${subkey}`);
        if (!agentMap[agent]) agentMap[agent] = [];
        agentMap[agent].push({ fullKey: key, subkey });
      }

      for (const agent of Object.keys(agentMap)) {
        let diagram = 'graph TD\n';
        const coreId = `${dbName}_${agent}_core`;
        diagram += `  ${coreId}["${agent} (core)"]\n`;

        for (const { fullKey, subkey } of agentMap[agent]) {
          const nodeId = `${dbName}_${fullKey.replace(/[:]/g, '_')}`;
          const keyType = await conn.type(fullKey);
          diagram += `  ${coreId} --> ${nodeId}["${subkey} (${keyType})"]\n`;
          console.log(`Generated edge for ${dbName}/${agent}: ${coreId} --> ${nodeId}`);

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

        const isSmall = diagram.length < SMALL_DIAGRAM_THRESHOLD;
        results.push({
          name: `${dbName}/${agent}`,
          diagram,
          isSmall
        });
      }
    }
  }

  return results;
};
//server/db/index.js

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const { createClient } = require('redis');
const configs = require('./connections');

async function testSQLite(path) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path, (err) => {
      if (err) reject(err);
      else resolve({ conn: db, type: 'sqlite' });
    });
  });
}

async function testMySQL(config) {
  const conn = await mysql.createConnection(config);
  return { conn, type: 'mysql' };
}

async function testPostgres(config) {
  const client = new Client(config);
  await client.connect();
  return { conn: client, type: 'postgres' };
}

async function testRedis(config) {
  const client = createClient({ socket: { host: config.host, port: config.port } });
  await client.connect();
  return { conn: client, type: 'redis' };
}

async function getConnections() {
  const active = [];
  for (const cfg of configs) {
    try {
      if (cfg.type === 'sqlite') {
        const { conn, type } = await testSQLite(cfg.path);
        active.push({ name: cfg.name, conn, type });
      } else if (cfg.type === 'mysql') {
        const { conn, type } = await testMySQL(cfg);
        active.push({ name: cfg.name, conn, type });
      } else if (cfg.type === 'postgres') {
        const { conn, type } = await testPostgres(cfg);
        active.push({ name: cfg.name, conn, type });
      }
      else if (cfg.type === 'redis') {
        const { conn, type } = await testRedis(cfg);
        active.push({ name: cfg.name, conn, type });
      }
    } catch (e) {
      console.warn(`Skipped ${cfg.name}: ${e.message}`);
    }
  }
  return active;
}

module.exports = getConnections;
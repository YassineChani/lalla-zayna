/**
 * Storage layer for Maison LALLA ZAYNA.
 *
 *  - If DATABASE_URL is set  -> real PostgreSQL (Supabase / Neon / any Postgres).
 *  - Otherwise               -> local JSON files (dev only, NOT persistent on Vercel).
 *
 * Every collection is stored as JSONB documents so the existing data shapes
 * (products, orders, concierge requests, settings) are preserved unchanged.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'assets', 'uploads');

const MAX_ORDERS = 5000;
const MAX_CONCIERGE = 2000;

const DEFAULT_SETTINGS = {
  announcement: '✨ LIVRAISON MONDIALE EXPRESS OFFERTE DÈS 300€ — ÉCRIN CADEAU SIGNÉ INCLUS',
  phone: '+212 6 00 00 00 00',
  email: 'contact.lalazayna@gmail.com',
  freeShippingThresholdEUR: 300
};

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { /* fall through */ }
  return fallback;
}

/* ------------------------------------------------------------------ */
/*  JSON FILE BACKEND (local development)                              */
/* ------------------------------------------------------------------ */
function createFileStore() {
  const files = {
    products: path.join(DATA_DIR, 'products.json'),
    orders: path.join(DATA_DIR, 'orders.json'),
    concierge: path.join(DATA_DIR, 'concierge.json'),
    settings: path.join(DATA_DIR, 'settings.json')
  };
  const write = (key, value) => fs.writeFileSync(files[key], JSON.stringify(value, null, 2), 'utf8');

  return {
    kind: 'json-files',
    async init() {},

    async listProducts() { return readJson(files.products, []); },
    async insertProduct(p) { const l = readJson(files.products, []); l.unshift(p); write('products', l); },
    async updateProduct(p) {
      const l = readJson(files.products, []);
      const i = l.findIndex(x => x.id === p.id);
      if (i === -1) return false;
      l[i] = p; write('products', l); return true;
    },
    async deleteProduct(id) {
      const l = readJson(files.products, []);
      const n = l.filter(x => x.id !== id);
      if (n.length === l.length) return false;
      write('products', n); return true;
    },

    async listOrders() { return readJson(files.orders, []); },
    async getOrder(id) { return readJson(files.orders, []).find(o => o.orderId === id) || null; },
    async insertOrder(o) {
      const l = readJson(files.orders, []);
      l.unshift(o);
      write('orders', l.slice(0, MAX_ORDERS));
    },
    async updateOrder(o) {
      const l = readJson(files.orders, []);
      const i = l.findIndex(x => x.orderId === o.orderId);
      if (i === -1) return false;
      l[i] = o; write('orders', l); return true;
    },

    async listConcierge() { return readJson(files.concierge, []); },
    async insertConcierge(e) {
      const l = readJson(files.concierge, []);
      l.unshift(e);
      write('concierge', l.slice(0, MAX_CONCIERGE));
    },

    async getSettings() { return { ...DEFAULT_SETTINGS, ...readJson(files.settings, {}) }; },
    async saveSettings(s) { write('settings', s); },

    async saveUpload(name, mime, buffer) {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);
      return `/assets/uploads/${name}`;
    },
    async getUpload() { return null; } // served statically from /assets/uploads
  };
}

/* ------------------------------------------------------------------ */
/*  POSTGRES BACKEND (production)                                      */
/* ------------------------------------------------------------------ */
function createPgStore(pool) {
  const q = (text, params) => pool.query(text, params);

  return {
    kind: 'postgres',

    async init() {
      await q(`CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        position BIGINT NOT NULL,
        data JSONB NOT NULL
      )`);
      await q(`CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        data JSONB NOT NULL
      )`);
      await q(`CREATE TABLE IF NOT EXISTS concierge (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        data JSONB NOT NULL
      )`);
      await q(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL
      )`);
      await q(`CREATE TABLE IF NOT EXISTS uploads (
        name TEXT PRIMARY KEY,
        mime TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

      // Seed the catalogue the very first time (empty table only)
      const { rows } = await q('SELECT COUNT(*)::int AS n FROM products');
      if (rows[0].n === 0) {
        const seed = readJson(path.join(DATA_DIR, 'products.json'), []);
        for (let i = 0; i < seed.length; i++) {
          await q(
            'INSERT INTO products (id, position, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
            [seed[i].id, seed.length - i, JSON.stringify(seed[i])]
          );
        }
      }
    },

    async listProducts() {
      const { rows } = await q('SELECT data FROM products ORDER BY position DESC');
      return rows.map(r => r.data);
    },
    async insertProduct(p) {
      const { rows } = await q('SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM products');
      await q('INSERT INTO products (id, position, data) VALUES ($1, $2, $3)', [p.id, rows[0].pos, JSON.stringify(p)]);
    },
    async updateProduct(p) {
      const r = await q('UPDATE products SET data = $2 WHERE id = $1', [p.id, JSON.stringify(p)]);
      return r.rowCount > 0;
    },
    async deleteProduct(id) {
      const r = await q('DELETE FROM products WHERE id = $1', [id]);
      return r.rowCount > 0;
    },

    async listOrders() {
      const { rows } = await q('SELECT data FROM orders ORDER BY created_at DESC LIMIT $1', [MAX_ORDERS]);
      return rows.map(r => r.data);
    },
    async getOrder(id) {
      const { rows } = await q('SELECT data FROM orders WHERE order_id = $1', [id]);
      return rows[0] ? rows[0].data : null;
    },
    async insertOrder(o) {
      await q('INSERT INTO orders (order_id, created_at, data) VALUES ($1, $2, $3)',
        [o.orderId, o.createdAt || new Date().toISOString(), JSON.stringify(o)]);
    },
    async updateOrder(o) {
      const r = await q('UPDATE orders SET data = $2 WHERE order_id = $1', [o.orderId, JSON.stringify(o)]);
      return r.rowCount > 0;
    },

    async listConcierge() {
      const { rows } = await q('SELECT data FROM concierge ORDER BY created_at DESC LIMIT $1', [MAX_CONCIERGE]);
      return rows.map(r => r.data);
    },
    async insertConcierge(e) {
      await q('INSERT INTO concierge (id, created_at, data) VALUES ($1, $2, $3)',
        [e.id, e.createdAt || new Date().toISOString(), JSON.stringify(e)]);
    },

    async getSettings() {
      const { rows } = await q("SELECT data FROM settings WHERE key = 'site'");
      return { ...DEFAULT_SETTINGS, ...(rows[0] ? rows[0].data : {}) };
    },
    async saveSettings(s) {
      await q(
        `INSERT INTO settings (key, data) VALUES ('site', $1)
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`,
        [JSON.stringify(s)]
      );
    },

    // Images are kept in the database (base64) because Vercel's filesystem is read-only.
    async saveUpload(name, mime, buffer) {
      await q(
        `INSERT INTO uploads (name, mime, content) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET mime = EXCLUDED.mime, content = EXCLUDED.content`,
        [name, mime, buffer.toString('base64')]
      );
      return `/api/uploads/${name}`;
    },
    async getUpload(name) {
      const { rows } = await q('SELECT mime, content FROM uploads WHERE name = $1', [name]);
      if (!rows[0]) return null;
      return { mime: rows[0].mime, buffer: Buffer.from(rows[0].content, 'base64') };
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Factory (lazy, safe for serverless cold starts)                    */
/* ------------------------------------------------------------------ */
let storePromise = null;

function getStore(poolOverride) {
  if (storePromise) return storePromise;
  storePromise = (async () => {
    let store;
    if (poolOverride) {
      store = createPgStore(poolOverride);
    } else if (process.env.DATABASE_URL) {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: 3,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000
      });
      pool.on('error', err => console.error('[DB] pool error:', err.message));
      store = createPgStore(pool);
    } else {
      store = createFileStore();
    }
    await store.init();
    console.log(`[DB] storage backend: ${store.kind}`);
    return store;
  })().catch(err => {
    storePromise = null; // allow retry on next request
    throw err;
  });
  return storePromise;
}

module.exports = { getStore, DEFAULT_SETTINGS };

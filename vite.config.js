import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createHmac } from 'crypto'
import { readdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import OAuth from 'oauth-1.0a'

function makeOAuth(env) {
  return new OAuth({
    consumer: { key: env.NS_CONSUMER_KEY, secret: env.NS_CONSUMER_SECRET },
    signature_method: 'HMAC-SHA256',
    hash_function(base_string, key) {
      return createHmac('sha256', key).update(base_string).digest('base64');
    },
    realm: env.NS_ACCOUNT_ID,
  });
}

async function runSuiteQL(sql, env) {
  const acct = env.NS_ACCOUNT_ID;
  const url = `https://${acct}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=10&offset=0`;
  const oauth = makeOAuth(env);
  const token = { key: env.NS_TOKEN_ID, secret: env.NS_TOKEN_SECRET };
  const auth = oauth.toHeader(oauth.authorize({ url, method: 'POST' }, token)).Authorization;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json', Prefer: 'transient' },
    body: JSON.stringify({ q: sql }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`SuiteQL ${r.status}: ${txt.slice(0, 500)}`);
  return JSON.parse(txt).items || [];
}

async function fetchItemMaster(env) {
  const acct = env.NS_ACCOUNT_ID;
  const baseUrl = `https://${acct}.suitetalk.api.netsuite.com/services/rest/record/v1/inventoryitem`;
  const oauth = makeOAuth(env);
  const token = { key: env.NS_TOKEN_ID, secret: env.NS_TOKEN_SECRET };
  let allRecords = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;
  while (hasMore) {
    const url = `${baseUrl}?limit=${limit}&offset=${offset}`;
    const auth = oauth.toHeader(oauth.authorize({ url, method: 'GET' }, token)).Authorization;
    const r = await fetch(url, {
      method: 'GET',
      headers: { Authorization: auth },
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`REST ${r.status}: ${txt.slice(0, 500)}`);
    }
    const data = await r.json();
    console.log('[NS] Raw response:', JSON.stringify(data, null, 2));
    allRecords = allRecords.concat(data.items || []);
    hasMore = data.hasMore || false;
    offset += limit;
  }
  return allRecords.filter(r => !r.isInactive);
}

function netsuitePlugin(env) {
  return {
    name: 'netsuite-proxy',
    configureServer(server) {
      server.middlewares.use('/api/test-pdfs', (req, res) => {
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
        try {
          const dir = resolve(process.cwd(), 'public/test-pdfs');
          if (!existsSync(dir)) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('[]'); return; }
          const files = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(files));
        } catch(e) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('[]');
        }
      });

      server.middlewares.use('/api/netsuite/whoami', async (req, res) => {
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
        try {
          const rows = await runSuiteQL(`SELECT id, symbol FROM currency FETCH FIRST 5 ROWS ONLY`, env);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(rows));
        } catch(e) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      server.middlewares.use('/api/netsuite/itemmaster-restlet', async (req, res) => {
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
        const restletUrl = env.NS_RESTLET_ITEMMASTER;
        if (!restletUrl) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'NS_RESTLET_ITEMMASTER not set in .env', items: [] }));
          return;
        }
        try {
          const qs = new URL(req.url, 'http://localhost').searchParams;
          const searchId = qs.get('searchId');
          const targetUrl = searchId ? `${restletUrl}&searchId=${encodeURIComponent(searchId)}` : restletUrl;
          const oauth = makeOAuth(env);
          const token = { key: env.NS_TOKEN_ID, secret: env.NS_TOKEN_SECRET };
          const auth = oauth.toHeader(oauth.authorize({ url: targetUrl, method: 'GET' }, token)).Authorization;
          const r = await fetch(targetUrl, {
            method: 'GET',
            headers: { Authorization: auth, 'Content-Type': 'application/json' },
          });
          const txt = await r.text();
          if (!r.ok) throw new Error(`RESTlet ${r.status}: ${txt.slice(0, 500)}`);
          const data = JSON.parse(txt);
          console.log(`[NS] RESTlet item master (${searchId||'default'}): ${data.count ?? data.items?.length ?? '?'} items`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        } catch (e) {
          console.error('[NS] RESTlet error:', e.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message, items: [] }));
        }
      });

      server.middlewares.use('/api/netsuite/itemmaster', async (req, res) => {
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
        try {
          const records = await fetchItemMaster(env);
          const items = records.map(r => ({
            'Child SKU': r.itemId || String(r.id),
            'Parent SKU': r.externalId || '',
            'UPC Code': r.upcCode || '',
          }));
          console.log(`[NS] Item master loaded: ${items.length} items`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ items }));
        } catch (e) {
          console.error('[NS] Item master error:', e.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message, items: [] }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), netsuitePlugin(env)],
    server: {
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        },
      },
    },
  }
})

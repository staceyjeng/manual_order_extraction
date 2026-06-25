import { createHmac } from 'crypto';
import OAuth from 'oauth-1.0a';

export default async () => {
  const restletUrl = process.env.NS_RESTLET_ITEMMASTER;
  if (!restletUrl) {
    return new Response(JSON.stringify({ error: 'NS_RESTLET_ITEMMASTER not configured', items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const oauth = new OAuth({
    consumer: { key: process.env.NS_CONSUMER_KEY, secret: process.env.NS_CONSUMER_SECRET },
    signature_method: 'HMAC-SHA256',
    hash_function(base_string, key) {
      return createHmac('sha256', key).update(base_string).digest('base64');
    },
    realm: process.env.NS_ACCOUNT_ID,
  });

  const token = { key: process.env.NS_TOKEN_ID, secret: process.env.NS_TOKEN_SECRET };
  const auth = oauth.toHeader(oauth.authorize({ url: restletUrl, method: 'GET' }, token)).Authorization;

  try {
    const r = await fetch(restletUrl, {
      method: 'GET',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    });
    const data = await r.text();
    return new Response(data, {
      status: r.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/netsuite/itemmaster-restlet' };

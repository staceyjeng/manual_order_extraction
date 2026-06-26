import { createHmac } from 'crypto';
import OAuth from 'oauth-1.0a';

export default async (request, context) => {
  if (!context.clientContext?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const restletUrl = process.env.NS_RESTLET_ITEMMASTER;
  if (!restletUrl) {
    return new Response(JSON.stringify({ error: 'NS_RESTLET_ITEMMASTER not configured', items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const qs = new URL(request.url).searchParams;
  const searchId = qs.get('searchId');
  const targetUrl = searchId ? `${restletUrl}&searchId=${encodeURIComponent(searchId)}` : restletUrl;

  const oauth = new OAuth({
    consumer: { key: process.env.NS_CONSUMER_KEY, secret: process.env.NS_CONSUMER_SECRET },
    signature_method: 'HMAC-SHA256',
    hash_function(base_string, key) {
      return createHmac('sha256', key).update(base_string).digest('base64');
    },
    realm: process.env.NS_ACCOUNT_ID,
  });

  const token = { key: process.env.NS_TOKEN_ID, secret: process.env.NS_TOKEN_SECRET };
  const auth = oauth.toHeader(oauth.authorize({ url: targetUrl, method: 'GET' }, token)).Authorization;

  try {
    const r = await fetch(targetUrl, {
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

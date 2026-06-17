export default async (req) => {
  const url = new URL(req.url);
  const anthropicPath = url.pathname.replace(/^\/api\/anthropic/, '');
  const anthropicUrl = `https://api.anthropic.com${anthropicPath}`;

  const body = req.method !== 'GET' ? await req.text() : undefined;

  const response = await fetch(anthropicUrl, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body,
  });

  const data = await response.text();
  return new Response(data, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/anthropic/*' };

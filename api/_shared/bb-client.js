const { getToken, setToken } = require('./cache');

async function fetchNewToken() {
  const credentials = Buffer.from(
    `${process.env.BB_CLIENT_KEY}:${process.env.BB_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${process.env.BB_BASE_URL}/learn/api/public/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const data = await res.json();
  // Cache 60s before actual expiry to avoid edge-case expirations
  setToken(data.access_token, data.expires_in - 60);
  return data.access_token;
}

async function getAccessToken() {
  return getToken() || fetchNewToken();
}

async function bbFetch(path, retries = 4) {
  const token = await getAccessToken();
  const res = await fetch(`${process.env.BB_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '15', 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return bbFetch(path, retries - 1);
  }

  if (!res.ok) throw new Error(`Blackboard API error: ${res.status} ${path}`);
  return res.json();
}

async function bbFetchAll(path) {
  const results = [];
  let nextPath = path;
  while (nextPath) {
    const data = await bbFetch(nextPath);
    results.push(...(data.results || []));
    nextPath = data.paging?.nextPage || null;
  }
  return results;
}

module.exports = { bbFetch, bbFetchAll };

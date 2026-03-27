const cache = require('../_shared/cache');
const { bbFetch, bbFetchAll } = require('../_shared/bb-client');

beforeEach(() => {
  cache.clearToken();
  process.env.BB_BASE_URL = 'https://test.blackboard.com';
  process.env.BB_CLIENT_KEY = 'testkey';
  process.env.BB_CLIENT_SECRET = 'testsecret';
});

afterEach(() => jest.restoreAllMocks());

function jsonOk(body) {
  return { ok: true, json: async () => body };
}
function jsonFail(status) {
  return { ok: false, status, json: async () => ({}) };
}

test('fetches a new token on first call', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(jsonOk({ access_token: 'newtoken', expires_in: 3600 }))
    .mockResolvedValueOnce(jsonOk({ results: [] }));

  await bbFetch('/learn/api/public/v1/terms');

  expect(global.fetch).toHaveBeenCalledTimes(2);
  const [url, opts] = global.fetch.mock.calls[0];
  expect(url).toBe('https://test.blackboard.com/learn/api/public/v1/oauth2/token');
  expect(opts.method).toBe('POST');
});

test('reuses cached token on second call', async () => {
  cache.setToken('cachedtok', 3600);
  global.fetch = jest.fn().mockResolvedValueOnce(jsonOk({ results: [{ id: '1' }] }));

  const data = await bbFetch('/learn/api/public/v1/courses');

  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(data.results[0].id).toBe('1');
});

test('throws on token fetch failure', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(jsonFail(401));
  await expect(bbFetch('/learn/api/public/v1/terms')).rejects.toThrow('Token fetch failed: 401');
});

test('throws on Blackboard API failure', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(jsonOk({ access_token: 'tok', expires_in: 3600 }))
    .mockResolvedValueOnce(jsonFail(403));
  await expect(bbFetch('/learn/api/public/v1/terms')).rejects.toThrow('Blackboard API error');
});

test('bbFetchAll follows pagination', async () => {
  cache.setToken('tok', 3600);
  global.fetch = jest.fn()
    .mockResolvedValueOnce(jsonOk({
      results: [{ id: 'a' }],
      paging: { nextPage: '/learn/api/public/v1/terms?offset=1' }
    }))
    .mockResolvedValueOnce(jsonOk({ results: [{ id: 'b' }] }));

  const results = await bbFetchAll('/learn/api/public/v1/terms');

  expect(results).toHaveLength(2);
  expect(results[0].id).toBe('a');
  expect(results[1].id).toBe('b');
});

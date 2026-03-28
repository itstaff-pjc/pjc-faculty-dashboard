jest.mock('../_shared/blob-client');
const blobClient = require('../_shared/blob-client');
const cache = require('../_shared/cache');

beforeEach(() => jest.clearAllMocks());
afterEach(() => cache.clearCached('sync-status'));

function makeContext() {
  return { res: {}, log: jest.fn() };
}

test('returns meta.json contents from blob', async () => {
  const meta = { lastSync: '2026-03-28T05:00:00Z', instructorCount: 42, status: 'ok', error: null };
  blobClient.readBlob.mockResolvedValue(meta);

  const handler = require('../sync-status');
  const context = makeContext();
  await handler(context, {});

  expect(context.res.status).toBe(200);
  expect(context.res.body).toEqual(meta);
  expect(blobClient.readBlob).toHaveBeenCalledWith('meta.json');
});

test('returns no-sync status when meta.json does not exist yet', async () => {
  blobClient.readBlob.mockRejectedValue(new Error('BlobNotFound: blob does not exist'));

  const handler = require('../sync-status');
  const context = makeContext();
  await handler(context, {});

  expect(context.res.status).toBe(200);
  expect(context.res.body).toEqual({ status: 'no-sync', lastSync: null });
});

test('returns cached data on second call without re-reading blob', async () => {
  const meta = { lastSync: '2026-03-28T05:00:00Z', status: 'ok' };
  blobClient.readBlob.mockResolvedValue(meta);

  const handler = require('../sync-status');
  await handler(makeContext(), {});
  await handler(makeContext(), {});

  expect(blobClient.readBlob).toHaveBeenCalledTimes(1);
});

test('returns 500 on unexpected storage error', async () => {
  blobClient.readBlob.mockRejectedValue(new Error('ServiceUnavailable'));

  const handler = require('../sync-status');
  const context = makeContext();
  await handler(context, {});

  expect(context.res.status).toBe(500);
});

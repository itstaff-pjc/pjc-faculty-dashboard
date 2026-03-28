jest.mock('../_shared/blob-client');
const blobClient = require('../_shared/blob-client');
const cache = require('../_shared/cache');

const handler = require('../instructors');

afterEach(() => {
  cache.clearCached('instructors');
  jest.clearAllMocks();
});

function makeContext() {
  return { res: {}, log: jest.fn() };
}

const BLOB_DATA = {
  instructors: [
    { userId: '_100_1', name: 'Smith, Jane', courseCount: 2, status: 'at-risk' },
    { userId: '_101_1', name: 'Davis, Mark', courseCount: 1, status: 'inactive' },
  ]
};

test('returns instructors from blob storage', async () => {
  blobClient.readBlob.mockResolvedValue(BLOB_DATA);

  const context = makeContext();
  await handler(context, {});

  expect(context.res.status).toBe(200);
  expect(context.res.body).toEqual(BLOB_DATA);
  expect(blobClient.readBlob).toHaveBeenCalledWith('instructors.json');
});

test('returns 503 when no sync data exists yet (BlobNotFound)', async () => {
  blobClient.readBlob.mockRejectedValue(new Error('BlobNotFound: blob does not exist'));

  const context = makeContext();
  await handler(context, {});

  expect(context.res.status).toBe(503);
  expect(context.res.body.error).toMatch(/No sync data/);
});

test('returns 500 on unexpected storage error', async () => {
  blobClient.readBlob.mockRejectedValue(new Error('ServiceUnavailable'));

  const context = makeContext();
  await handler(context, {});

  expect(context.res.status).toBe(500);
});

test('returns cached data on second call without re-reading blob', async () => {
  blobClient.readBlob.mockResolvedValue(BLOB_DATA);

  await handler(makeContext(), {});
  await handler(makeContext(), {});

  expect(blobClient.readBlob).toHaveBeenCalledTimes(1);
});

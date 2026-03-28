jest.mock('../_shared/blob-client');
const blobClient = require('../_shared/blob-client');
const cache = require('../_shared/cache');

afterEach(() => cache.clearCached('instructor:_100_1'));

function makeContext() {
  return { res: {}, log: jest.fn() };
}

const BLOB_DATA = {
  userId: '_100_1',
  courses: [{
    courseId: '_10_1',
    courseName: 'Composition I',
    courseCode: 'ENGL-1301-01',
    lastAccessed: '2026-03-19T10:00:00Z',
    status: 'at-risk',
    timeSpent: 'N/A',
    contentLastModified: '2026-03-16T10:00:00Z',
    gradeColumnsCount: 2,
    gradesPosted: 'Yes',
    instructorDiscussionPosts: 1,
  }]
};

test('returns instructor detail from blob storage', async () => {
  blobClient.readBlob.mockResolvedValue(BLOB_DATA);

  const handler = require('../instructor');
  const context = makeContext();
  await handler(context, { params: { id: '_100_1' } });

  expect(context.res.status).toBe(200);
  expect(context.res.body).toEqual(BLOB_DATA);
  expect(blobClient.readBlob).toHaveBeenCalledWith('instructor/_100_1.json');
});

test('returns 400 when id param missing', async () => {
  const handler = require('../instructor');
  const context = makeContext();
  await handler(context, { params: {} });
  expect(context.res.status).toBe(400);
});

test('returns 404 when instructor blob not found', async () => {
  blobClient.readBlob.mockRejectedValue(new Error('BlobNotFound'));

  const handler = require('../instructor');
  const context = makeContext();
  await handler(context, { params: { id: '_999_1' } });

  expect(context.res.status).toBe(404);
});

test('returns 500 on unexpected storage error', async () => {
  blobClient.readBlob.mockRejectedValue(new Error('NetworkError'));

  const handler = require('../instructor');
  const context = makeContext();
  await handler(context, { params: { id: '_100_1' } });

  expect(context.res.status).toBe(500);
});

test('returns cached data on second call without re-reading blob', async () => {
  blobClient.readBlob.mockClear();
  blobClient.readBlob.mockResolvedValue(BLOB_DATA);

  const handler = require('../instructor');
  await handler(makeContext(), { params: { id: '_100_1' } });
  await handler(makeContext(), { params: { id: '_100_1' } });

  expect(blobClient.readBlob).toHaveBeenCalledTimes(1);
});

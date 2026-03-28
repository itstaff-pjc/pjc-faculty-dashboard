jest.mock('../_shared/bb-client');
jest.mock('../_shared/blob-client');

const bbClient = require('../_shared/bb-client');
const blobClient = require('../_shared/blob-client');

function makeContext() {
  return { log: jest.fn() };
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

const now = Date.now();
const TERMS = [{
  id: '_1_1', name: 'Spring 2026',
  availability: { available: 'Yes' },
  startDate: new Date(now - 30 * 86400000).toISOString(),
  endDate: new Date(now + 60 * 86400000).toISOString(),
}];
const COURSES = [{ id: '_10_1', name: 'Composition I', courseId: 'ENGL-1301-01' }];
const MEMBERS = [{
  userId: '_100_1',
  courseRoleId: 'Instructor',
  lastAccessed: daysAgo(3),
  user: { id: '_100_1', name: { given: 'Jane', family: 'Smith' } },
}];

beforeEach(() => jest.clearAllMocks());

test('writes instructors.json, one instructor blob, and meta.json with ok status on success', async () => {
  bbClient.bbFetchAll.mockImplementation(async (path) => {
    if (path.includes('/terms')) return TERMS;
    if (path.includes('courses?termId')) return COURSES;
    if (path.includes('/users?role')) return MEMBERS;
    if (path.includes('/gradebook/columns')) return [{ id: '_50_1' }];
    if (/\/forums\/_/.test(path)) return [];
    if (path.includes('/forums')) return [];
    if (path.includes('/contents')) return [];
    return [];
  });
  bbClient.bbFetch.mockRejectedValue(new Error('stats N/A'));
  blobClient.writeBlob.mockResolvedValue();

  const handler = require('../sync');
  await handler(makeContext(), {});

  // instructors.json written with correct summary
  const instructorsCall = blobClient.writeBlob.mock.calls.find(c => c[0] === 'instructors.json');
  expect(instructorsCall).toBeTruthy();
  const { instructors } = instructorsCall[1];
  expect(instructors).toHaveLength(1);
  expect(instructors[0].userId).toBe('_100_1');
  expect(instructors[0].name).toBe('Smith, Jane');
  expect(instructors[0].status).toBe('active');
  expect(instructors[0].courseCount).toBe(1);

  // per-instructor detail blob written
  const detailCall = blobClient.writeBlob.mock.calls.find(c => c[0] === 'instructor/_100_1.json');
  expect(detailCall).toBeTruthy();
  expect(detailCall[1].userId).toBe('_100_1');
  expect(detailCall[1].courses).toHaveLength(1);
  expect(detailCall[1].courses[0].courseCode).toBe('ENGL-1301-01');
  expect(detailCall[1].courses[0].gradesPosted).toBe('Yes');

  // meta.json written with ok status and correct counts
  const metaCall = blobClient.writeBlob.mock.calls.find(c => c[0] === 'meta.json');
  expect(metaCall).toBeTruthy();
  expect(metaCall[1].status).toBe('ok');
  expect(metaCall[1].instructorCount).toBe(1);
  expect(metaCall[1].termCount).toBe(1);
  expect(metaCall[1].error).toBeNull();
  expect(metaCall[1].lastSync).toBeTruthy();
});

test('writes error state to meta.json when Blackboard call fails, leaving existing blobs intact', async () => {
  bbClient.bbFetchAll.mockRejectedValue(new Error('Blackboard rate limited'));
  blobClient.writeBlob.mockResolvedValue();

  const handler = require('../sync');
  await handler(makeContext(), {});

  // instructors.json should NOT have been written
  const instructorsCall = blobClient.writeBlob.mock.calls.find(c => c[0] === 'instructors.json');
  expect(instructorsCall).toBeFalsy();

  // meta.json should be written with error status
  const metaCall = blobClient.writeBlob.mock.calls.find(c => c[0] === 'meta.json');
  expect(metaCall).toBeTruthy();
  expect(metaCall[1].status).toBe('error');
  expect(metaCall[1].error).toBe('Blackboard rate limited');
});

test('sorts instructors inactive-first in instructors.json', async () => {
  const COURSES_2 = [
    { id: '_10_1', name: 'Composition I', courseId: 'ENGL-1301-01' },
    { id: '_11_1', name: 'Math 1314', courseId: 'MATH-1314-01' },
  ];
  const MEMBERS_10 = [{
    userId: '_100_1', courseRoleId: 'Instructor', lastAccessed: daysAgo(3),
    user: { id: '_100_1', name: { given: 'Jane', family: 'Smith' } },
  }];
  const MEMBERS_11 = [{
    userId: '_101_1', courseRoleId: 'Instructor', lastAccessed: daysAgo(20),
    user: { id: '_101_1', name: { given: 'Mark', family: 'Davis' } },
  }];

  bbClient.bbFetchAll.mockImplementation(async (path) => {
    if (path.includes('/terms')) return TERMS;
    if (path.includes('courses?termId')) return COURSES_2;
    if (path.includes('_10_1/users')) return MEMBERS_10;
    if (path.includes('_11_1/users')) return MEMBERS_11;
    return [];
  });
  bbClient.bbFetch.mockRejectedValue(new Error('N/A'));
  blobClient.writeBlob.mockResolvedValue();

  const handler = require('../sync');
  await handler(makeContext(), {});

  const instructorsCall = blobClient.writeBlob.mock.calls.find(c => c[0] === 'instructors.json');
  const { instructors } = instructorsCall[1];
  expect(instructors[0].status).toBe('inactive');
  expect(instructors[1].status).toBe('active');
});

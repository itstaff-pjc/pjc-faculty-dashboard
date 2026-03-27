jest.mock('../_shared/bb-client');
const bbClient = require('../_shared/bb-client');

function makeContext() {
  return { res: {}, log: jest.fn() };
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
const MEMBERSHIP = { userId: '_100_1', courseRoleId: 'Instructor', lastAccessed: daysAgo(9) };
const GRADE_COLUMNS = [{ id: '_50_1', name: 'Midterm' }, { id: '_51_1', name: 'Final' }];
const FORUMS = [{ id: '_200_1', name: 'Week 1 Discussion' }];
const FORUM_POSTS = [
  { id: '_300_1', author: { id: '_100_1' }, posted: daysAgo(5) },
  { id: '_301_1', author: { id: '_999_1' }, posted: daysAgo(4) }, // different user
];
const CONTENT_ITEMS = [
  { id: '_400_1', modified: daysAgo(12) },
  { id: '_401_1', modified: daysAgo(20) },
];

test('returns course detail with all metrics', async () => {
  bbClient.bbFetchAll.mockImplementation(async (path) => {
    if (path.includes('/terms')) return TERMS;
    if (path.includes('courses?termId')) return COURSES;
    if (path.includes('/users?role')) return [MEMBERSHIP];
    if (path.includes('/gradebook/columns')) return GRADE_COLUMNS;
    if (/\/forums\/_/.test(path)) return FORUM_POSTS;  // /forums/{id}/threads
    if (path.includes('/forums')) return FORUMS;
    if (path.includes('/contents')) return CONTENT_ITEMS;
    return [];
  });
  // Time-spent endpoint unavailable → N/A
  bbClient.bbFetch.mockRejectedValue(new Error('stats not available'));

  const handler = require('../instructor');
  const context = makeContext();
  await handler(context, { params: { id: '_100_1' } });

  expect(context.res.status).toBe(200);
  const { courses } = context.res.body;
  expect(courses).toHaveLength(1);

  const c = courses[0];
  expect(c.courseCode).toBe('ENGL-1301-01');
  expect(c.lastAccessed).toBe(MEMBERSHIP.lastAccessed);
  expect(c.status).toBe('at-risk');          // 9 days ago
  expect(c.timeSpent).toBe('N/A');
  expect(c.gradeColumnsCount).toBe(2);
  expect(c.gradesPosted).toBe('Yes');
  expect(c.instructorDiscussionPosts).toBe(1); // only _100_1's post
  expect(c.contentLastModified).toBe(CONTENT_ITEMS[0].modified); // most recent
});

test('returns 400 when id param missing', async () => {
  const handler = require('../instructor');
  const context = makeContext();
  await handler(context, { params: {} });
  expect(context.res.status).toBe(400);
});

test('returns 500 on Blackboard API error', async () => {
  bbClient.bbFetchAll.mockRejectedValue(new Error('API down'));
  const handler = require('../instructor');
  const context = makeContext();
  await handler(context, { params: { id: '_100_1' } });
  expect(context.res.status).toBe(500);
});

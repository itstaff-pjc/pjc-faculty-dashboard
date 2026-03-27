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
const COURSES = [
  { id: '_10_1', name: 'Composition I', courseId: 'ENGL-1301-01' },
  { id: '_11_1', name: 'Math 1314', courseId: 'MATH-1314-01' },
];
// Smith teaches both courses: active in one (3d), at-risk in other (10d) → overall at-risk
// Davis teaches one course: inactive (18d) → overall inactive
const MEMBERS_COURSE_0 = [
  { userId: '_100_1', courseRoleId: 'Instructor', lastAccessed: daysAgo(3),
    user: { id: '_100_1', name: { given: 'Jane', family: 'Smith' } } },
  { userId: '_101_1', courseRoleId: 'Instructor', lastAccessed: daysAgo(18),
    user: { id: '_101_1', name: { given: 'Mark', family: 'Davis' } } },
];
const MEMBERS_COURSE_1 = [
  { userId: '_100_1', courseRoleId: 'Instructor', lastAccessed: daysAgo(10),
    user: { id: '_100_1', name: { given: 'Jane', family: 'Smith' } } },
];

test('aggregates instructors with worst-case status across courses', async () => {
  bbClient.bbFetchAll.mockImplementation(async (path) => {
    if (path.includes('/terms')) return TERMS;
    if (path.includes('courses?termId')) return COURSES;
    if (path.includes('_10_1/users')) return MEMBERS_COURSE_0;
    if (path.includes('_11_1/users')) return MEMBERS_COURSE_1;
    return [];
  });

  const handler = require('../instructors');
  const context = makeContext();
  await handler(context, {});

  expect(context.res.status).toBe(200);
  const { instructors } = context.res.body;
  expect(instructors).toHaveLength(2);

  // Inactive sort first
  expect(instructors[0].status).toBe('inactive');

  const smith = instructors.find(i => i.userId === '_100_1');
  expect(smith.name).toBe('Smith, Jane');
  expect(smith.status).toBe('at-risk'); // worst of active(3d) and at-risk(10d)
  expect(smith.courseCount).toBe(2);

  const davis = instructors.find(i => i.userId === '_101_1');
  expect(davis.name).toBe('Davis, Mark');
  expect(davis.status).toBe('inactive');
  expect(davis.courseCount).toBe(1);
});

test('returns 500 on Blackboard API error', async () => {
  bbClient.bbFetchAll.mockRejectedValue(new Error('API down'));
  const handler = require('../instructors');
  const context = makeContext();
  await handler(context, {});
  expect(context.res.status).toBe(500);
});

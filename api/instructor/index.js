const { bbFetch, bbFetchAll } = require('../_shared/bb-client');
const { computeStatus } = require('../_shared/activity');

async function getActiveTerms() {
  const startYear = parseInt(process.env.BB_START_YEAR || '2026', 10);
  const all = await bbFetchAll('/learn/api/public/v1/terms?limit=100&fields=id,name,availability,startDate,endDate');
  const now = Date.now();
  const startOfYear = new Date(`${startYear}-01-01`).getTime();
  return all.filter(t => {
    if (t.availability?.available !== 'Yes') return false;
    if (!t.startDate) return false;
    const start = new Date(t.startDate).getTime();
    if (start < startOfYear) return false;
    const end = t.endDate ? new Date(t.endDate).getTime() : Infinity;
    return now >= start && now <= end;
  });
}

async function getTimeSpent(courseId, userId) {
  try {
    const data = await bbFetch(
      `/learn/api/public/v1/courses/${courseId}/statistics/user/${userId}`
    );
    const minutes = data.totalMinutes || data.timeInCourse;
    if (!minutes) return 'N/A';
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  } catch {
    return 'N/A';
  }
}

async function getContentLastModified(courseId) {
  try {
    const items = await bbFetchAll(`/learn/api/public/v1/courses/${courseId}/contents?limit=100`);
    const dates = items.map(i => i.modified).filter(Boolean).sort().reverse();
    return dates[0] || null;
  } catch {
    return null;
  }
}

async function getDiscussionPostCount(courseId, userId) {
  try {
    const forums = await bbFetchAll(`/learn/api/public/v1/courses/${courseId}/forums?limit=100`);
    let count = 0;
    for (const forum of forums) {
      const posts = await bbFetchAll(
        `/learn/api/public/v1/courses/${courseId}/forums/${forum.id}/threads?limit=100`
      );
      count += posts.filter(p => p.author?.id === userId).length;
    }
    return count;
  } catch {
    return 0;
  }
}

module.exports = async function (context, req) {
  const userId = req.params?.id;
  if (!userId) {
    context.res = { status: 400, body: { error: 'Missing instructor id' } };
    return;
  }

  try {
    const terms = await getActiveTerms();
    const courseArrays = await Promise.all(
      terms.map(t => bbFetchAll(`/learn/api/public/v1/courses?termId=${t.id}&limit=100`))
    );
    const allCourses = courseArrays.flat();

    // Find courses where this user is an instructor
    const found = await Promise.all(
      allCourses.map(async course => {
        const members = await bbFetchAll(
          `/learn/api/public/v1/courses/${course.id}/users?role.roleType=Instructor&limit=100`
        );
        const m = members.find(m => m.userId === userId);
        return m ? { course, membership: m } : null;
      })
    );
    const instructorCourses = found.filter(Boolean);

    const courses = await Promise.all(
      instructorCourses.map(async ({ course, membership }) => {
        const [timeSpent, contentLastModified, gradeColumns, discussionPosts] = await Promise.all([
          getTimeSpent(course.id, userId),
          getContentLastModified(course.id),
          bbFetchAll(`/learn/api/public/v1/courses/${course.id}/gradebook/columns?limit=100`)
            .catch(() => []),
          getDiscussionPostCount(course.id, userId),
        ]);

        return {
          courseId: course.id,
          courseName: course.name,
          courseCode: course.courseId,
          lastAccessed: membership.lastAccessed || null,
          status: computeStatus(membership.lastAccessed || null),
          timeSpent,
          contentLastModified,
          gradeColumnsCount: gradeColumns.length,
          gradesPosted: gradeColumns.length > 0 ? 'Yes' : 'None',
          instructorDiscussionPosts: discussionPosts,
        };
      })
    );

    context.res = { status: 200, body: { userId, courses } };
  } catch (err) {
    context.log('Error in /api/instructor:', err.message);
    context.res = { status: 500, body: { error: 'Failed to fetch instructor detail' } };
  }
};

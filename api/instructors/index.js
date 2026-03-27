const { bbFetchAll } = require('../_shared/bb-client');
const { computeStatus, worstStatus } = require('../_shared/activity');

const STATUS_SORT = { inactive: 0, 'at-risk': 1, active: 2 };

async function getActiveTerms() {
  const all = await bbFetchAll('/learn/api/public/v1/terms?limit=200');
  const termFilter = process.env.BB_TERM_FILTER || '';
  const now = Date.now();
  return all.filter(t => {
    if (t.availability?.available !== 'Yes') return false;
    if (termFilter && !t.name.includes(termFilter)) return false;
    if (!t.startDate && !t.endDate) return true;
    const start = t.startDate ? new Date(t.startDate).getTime() : -Infinity;
    const end = t.endDate ? new Date(t.endDate).getTime() : Infinity;
    return now >= start && now <= end;
  });
}

module.exports = async function (context, req) {
  try {
    const terms = await getActiveTerms();

    const courseArrays = await Promise.all(
      terms.map(t => bbFetchAll(`/learn/api/public/v1/courses?termId=${t.id}&limit=200`))
    );
    const courses = courseArrays.flat();

    // expand=user returns name inline, avoiding N extra user-lookup calls
    const membershipArrays = await Promise.all(
      courses.map(c =>
        bbFetchAll(
          `/learn/api/public/v1/courses/${c.id}/users?role.roleType=Instructor&expand=user&limit=200`
        )
      )
    );

    // Build map: userId → { userId, name, courses[] }
    const map = new Map();
    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];
      for (const m of membershipArrays[i]) {
        if (!map.has(m.userId)) {
          const given = m.user?.name?.given || '';
          const family = m.user?.name?.family || '';
          const name = family
            ? `${family}, ${given}`.trim().replace(/,\s*$/, '')
            : m.userId;
          map.set(m.userId, { userId: m.userId, name, courses: [] });
        }
        map.get(m.userId).courses.push({
          courseId: course.id,
          courseName: course.name,
          courseCode: course.courseId,
          lastAccessed: m.lastAccessed || null,
          status: computeStatus(m.lastAccessed || null),
        });
      }
    }

    const instructors = Array.from(map.values())
      .map(inst => ({
        ...inst,
        courseCount: inst.courses.length,
        status: worstStatus(inst.courses.map(c => c.status)),
      }))
      .sort((a, b) =>
        STATUS_SORT[a.status] - STATUS_SORT[b.status] || a.name.localeCompare(b.name)
      );

    context.res = { status: 200, body: { instructors } };
  } catch (err) {
    context.log('Error in /api/instructors:', err.message);
    context.res = { status: 500, body: { error: 'Failed to fetch instructors', detail: err.message } };
  }
};

const { bbFetchAll } = require('../_shared/bb-client');
const { computeStatus, worstStatus } = require('../_shared/activity');
const { getCached, setCached } = require('../_shared/cache');

const CACHE_TTL_SECONDS = 300; // 5 minutes

const STATUS_SORT = { inactive: 0, 'at-risk': 1, active: 2 };

async function getActiveTerms() {
  const all = await bbFetchAll('/learn/api/public/v1/terms?limit=100');
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
    const cached = getCached('instructors');
    if (cached) {
      context.res = { status: 200, body: cached };
      return;
    }

    const terms = await getActiveTerms();

    // Fetch courses sequentially per term to avoid overwhelming Blackboard
    const courses = [];
    for (const t of terms) {
      const termCourses = await bbFetchAll(`/learn/api/public/v1/courses?termId=${t.id}&limit=100`);
      courses.push(...termCourses);
    }

    // Fetch memberships in small batches to avoid connection overload
    const membershipArrays = [];
    for (let i = 0; i < courses.length; i += 5) {
      const batch = courses.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(c =>
          bbFetchAll(
            `/learn/api/public/v1/courses/${c.id}/users?role.roleType=Instructor&expand=user&limit=100`
          )
        )
      );
      membershipArrays.push(...batchResults);
    }

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

    const body = { instructors };
    setCached('instructors', body, CACHE_TTL_SECONDS);
    context.res = { status: 200, body };
  } catch (err) {
    context.log('Error in /api/instructors:', err.message, err.cause);
    context.res = { status: 500, body: { error: 'Failed to fetch instructors', detail: err.message, cause: String(err.cause || '') } };
  }
};

const { bbFetch, bbFetchAll } = require('../_shared/bb-client');
const { computeStatus, worstStatus } = require('../_shared/activity');
const { writeBlob } = require('../_shared/blob-client');

const STATUS_SORT = { inactive: 0, 'at-risk': 1, active: 2 };

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
    const data = await bbFetch(`/learn/api/public/v1/courses/${courseId}/statistics/user/${userId}`);
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

async function buildInstructorDetail(userId, instructorCourses) {
  const courses = await Promise.all(
    instructorCourses.map(async ({ course, membership }) => {
      const [timeSpent, contentLastModified, gradeColumns] = await Promise.all([
        getTimeSpent(course.id, userId),
        getContentLastModified(course.id),
        bbFetchAll(`/learn/api/public/v1/courses/${course.id}/gradebook/columns?limit=100`).catch(() => []),
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
      };
    })
  );
  return { userId, courses };
}

module.exports = async function (context, myTimer) {
  context.log('Nightly sync started');

  try {
    const terms = await getActiveTerms();

    const allCourses = [];
    for (const t of terms) {
      const termCourses = await bbFetchAll(`/learn/api/public/v1/courses?termId=${t.id}&limit=100`);
      allCourses.push(...termCourses);
    }

    // Fetch memberships in batches of 5 to avoid overwhelming Blackboard
    const membershipArrays = [];
    for (let i = 0; i < allCourses.length; i += 5) {
      const batch = allCourses.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(c =>
          bbFetchAll(`/learn/api/public/v1/courses/${c.id}/users?role.roleType=Instructor&expand=user&limit=100`)
        )
      );
      membershipArrays.push(...results);
    }

    // Build instructor → courses map
    const map = new Map();
    for (let i = 0; i < allCourses.length; i++) {
      const course = allCourses[i];
      for (const m of membershipArrays[i]) {
        if (!map.has(m.userId)) {
          const given = m.user?.name?.given || '';
          const family = m.user?.name?.family || '';
          const name = family
            ? `${family}, ${given}`.trim().replace(/,\s*$/, '')
            : m.userId;
          map.set(m.userId, { userId: m.userId, name, courses: [] });
        }
        map.get(m.userId).courses.push({ course, membership: m });
      }
    }

    // Build and write instructors summary
    const instructorSummaries = [];
    for (const [userId, data] of map.entries()) {
      const courseStatuses = data.courses.map(({ membership }) =>
        computeStatus(membership.lastAccessed || null)
      );
      instructorSummaries.push({
        userId,
        name: data.name,
        courseCount: data.courses.length,
        status: worstStatus(courseStatuses),
      });
    }
    instructorSummaries.sort((a, b) =>
      STATUS_SORT[a.status] - STATUS_SORT[b.status] || a.name.localeCompare(b.name)
    );

    await writeBlob('instructors.json', { instructors: instructorSummaries });
    context.log(`Wrote instructors.json: ${instructorSummaries.length} instructors`);

    // Write per-instructor detail blobs
    for (const [userId, data] of map.entries()) {
      const detail = await buildInstructorDetail(userId, data.courses);
      await writeBlob(`instructor/${userId}.json`, detail);
    }
    context.log(`Wrote ${map.size} instructor detail blobs`);

    // Write success meta
    await writeBlob('meta.json', {
      lastSync: new Date().toISOString(),
      instructorCount: instructorSummaries.length,
      termCount: terms.length,
      status: 'ok',
      error: null,
    });
    context.log('Sync complete');

  } catch (err) {
    context.log('Sync failed:', err.message);
    try {
      await writeBlob('meta.json', {
        lastSync: new Date().toISOString(),
        status: 'error',
        error: err.message,
      });
    } catch (writeErr) {
      context.log('Failed to write error meta.json:', writeErr.message);
    }
  }
};

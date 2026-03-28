const { bbFetch, bbFetchAll } = require('../_shared/bb-client');
const { computeStatus, worstStatus } = require('../_shared/activity');
const { writeBlob } = require('../_shared/blob-client');

const STATUS_SORT = { inactive: 0, 'at-risk': 1, active: 2 };

async function getAllTerms(startYear) {
  const all = await bbFetchAll('/learn/api/public/v1/terms?limit=100&fields=id,name,availability,startDate,endDate');
  const startOfYear = new Date(`${startYear}-01-01`).getTime();
  return all.filter(t =>
    t.availability?.available === 'Yes' &&
    t.startDate &&
    new Date(t.startDate).getTime() >= startOfYear
  );
}

function splitTerms(allTerms) {
  const now = Date.now();
  const currentTerms = allTerms
    .filter(t => {
      const start = new Date(t.startDate).getTime();
      const end = t.endDate ? new Date(t.endDate).getTime() : Infinity;
      return now >= start && now <= end;
    })
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const upcomingTerms = allTerms
    .filter(t => new Date(t.startDate).getTime() > now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .slice(0, 2);

  return { currentTerms, upcomingTerms };
}

function computeFlags(courses) {
  const flagged = courses.filter(c =>
    c.status === 'inactive' ||
    c.assignmentCount === 0 ||
    c.contentLastModified === null
  );

  const flags = [];

  const neverLogged = courses.filter(c => c.lastAccessed === null && c.status === 'inactive');
  const inactive = courses.filter(c => c.status === 'inactive' && c.lastAccessed !== null);

  if (neverLogged.length) {
    flags.push(neverLogged.length > 1
      ? `Never logged in (${neverLogged.length} courses)` : 'Never logged in');
  }
  if (inactive.length) {
    const days = Math.max(...inactive.map(c =>
      Math.floor((Date.now() - new Date(c.lastAccessed).getTime()) / 86400000)
    ));
    flags.push(inactive.length > 1
      ? `${days} days inactive (${inactive.length} courses)` : `${days} days inactive`);
  }

  const noAssign = courses.filter(c => c.assignmentCount === 0);
  if (noAssign.length) {
    flags.push(noAssign.length > 1
      ? `0 assignments (${noAssign.length} courses)` : '0 assignments');
  }

  const noContent = courses.filter(c => c.contentLastModified === null);
  if (noContent.length) {
    flags.push(noContent.length > 1
      ? `No content update (${noContent.length} courses)` : 'No content update');
  }

  return { flaggedCourseCount: flagged.length, flags };
}

function buildCourseStats(instructorDetails) {
  let total = 0, zeroLogins = 0, noAssignments = 0, noContentUpdate = 0;
  for (const { courses } of instructorDetails) {
    for (const c of courses) {
      total++;
      if (c.lastAccessed === null) zeroLogins++;
      if (c.assignmentCount === 0) noAssignments++;
      if (c.contentLastModified === null) noContentUpdate++;
    }
  }
  return { total, zeroLogins, noAssignments, noContentUpdate };
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

async function getCourseContentStats(courseId) {
  try {
    const items = await bbFetchAll(`/learn/api/public/v1/courses/${courseId}/contents?limit=100`);
    const dates = items.map(i => i.modified).filter(Boolean).sort().reverse();
    const assignmentCount = items.filter(i =>
      i.contentHandler?.id?.includes('assignment')
    ).length;
    return { contentLastModified: dates[0] || null, assignmentCount };
  } catch {
    return { contentLastModified: null, assignmentCount: 0 };
  }
}

async function buildInstructorDetail(userId, instructorCourses) {
  const courses = await Promise.all(
    instructorCourses.map(async ({ course, membership }) => {
      const [timeSpent, { contentLastModified, assignmentCount }] = await Promise.all([
        getTimeSpent(course.id, userId),
        getCourseContentStats(course.id),
      ]);
      return {
        courseId: course.id,
        courseName: course.name,
        courseCode: course.courseId,
        lastAccessed: membership.lastAccessed || null,
        status: computeStatus(membership.lastAccessed || null),
        timeSpent,
        contentLastModified,
        assignmentCount,
      };
    })
  );
  return { userId, courses };
}

module.exports = async function (context, myTimer) {
  context.log('Nightly sync started');

  try {
    const startYear = parseInt(process.env.BB_START_YEAR || '2026', 10);
    const allTerms = await getAllTerms(startYear);
    const { currentTerms, upcomingTerms } = splitTerms(allTerms);

    const allCourses = [];
    for (const t of currentTerms) {
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

    // Build all instructor details in memory first (needed for flag computation)
    const allDetails = new Map();
    for (const [userId, data] of map.entries()) {
      const detail = await buildInstructorDetail(userId, data.courses);
      allDetails.set(userId, detail);
    }

    // Build instructor summaries with flags
    const instructorSummaries = [];
    for (const [userId, data] of map.entries()) {
      const detail = allDetails.get(userId);
      const { flaggedCourseCount, flags } = computeFlags(detail.courses);
      const courseStatuses = data.courses.map(({ membership }) =>
        computeStatus(membership.lastAccessed || null)
      );
      instructorSummaries.push({
        userId,
        name: data.name,
        courseCount: data.courses.length,
        status: worstStatus(courseStatuses),
        flaggedCourseCount,
        flags,
      });
    }
    instructorSummaries.sort((a, b) =>
      STATUS_SORT[a.status] - STATUS_SORT[b.status] || a.name.localeCompare(b.name)
    );

    await writeBlob('instructors.json', { instructors: instructorSummaries });
    context.log(`Wrote instructors.json: ${instructorSummaries.length} instructors`);

    // Write per-instructor detail blobs
    for (const [userId, detail] of allDetails.entries()) {
      await writeBlob(`instructor/${userId}.json`, detail);
    }
    context.log(`Wrote ${allDetails.size} instructor detail blobs`);

    // Compute course stats across all details
    const courseStats = buildCourseStats([...allDetails.values()]);

    // Write meta with term data and course stats
    const now = Date.now();
    await writeBlob('meta.json', {
      lastSync: new Date().toISOString(),
      instructorCount: instructorSummaries.length,
      termCount: currentTerms.length,
      status: 'ok',
      error: null,
      currentTerms: currentTerms.map(t => ({
        name: t.name,
        endDate: t.endDate || null,
        daysRemaining: t.endDate
          ? Math.max(0, Math.ceil((new Date(t.endDate).getTime() - now) / 86400000))
          : null,
      })),
      upcomingTerms: upcomingTerms.map(t => ({
        name: t.name,
        startDate: t.startDate,
        daysUntilStart: Math.ceil((new Date(t.startDate).getTime() - now) / 86400000),
      })),
      courseStats,
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

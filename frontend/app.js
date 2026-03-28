// ── State ─────────────────────────────────────────────────────────────────────
let allInstructors = [];
let currentFilter = 'all';
let selectedUserId = null;
let syncMeta = null;

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadDashboard() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.textContent = '↺ Loading...';
  setInstList('<div class="empty-state"><div class="spinner"></div><p>Loading instructors...</p></div>');

  try {
    const res = await fetch('/api/instructors');
    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
      setInstList(`<div class="error-msg">${escHtml(msg)}</div>`);
      return;
    }
    const { instructors } = await res.json();
    allInstructors = instructors;
    updateFilterCounts();
    renderInstructors();
    document.getElementById('lastRefreshed').textContent =
      'Last refreshed: ' + new Date().toLocaleTimeString();
  } catch (err) {
    setInstList(`<div class="error-msg">Failed to load data. Check your connection and try again.</div>`);
  } finally {
    btn.disabled = false;
    btn.textContent = '↺ Refresh';
  }
}

async function loadDetail(userId) {
  selectedUserId = userId;
  renderInstructors(); // update selected highlight
  if (window.innerWidth <= 768) {
    const inst = allInstructors.find(i => i.userId === userId);
    document.body.classList.add('detail-open');
    document.getElementById('navbarTitle').textContent = inst?.name || 'Instructor';
    document.getElementById('termLabel').innerHTML =
      inst ? `<span class="badge ${inst.status}">${statusLabel(inst.status)}</span>` : '';
  }
  showDetailLoading();

  try {
    const res = await fetch(`/api/instructor/${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { courses } = await res.json();
    const inst = allInstructors.find(i => i.userId === userId);
    renderDetail(inst, courses);
  } catch (err) {
    document.getElementById('detail').innerHTML =
      '<div class="detail-header"><h2>Error</h2><span></span></div>' +
      `<div class="detail-scroll"><div class="error-msg">Failed to load course details: ${escHtml(err.message)}</div></div>`;
  }
}

async function loadUserInfo() {
  try {
    const res = await fetch('/.auth/me');
    if (!res.ok) return;
    const { clientPrincipal } = await res.json();
    if (clientPrincipal) {
      const name = clientPrincipal.userDetails || clientPrincipal.userId;
      const el = document.getElementById('mastheadUser');
      if (el) el.textContent = name;
    }
  } catch {
    // user info is cosmetic — silently ignore
  }
}

async function loadSyncStatus() {
  try {
    const res = await fetch('/api/sync-status');
    if (!res.ok) return;
    syncMeta = await res.json();
    const el = document.getElementById('syncStatus');
    if (!syncMeta.lastSync) {
      el.textContent = 'No sync data yet';
      return;
    }
    const days = Math.floor((Date.now() - new Date(syncMeta.lastSync).getTime()) / 86400000);
    const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
    const errFlag = syncMeta.status === 'error' ? ' ⚠ sync error' : '';
    el.textContent = `Data synced: ${when}${errFlag}`;

    const countdown = document.getElementById('termCountdown');
    if (countdown && syncMeta.currentTerms?.length) {
      const curr = syncMeta.currentTerms[0];
      let text = `${curr.name}: ${curr.daysRemaining} days`;
      if (syncMeta.upcomingTerms?.length) {
        const up = syncMeta.upcomingTerms[0];
        text += ` · ${up.name} in ${up.daysUntilStart} days`;
      }
      countdown.textContent = text;
    }
  } catch {
    // sync status is cosmetic — silently ignore
  }
}

// ── Filter ────────────────────────────────────────────────────────────────────

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-pill').forEach(el =>
    el.classList.toggle('on', el.dataset.filter === filter)
  );
  renderInstructors();
}

function goBack() {
  document.body.classList.remove('detail-open');
  document.getElementById('navbarTitle').textContent = 'Faculty Activity Dashboard';
  document.getElementById('termLabel').textContent = '';
  selectedUserId = null;
  renderInstructors();
}

function updateFilterCounts() {
  const flagged = allInstructors.filter(i => i.flaggedCourseCount > 0).length;
  const counts = { all: allInstructors.length, inactive: 0, 'at-risk': 0, active: 0 };
  for (const i of allInstructors) counts[i.status] = (counts[i.status] || 0) + 1;
  document.querySelector('[data-filter="all"]').textContent      = `All (${counts.all})`;
  document.querySelector('[data-filter="inactive"]').textContent = `Inactive (${counts.inactive || 0})`;
  document.querySelector('[data-filter="at-risk"]').textContent  = `At Risk (${counts['at-risk'] || 0})`;
  document.querySelector('[data-filter="active"]').textContent   = `Active (${counts.active || 0})`;
  document.querySelector('[data-filter="flagged"]').textContent  = `Flagged (${flagged})`;
}

// ── Render: instructor list ───────────────────────────────────────────────────

function setInstList(html) {
  document.getElementById('instList').innerHTML = html;
}

function renderStatSummary(stats) {
  return `
    <div class="stat-summary">
      <div class="stat-summary-card">
        <div class="stat-summary-value" style="color:#991b1b">${stats.zeroLogins}</div>
        <div class="stat-summary-label">Zero Logins</div>
      </div>
      <div class="stat-summary-card">
        <div class="stat-summary-value" style="color:#854d0e">${stats.noAssignments}</div>
        <div class="stat-summary-label">No Assignments</div>
      </div>
      <div class="stat-summary-card">
        <div class="stat-summary-value" style="color:#854d0e">${stats.noContentUpdate}</div>
        <div class="stat-summary-label">No Content Update</div>
      </div>
      <div class="stat-summary-card">
        <div class="stat-summary-value" style="color:#064429">${stats.total}</div>
        <div class="stat-summary-label">Total Courses</div>
      </div>
    </div>`;
}

function renderInstructors() {
  let list;
  if (currentFilter === 'flagged') {
    list = allInstructors
      .filter(i => i.flaggedCourseCount > 0)
      .sort((a, b) => b.flaggedCourseCount - a.flaggedCourseCount || a.name.localeCompare(b.name));
  } else if (currentFilter === 'all') {
    list = allInstructors;
  } else {
    list = allInstructors.filter(i => i.status === currentFilter);
  }

  if (!list.length) {
    setInstList('<div class="empty-state"><p>No instructors match this filter.</p></div>');
    return;
  }

  let html = '';
  if (currentFilter === 'flagged' && syncMeta?.courseStats) {
    html += renderStatSummary(syncMeta.courseStats);
  }

  html += list.map(i => `
    <div class="inst-row${i.userId === selectedUserId ? ' selected' : ''}"
         onclick="loadDetail('${escAttr(i.userId)}')">
      <div class="inst-name">
        <strong>${escHtml(i.name)}</strong>
        <span>${i.courseCount} course${i.courseCount !== 1 ? 's' : ''}</span>
        ${currentFilter === 'flagged' && i.flags?.length
          ? `<span class="inst-flag-line">${escHtml(i.flags.join(' · '))}</span>`
          : ''}
      </div>
      <span class="badge ${i.status}">${statusLabel(i.status)}</span>
    </div>
  `).join('');

  setInstList(html);
}

// ── Render: detail panel ──────────────────────────────────────────────────────

function showDetailLoading() {
  const inst = allInstructors.find(i => i.userId === selectedUserId);
  document.getElementById('detail').innerHTML = `
    <div class="detail-header">
      <h2>${escHtml(inst?.name || 'Instructor')}</h2>
      <span>${inst?.courseCount || 0} course${inst?.courseCount !== 1 ? 's' : ''}</span>
    </div>
    <div class="detail-scroll">
      <div class="empty-state"><div class="spinner"></div><p>Loading course detail...</p></div>
    </div>`;
}

function renderDetail(inst, courses) {
  const header = `
    <div class="detail-header">
      <h2>${escHtml(inst?.name || 'Instructor')}</h2>
      <span class="badge ${inst?.status}">${statusLabel(inst?.status)}</span>
    </div>`;

  const body = courses.length
    ? courses.map(c => {
        const accessed = c.lastAccessed ? relDate(c.lastAccessed) : 'Never';
        const content  = c.contentLastModified ? relDate(c.contentLastModified) : 'N/A';
        const accessCls = c.status === 'inactive' ? 'bad' : c.status === 'at-risk' ? 'warn' : 'good';
        return `
          <div class="course-card">
            <div class="course-card-header">
              <div>
                <div class="course-card-title">${escHtml(c.courseName)}</div>
                <div class="course-card-code">${escHtml(c.courseCode)}</div>
              </div>
              <span class="badge ${c.status}">${statusLabel(c.status)}</span>
            </div>
            <div class="metric-grid">
              <div class="metric ${accessCls}">
                <div class="metric-label">Last Login</div>
                <div class="metric-value ${accessCls}">${escHtml(accessed)}</div>
              </div>
              <div class="metric">
                <div class="metric-label">Time Spent</div>
                <div class="metric-value">${escHtml(c.timeSpent)}</div>
              </div>
              <div class="metric ${accessCls}">
                <div class="metric-label">Content Updated</div>
                <div class="metric-value ${accessCls}">${escHtml(content)}</div>
              </div>
              <div class="metric">
                <div class="metric-label">Assignments</div>
                <div class="metric-value">${c.assignmentCount ?? 0}</div>
              </div>
            </div>
          </div>`;
      }).join('')
    : '<div class="empty-state"><p>No active courses found for this instructor.</p></div>';

  document.getElementById('detail').innerHTML = header + `<div class="detail-scroll">${body}</div>`;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return escHtml(s).replace(/'/g,'&#39;');
}

function statusLabel(s) {
  return { active: 'Active', 'at-risk': 'At Risk', inactive: 'Inactive' }[s] || s || '';
}

function relDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadDashboard();
loadUserInfo();
loadSyncStatus();

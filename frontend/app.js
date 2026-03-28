// ── State ─────────────────────────────────────────────────────────────────────
let allInstructors = [];
let currentFilter = 'all';
let selectedUserId = null;

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadDashboard() {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.textContent = '↺ Loading...';
  setInstList('<div class="empty-state"><div class="spinner"></div><p>Loading instructors...</p></div>');

  try {
    const res = await fetch('/api/instructors');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { instructors } = await res.json();
    allInstructors = instructors;
    updateFilterCounts();
    renderInstructors();
    document.getElementById('lastRefreshed').textContent =
      'Last refreshed: ' + new Date().toLocaleTimeString();
  } catch (err) {
    setInstList(`<div class="error-msg">Failed to load data: ${escHtml(err.message)}</div>`);
  } finally {
    btn.disabled = false;
    btn.textContent = '↺ Refresh';
  }
}

async function loadDetail(userId) {
  selectedUserId = userId;
  renderInstructors(); // update selected highlight
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
      document.getElementById('userInfo').textContent =
        clientPrincipal.userDetails || clientPrincipal.userId;
    }
  } catch {
    // user info is cosmetic — silently ignore
  }
}

async function loadSyncStatus() {
  try {
    const res = await fetch('/api/sync-status');
    if (!res.ok) return;
    const meta = await res.json();
    const el = document.getElementById('syncStatus');
    if (!meta.lastSync) {
      el.textContent = 'No sync data yet';
      return;
    }
    const days = Math.floor((Date.now() - new Date(meta.lastSync).getTime()) / 86400000);
    const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
    const errFlag = meta.status === 'error' ? ' ⚠ sync error' : '';
    el.textContent = `Data synced: ${when}${errFlag}`;
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

function updateFilterCounts() {
  const counts = { all: allInstructors.length, inactive: 0, 'at-risk': 0, active: 0 };
  for (const i of allInstructors) counts[i.status] = (counts[i.status] || 0) + 1;
  document.querySelector('[data-filter="all"]').textContent      = `All (${counts.all})`;
  document.querySelector('[data-filter="inactive"]').textContent = `Inactive (${counts.inactive || 0})`;
  document.querySelector('[data-filter="at-risk"]').textContent  = `At Risk (${counts['at-risk'] || 0})`;
  document.querySelector('[data-filter="active"]').textContent   = `Active (${counts.active || 0})`;
}

// ── Render: instructor list ───────────────────────────────────────────────────

function setInstList(html) {
  document.getElementById('instList').innerHTML = html;
}

function renderInstructors() {
  const list = currentFilter === 'all'
    ? allInstructors
    : allInstructors.filter(i => i.status === currentFilter);

  if (!list.length) {
    setInstList('<div class="empty-state"><p>No instructors match this filter.</p></div>');
    return;
  }

  setInstList(list.map(i => `
    <div class="inst-row${i.userId === selectedUserId ? ' selected' : ''}"
         onclick="loadDetail('${escAttr(i.userId)}')">
      <div class="inst-name">
        <strong>${escHtml(i.name)}</strong>
        <span>${i.courseCount} course${i.courseCount !== 1 ? 's' : ''}</span>
      </div>
      <span class="badge ${i.status}">${statusLabel(i.status)}</span>
    </div>
  `).join(''));
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
        const gradesCls = c.gradesPosted === 'None' ? 'bad' : 'good';
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
              <div class="metric ${gradesCls}">
                <div class="metric-label">Grades Posted</div>
                <div class="metric-value ${gradesCls}">${escHtml(c.gradesPosted)}</div>
              </div>
            </div>
            <div class="stat-row">
              <div class="stat">
                <div class="stat-label">Discussion Posts</div>
                <div class="stat-value">${c.instructorDiscussionPosts}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Grade Columns</div>
                <div class="stat-value">${c.gradeColumnsCount}</div>
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

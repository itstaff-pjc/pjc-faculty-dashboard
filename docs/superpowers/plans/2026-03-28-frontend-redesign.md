# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Faculty Activity Dashboard frontend with official PJC brand colors, a white logo masthead, and mobile-responsive drill-down navigation.

**Architecture:** Pure HTML/CSS/JS — no framework, no new dependencies. Three files change: `styles.css` (color tokens + new masthead/navbar/responsive styles), `index.html` (add masthead div, restructure navbar), `app.js` (mobile drill-down logic, update user info to populate masthead). The mobile drill-down uses a `detail-open` CSS class toggled on `<body>` to show/hide list vs detail view at narrow widths.

**Tech Stack:** Vanilla HTML/CSS/JS, Azure Static Web Apps, CSS custom properties

**Design spec:** `docs/superpowers/specs/2026-03-28-frontend-design.md`

---

## File Map

| File | Change |
|---|---|
| `frontend/styles.css` | Update `:root` color tokens; replace `.header` block with `.masthead` + `.navbar`; add metric border colors; add `@media (max-width: 768px)` block |
| `frontend/index.html` | Add `.masthead` div above `<header>`; rename `header.header` → `header.navbar`; add `.back-btn` and `.navbar-signout` elements |
| `frontend/app.js` | Update `loadUserInfo` to populate `#mastheadUser`; update `loadDetail` to trigger mobile drill-down; add `goBack()` function; add metric status class to `.metric` container in `renderDetail` |

---

## Task 1: Update CSS color tokens

**Files:**
- Modify: `frontend/styles.css` lines 1–15

- [ ] **Step 1: Replace the `:root` block**

In `frontend/styles.css`, replace the entire `:root { … }` block (currently lines 3–15) with:

```css
:root {
  --green:       #064429;
  --green-dark:  #042e1c;
  --green-light: #e6f0ec;
  --gold:        #FFC72C;
  --gold-dark:   #e0ae20;
  --text:        #1a1a1a;
  --text-muted:  #6b7280;
  --border:      #dde8e3;
  --bg:          #f5f8f6;
  --active-bg: #dcfce7; --active-text: #166534;
  --risk-bg: #fef9c3;   --risk-text: #854d0e;
  --inactive-bg: #fee2e2; --inactive-text: #991b1b;
}
```

- [ ] **Step 2: Fix hardcoded selected-row background color**

In `frontend/styles.css`, find `.inst-row.selected` and update its background from the old hardcoded hex to the correct brand-derived value:

```css
.inst-row.selected { background: #eaf4ef; border-left-color: var(--gold); }
```

- [ ] **Step 3: Visual check**

Open `frontend/index.html` directly in a browser (or `npx serve frontend`). Confirm the page header bar is now a noticeably darker green than before. No other layout changes expected yet.

- [ ] **Step 4: Commit**

```bash
git add frontend/styles.css
git commit -m "style: update CSS color tokens to official PJC brand colors (#064429, #FFC72C)"
```

---

## Task 2: Restructure HTML — add masthead, rename navbar

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Replace the `<header>` block**

In `frontend/index.html`, replace the entire `<header class="header"> … </header>` block with:

```html
<div class="masthead">
  <img src="PJCLogo_Stacked_FullColor_NoLocations.jpg" alt="Paris Junior College">
  <div class="masthead-right">
    <span class="masthead-user" id="mastheadUser"></span>
    <a class="masthead-signout" href="/.auth/logout">Sign out</a>
  </div>
</div>
<header class="navbar">
  <button class="back-btn" id="backBtn" onclick="goBack()">‹</button>
  <span class="navbar-title" id="navbarTitle">Faculty Activity Dashboard</span>
  <span class="navbar-meta" id="termLabel"></span>
  <div class="navbar-right">
    <a class="navbar-signout" href="/.auth/logout">Sign out</a>
    <button class="refresh-btn" id="refreshBtn" onclick="loadDashboard()">↺ Refresh</button>
  </div>
</header>
```

- [ ] **Step 2: Visual check**

Reload the page. The old header will be unstyled/broken — that is expected. Confirm the logo `<img>` and both "Sign out" links appear somewhere on the page (confirming HTML structure is correct before CSS is applied).

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "markup: add masthead div, rename header to navbar, add back-btn and mobile sign-out"
```

---

## Task 3: CSS — masthead and navbar styles

**Files:**
- Modify: `frontend/styles.css`

- [ ] **Step 1: Remove old header CSS**

Delete the entire `/* ── Header ── */` block from `frontend/styles.css` (currently lines 27–48):

```css
/* ── Header ── */
.header { … }
.header img { … }
.header-title { … }
.header-meta { … }
.refresh-btn { … }
.refresh-btn:hover { … }
.refresh-btn:disabled { … }
```

Also delete the `.header-right`, `.user-info`, and `.logout-link` blocks near the bottom of the file (lines 160–183).

- [ ] **Step 2: Add masthead and navbar CSS**

In place of the deleted header block, insert:

```css
/* ── Masthead ── */
.masthead {
  background: #ffffff;
  border-bottom: 1px solid var(--border);
  padding: 14px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.masthead img { height: 52px; width: auto; }
.masthead-right {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: var(--text-muted);
}
.masthead-signout {
  color: var(--green);
  text-decoration: none;
  font-weight: 600;
}
.masthead-signout:hover { text-decoration: underline; }

/* ── Navbar ── */
.navbar {
  background: var(--green);
  border-bottom: 4px solid var(--gold);
  padding: 0 28px;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}
.back-btn {
  display: none; /* shown on mobile only */
  background: none;
  border: none;
  color: var(--gold);
  font-size: 22px;
  font-weight: 700;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.navbar-title { color: white; font-size: 16px; font-weight: 600; flex: 1; }
.navbar-meta  { color: rgba(255,255,255,.55); font-size: 11px; }
.navbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.navbar-signout {
  display: none; /* shown on mobile only */
  color: var(--gold);
  font-size: 12px;
  text-decoration: none;
  font-weight: 600;
}
.refresh-btn {
  background: var(--gold); color: var(--green);
  border: none; padding: 6px 14px; border-radius: 5px;
  font-size: 12px; font-weight: 800; cursor: pointer; transition: background .15s;
}
.refresh-btn:hover { background: var(--gold-dark); }
.refresh-btn:disabled { opacity: .6; cursor: not-allowed; }
```

- [ ] **Step 3: Visual check**

Reload the page. Confirm:
- White bar with PJC logo at top
- Dark green nav bar (`#064429`) below it with a bright gold bottom border
- "Faculty Activity Dashboard" title in white
- Gold "↺ Refresh" button on the right
- No leftover unstyled elements

- [ ] **Step 4: Commit**

```bash
git add frontend/styles.css
git commit -m "style: add masthead and navbar CSS, remove old header styles"
```

---

## Task 4: CSS — metric card colored left borders

**Files:**
- Modify: `frontend/styles.css`

- [ ] **Step 1: Update `.metric` to support border-left status variants**

Find the `.metric` rule in `frontend/styles.css` (currently: `background: var(--bg); border-radius: 5px; padding: 7px 10px;`) and replace it with:

```css
.metric { background: var(--bg); border-radius: 5px; padding: 7px 10px; border-left: 3px solid #9ca3af; }
.metric.bad  { border-left-color: #dc2626; }
.metric.warn { border-left-color: #ca8a04; }
.metric.good { border-left-color: #16a34a; }
```

- [ ] **Step 2: Update `app.js` to add status class to `.metric` container**

In `frontend/app.js`, find the `renderDetail` function. Replace the four `.metric` divs inside the `metric-grid` template literal with:

```javascript
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
```

- [ ] **Step 3: Visual check**

Select an instructor. Confirm course cards now show colored left borders on each metric tile: red for inactive/bad values, yellow for at-risk, green for active/good.

- [ ] **Step 4: Commit**

```bash
git add frontend/styles.css frontend/app.js
git commit -m "style: add colored left borders to metric tiles for at-a-glance status"
```

---

## Task 5: CSS — mobile responsive styles

**Files:**
- Modify: `frontend/styles.css`

- [ ] **Step 1: Add the mobile media query block at the end of `styles.css`**

Append to the bottom of `frontend/styles.css`:

```css
/* ── Mobile (≤768px) ── */
@media (max-width: 768px) {
  body { overflow: auto; height: auto; }

  /* Masthead: center logo, hide user info */
  .masthead { padding: 10px 16px; justify-content: center; }
  .masthead-right { display: none; }

  /* Navbar: compact, show mobile-only controls */
  .navbar { padding: 0 14px; height: 46px; gap: 8px; }
  .navbar-meta { display: none; }
  .back-btn { display: flex; }
  .navbar-signout { display: block; }

  /* Filter toolbar: allow pills to wrap */
  .toolbar { padding: 8px 14px; flex-wrap: wrap; }

  /* Single column layout */
  .main { grid-template-columns: 1fr; }
  .inst-list { border-right: none; height: auto; }

  /* Drill-down: detail hidden until instructor tapped */
  .detail { display: none; }
  body.detail-open .inst-list { display: none; }
  body.detail-open .detail { display: flex; }

  /* Detail panel fills screen when open */
  body.detail-open .main { height: calc(100vh - 130px); }
}
```

- [ ] **Step 2: Visual check at mobile width**

In Chrome DevTools, set viewport to 375px wide. Confirm:
- Logo centered in white masthead, user info hidden
- Green nav bar shows just the title and Refresh button
- Filter pills stack if needed
- Full-width instructor list
- Detail panel is not visible yet

- [ ] **Step 3: Commit**

```bash
git add frontend/styles.css
git commit -m "style: add mobile responsive layout with drill-down CSS hooks"
```

---

## Task 6: JS — mobile drill-down logic and masthead user info

**Files:**
- Modify: `frontend/app.js`

- [ ] **Step 1: Add `goBack()` function**

In `frontend/app.js`, add the following function after the `setFilter` function (around line 84):

```javascript
function goBack() {
  document.body.classList.remove('detail-open');
  document.getElementById('navbarTitle').textContent = 'Faculty Activity Dashboard';
  document.getElementById('termLabel').textContent = '';
  selectedUserId = null;
  renderInstructors();
}
```

- [ ] **Step 2: Update `loadDetail` to trigger mobile drill-down**

In `frontend/app.js`, find `async function loadDetail(userId)`. After the line `renderInstructors(); // update selected highlight`, add:

```javascript
  if (window.innerWidth <= 768) {
    const inst = allInstructors.find(i => i.userId === userId);
    document.body.classList.add('detail-open');
    document.getElementById('navbarTitle').textContent = inst?.name || 'Instructor';
    document.getElementById('termLabel').innerHTML =
      inst ? `<span class="badge ${inst.status}">${statusLabel(inst.status)}</span>` : '';
  }
```

- [ ] **Step 3: Update `loadUserInfo` to populate the masthead**

In `frontend/app.js`, replace the entire `loadUserInfo` function with:

```javascript
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
```

- [ ] **Step 4: Visual check — desktop**

Reload at full desktop width. Confirm:
- Masthead shows your email address and "Sign out" link
- Clicking an instructor opens the detail panel on the right as before
- No `detail-open` class added on desktop

- [ ] **Step 5: Visual check — mobile**

In DevTools at 375px wide:
- Tapping an instructor should make the instructor list disappear and the detail panel fill the screen
- Nav bar should show `‹` (gold), instructor name (white), status badge
- Tapping `‹` should return to the instructor list with "Faculty Activity Dashboard" in the nav bar

- [ ] **Step 6: Commit**

```bash
git add frontend/app.js
git commit -m "feat: mobile drill-down navigation, masthead user info"
```

---

## Task 7: Run existing API tests and push

**Files:** none changed

- [ ] **Step 1: Run API tests to confirm nothing regressed**

```bash
cd api && npm test
```

Expected: all 40 tests pass. These test the API functions, not the frontend — they should be unaffected. If any fail, stop and investigate before proceeding.

- [ ] **Step 2: Final visual QA checklist**

Open the live site or local `npx serve frontend` and verify each item:

Desktop:
- [ ] White masthead with PJC logo (height ~52px) visible on left
- [ ] Signed-in email + "Sign out" link on right of masthead
- [ ] Dark green nav bar (`#064429`) with bright gold bottom border (`#FFC72C`)
- [ ] "Faculty Activity Dashboard" title in white, Refresh button gold
- [ ] Selected instructor row has gold left border + light green background
- [ ] Course cards have colored left borders on metric tiles
- [ ] Detail panel header is gold background with green text

Mobile (375px in DevTools):
- [ ] Logo centered, user info hidden in masthead
- [ ] Nav bar compact, only title + Refresh visible by default
- [ ] Tapping instructor → list disappears, detail fills screen
- [ ] Nav bar shows `‹` + instructor name + status badge
- [ ] Tapping `‹` returns to list, nav bar resets to "Faculty Activity Dashboard"
- [ ] Filter pills wrap properly

- [ ] **Step 3: Push to deploy**

```bash
git push origin main
```

GitHub Actions will deploy to `https://thankful-sky-0a72df11e.1.azurestaticapps.net`. Wait ~2 minutes, then verify the live site.

---

## Color Reference

| Token | Value | Used for |
|---|---|---|
| `--green` | `#064429` | Nav bar bg, active pill, course titles, stat values, selected border |
| `--green-dark` | `#042e1c` | Stat label text |
| `--green-light` | `#e6f0ec` | Filter toolbar bg, stat tile bg, hover bg |
| `--gold` | `#FFC72C` | Nav bar bottom border (4px), detail header bg, selected row left border, back arrow |
| `--gold-dark` | `#e0ae20` | Refresh hover, detail header bottom border |
| `--bg` | `#f5f8f6` | Page bg, metric tile bg |
| `--border` | `#dde8e3` | All dividers and card borders |

# Designer View — Design Spec

**Date:** 2026-03-28
**Author:** Sebastian Barron, VP of Technology, Paris Junior College
**Status:** Approved

---

## Overview

Designer view is integrated directly into the existing Faculty Activity Dashboard rather than a separate tab. Two additions: a term countdown in the toolbar, and a "Flagged" filter pill that re-sorts the instructor list by most flagged courses and shows aggregate stat cards above the list. Clicking any instructor still opens their course detail on the right as normal.

---

## Layout Changes (delta from existing)

```
┌─────────────────────────────────────────────────────────────────┐
│  WHITE MASTHEAD                                                  │
├─────────────────────────────────────────────────────────────────┤
│  GREEN NAVBAR — title                          [↺ Refresh]      │
├─────────────────────────────────────────────────────────────────┤
│  TOOLBAR                                                         │
│  [All(8)] [Inactive(2)] [At Risk(2)] [Active(4)] [Flagged(5)]  │
│                        Spring 2026: 48 days · Summer in 52 days │
├──────────────────────────┬──────────────────────────────────────┤
│  INSTRUCTOR LIST         │  COURSE DETAIL PANEL (unchanged)     │
│                          │                                       │
│  [when Flagged selected] │                                       │
│  ┌──┐┌──┐┌──┐┌──┐       │                                       │
│  │12││ 8││ 6││43│        │                                       │
│  └──┘└──┘└──┘└──┘       │                                       │
│  ─────────────────────   │                                       │
│  1. Miller, Paul ●●      │                                       │
│  2. Davis, Jennifer ●●●  │                                       │
│  3. Jones, Michael ●     │                                       │
└──────────────────────────┴──────────────────────────────────────┘
```

---

## Term Countdown (toolbar)

Added to the right side of the toolbar, replacing or sitting alongside the existing sync status text.

- Format: `Spring 2026: 48 days · Summer in 52 days`
- Shows current term name + days remaining, then first upcoming term name + days until start
- If no upcoming term: shows only the current term countdown
- Color: `var(--text-muted)`, 10px, same line as sync status
- Data source: `currentTerms[0]` and `upcomingTerms[0]` from `/api/sync-status`

---

## Flagged Filter Pill

Added as a fifth pill after "Active" in the toolbar filter row.

- Label: `Flagged (N)` where N = count of instructors with `flaggedCourseCount > 0`
- Unselected style: white background, `#064429` text, `#dde8e3` border (neutral — not a status color)
- Selected style: same as other selected pills (`#064429` background, white text)
- When selected:
  - Instructor list shows only instructors with `flaggedCourseCount > 0`
  - Sorted descending by `flaggedCourseCount`, then alphabetically
  - Stat summary cards appear above the list (see below)
- When deselected: normal list view resumes, stat cards hidden

---

## Stat Summary Cards (Flagged view only)

A row of 4 compact cards shown above the instructor list only when Flagged filter is active.

| Card | Value | Text color |
|---|---|---|
| Zero Logins | courses where `lastAccessed === null` | `#991b1b` |
| No Assignments | courses where `assignmentCount === 0` | `#854d0e` |
| No Content Update | courses where `contentLastModified === null` | `#854d0e` |
| Total Courses | all courses across all instructors | `#064429` |

Style: white background, `border: 1px solid #dde8e3`, `border-radius: 6px`, compact padding. Value is bold 20px, label is 9px muted below. Cards sit in a 4-column grid above the instructor rows, inside the `inst-list` panel.

These counts are computed from the `instructors` array already loaded in memory (no extra API call). Each instructor entry in `instructors.json` includes `flaggedCourseCount` and `flags`; individual course data is not needed for the counts since they are pre-computed into `courseStats` in `/api/sync-status`.

---

## Instructor Row (Flagged view)

Each row in the Flagged view shows the same layout as normal, plus flag pills below the name:

```
┌──────────────────────────────────────────────────┐
│ Miller, Paul              [Inactive badge]        │
│ 2 courses · 18 days inactive · 0 assignments     │  ← flag summary line
└──────────────────────────────────────────────────┘
```

The flag summary line is a single muted text line (10px, `var(--text-muted)`) listing the instructor's flags joined with `·`. Shown only in Flagged view, hidden in all other filter views.

---

## Data Architecture

### `instructors.json` — two new fields per instructor

```json
{
  "userId": "pmiller",
  "name": "Miller, Paul",
  "status": "inactive",
  "courseCount": 2,
  "flaggedCourseCount": 2,
  "flags": ["18 days inactive", "0 assignments"]
}
```

`flaggedCourseCount` = number of the instructor's courses with any flag.
`flags` = human-readable string array, deduplicated and grouped (e.g. "0 assignments (2 courses)").

**A course is flagged if any of:**
1. `status === 'inactive'` → "N days inactive" (or "Never logged in" if `lastAccessed === null`)
2. `assignmentCount === 0` → "0 assignments"
3. `contentLastModified === null` → "No content update"

### `meta.json` — four new fields

```json
{
  "lastSync": "...",
  "status": "ok",
  "instructorCount": 200,
  "termCount": 1,
  "currentTerms": [
    { "name": "Spring 2026", "endDate": "2026-05-15T00:00:00Z", "daysRemaining": 48 }
  ],
  "upcomingTerms": [
    { "name": "Summer 2026", "startDate": "2026-06-02T00:00:00Z", "daysUntilStart": 52 }
  ],
  "courseStats": {
    "total": 850,
    "zeroLogins": 120,
    "noAssignments": 80,
    "noContentUpdate": 60
  }
}
```

`/api/sync-status` already reads and returns `meta.json` — no endpoint changes needed. The frontend reads these new fields from the existing sync-status response.

### `getUpcomingTerms(allTerms, startYear)`

Pure function — filters the already-fetched `allTerms` array for terms where `startDate > now` and `availability.available === 'Yes'` and year >= startYear. Returns up to 2, sorted ascending by startDate. **Zero additional Blackboard API calls.**

---

## File Map

| File | Change |
|---|---|
| `api-sync/sync/index.js` | Add `getUpcomingTerms()`, `computeFlags()`, `buildCourseStats()`. Write `flaggedCourseCount` + `flags` into each instructor summary. Write `currentTerms`, `upcomingTerms`, `courseStats` into `meta.json`. |
| `api-sync/tests/sync.test.js` | Add assertions for new fields on instructor summaries and meta.json |
| `frontend/app.js` | Handle `flagged` filter: sort by `flaggedCourseCount`, render stat cards, render flag summary line per row. Read term countdown from sync-status response and render in toolbar. |
| `frontend/styles.css` | Add `.stat-summary`, `.stat-summary-card`, `.inst-flag-line` styles |
| `frontend/index.html` | Add term countdown `<span id="termCountdown">` to toolbar |

No new API endpoints. No new blobs.

---

## Mobile Behavior

- Term countdown: wraps to second line in toolbar if needed, or truncates to just `48 days left`
- Stat cards: 2×2 grid at ≤768px
- Flag summary line: visible in instructor rows as normal

---

## Out of Scope

- Filtering stat cards by term
- Clicking a stat card to filter by that flag type
- Email / contact button on instructor rows

# Designer View — Design Spec

**Date:** 2026-03-28
**Author:** Sebastian Barron, VP of Technology, Paris Junior College
**Status:** Approved

---

## Overview

A "Designer View" tab on the Faculty Activity Dashboard giving Darrell Elliott (instructional designer) an at-a-glance picture of course health and a prioritized list of instructors to contact for support. Accessible to all dashboard users via a view toggle in the toolbar.

---

## Layout

```
┌─────────────────────────────────────────────────┐
│  WHITE MASTHEAD                                  │
├─────────────────────────────────────────────────┤
│  GREEN NAVBAR                                    │
├─────────────────────────────────────────────────┤
│  TOOLBAR: [Faculty] [Designer View]  sync status │
├─────────────────────────────────────────────────┤
│  DESIGNER PANEL (full width, scrollable)         │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  TERM BANNER (dark green)                │   │
│  │  Current term + days remaining           │   │
│  │  Upcoming terms + days until start       │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │  12  │ │   8  │ │   6  │ │  43  │           │
│  │ Zero │ │ No   │ │ No   │ │Total │           │
│  │login │ │Asgmt │ │Cntnt │ │      │           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  PRIORITY CONTACT LIST (gold header)     │   │
│  │  1. Miller, Paul  · 2 courses flagged    │   │
│  │  2. Davis, Jennifer · 3 courses flagged  │   │
│  │  ...                                     │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

When Designer View is active, the instructor list and detail panel are hidden. The filter pills are also hidden (not relevant in this view). Switching back to Faculty restores the normal layout.

---

## Term Banner

- **Background:** `#064429` (dark green), rounded corners
- **Left section:** "Current Term" label + term name in white
- **Center:** Days remaining as a large gold number (`#FFC72C`) with "days remaining" label
- **Divider(s):** 1px `rgba(255,255,255,.15)` vertical rules
- **Right sections:** Up to 2 upcoming terms (nearest first), each showing name + "starts in N days · MMM D"
- **Data source:** `currentTerms` and `upcomingTerms` arrays from `/api/designer-summary`
- If no upcoming terms: the upcoming sections are omitted

---

## Stat Cards

Four cards in a row (2×2 on mobile):

| Card | Value | Color |
|---|---|---|
| Courses · Zero Logins | Count of courses where `lastAccessed === null` | `#991b1b` (red) |
| Courses · No Assignments | Count of courses where `assignmentCount === 0` | `#854d0e` (amber) |
| Courses · No Content Update | Count of courses where `contentLastModified === null` | `#854d0e` (amber) |
| Total Active Courses | Total course count across all active term instructors | `#064429` (green) |

Cards are white with `border: 1px #dde8e3`, `border-radius: 8px`, `box-shadow: 0 1px 3px rgba(0,0,0,.05)`. Value is 28px bold, label is 10px muted below.

---

## Priority Contact List

**Header:** Gold (`#FFC72C`) background, green text. Shows "N instructors flagged · sorted by most issues".

**Ranking:** Instructors sorted descending by `flaggedCourseCount` (number of their courses that have at least one flag). Ties broken alphabetically.

**A course is flagged if it has any of:**
- `lastAccessed === null` (zero logins)
- `assignmentCount === 0` (no assignments)
- `contentLastModified === null` (no content update)

**Each row shows:**
- Rank number (circle, red for inactive, amber for at-risk)
- Instructor name (bold) + "N courses flagged" (muted)
- Reason pills: human-readable flags e.g. "Never logged in", "0 assignments (2 courses)", "8 days inactive (1 course)"
- Status badge (Inactive / At Risk / Active) on the right

**Only instructors with at least one flagged course appear** in the list.

---

## Data Architecture

### New blob: `designer-summary.json`

Written by the nightly sync. Structure:

```json
{
  "computedAt": "2026-03-28T05:00:00.000Z",
  "currentTerms": [
    { "name": "Spring 2026", "endDate": "2026-05-15T00:00:00Z", "daysRemaining": 48 }
  ],
  "upcomingTerms": [
    { "name": "Summer 2026", "startDate": "2026-06-02T00:00:00Z", "daysUntilStart": 52 },
    { "name": "Fall 2026",   "startDate": "2026-08-25T00:00:00Z", "daysUntilStart": 142 }
  ],
  "courseStats": {
    "total": 850,
    "zeroLogins": 120,
    "noAssignments": 80,
    "noContentUpdate": 60
  },
  "priorityContacts": [
    {
      "userId": "pmiller",
      "name": "Miller, Paul",
      "status": "inactive",
      "flaggedCourseCount": 2,
      "flags": ["Never logged in", "0 assignments (2 courses)"]
    }
  ]
}
```

### New sync function: `getUpcomingTerms(allTerms)`

Filters the already-fetched terms list (passed in from `getActiveTerms`'s fetch) for terms where `startDate > now` and `availability.available === 'Yes'` and start year >= `BB_START_YEAR`. Sorted ascending by startDate. Returns up to 2. **No additional Blackboard API calls.**

### New sync function: `buildDesignerSummary(allCourses, instructorMap, activeTerms, upcomingTerms)`

Computes all fields above from in-memory data already fetched during the sync run. No additional Blackboard API calls.

### New API endpoint: `GET /api/designer-summary`

- Reads `designer-summary.json` from blob storage
- Returns `200` with the blob contents
- Returns `503 { error: 'No sync data available. The nightly sync has not run yet.' }` if blob not found
- Returns `500 { error: 'Failed to load designer summary' }` on other errors
- 60-second in-memory cache (same pattern as sync-status)

---

## File Map

| File | Change |
|---|---|
| `api-sync/sync/index.js` | Add `getUpcomingTerms()`, `buildDesignerSummary()`, write `designer-summary.json` at end of sync |
| `api/designer-summary/index.js` | New: reads `designer-summary.json` blob, returns it |
| `api/designer-summary/function.json` | New: function binding config |
| `frontend/index.html` | Add view toggle buttons (Faculty / Designer View) to toolbar; add `#designerPanel` div |
| `frontend/app.js` | Add `loadDesignerView()`, `renderDesignerView()`, `setView()` functions |
| `frontend/styles.css` | Add `.view-toggle`, `.designer-panel`, `.term-banner`, `.stat-cards`, `.priority-list` styles |

---

## Mobile Behavior

- Stat cards: 2×2 grid at ≤768px
- Term banner: stacks vertically (current term on top, upcoming below)
- Priority list: full width, scrollable
- View toggle buttons: remain visible in toolbar

---

## Flag Logic (definitive)

A course is flagged if **any** of these are true:
1. `status === 'inactive'` → pill: "Never logged in" (if lastAccessed null) or "N days inactive"
2. `assignmentCount === 0` → pill: "0 assignments"
3. `contentLastModified === null` → pill: "No content update"

**`flaggedCourseCount`** = number of the instructor's courses matching any condition above.

**Stat card definitions** (independent of flagging):
- `zeroLogins` = courses where `lastAccessed === null`
- `noAssignments` = courses where `assignmentCount === 0`
- `noContentUpdate` = courses where `contentLastModified === null`
- `total` = all courses across all active-term instructors

Flags of the same type are grouped in the display pill (e.g., "0 assignments (2 courses)").

---

## Out of Scope

- Clicking an instructor in the contact list does not navigate to their detail (future enhancement)
- No email/contact button
- No per-term breakdown of stats (all active terms combined)
- No date filter or manual refresh of designer data independent of the main Refresh button

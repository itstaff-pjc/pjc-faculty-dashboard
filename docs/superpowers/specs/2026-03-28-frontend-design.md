# Frontend Design Spec — PJC Faculty Activity Dashboard

**Date:** 2026-03-28
**Author:** Sebastian Barron, VP of Technology, Paris Junior College
**Status:** Approved

---

## Overview

A clean, mobile-responsive redesign of the Faculty Activity Dashboard frontend using official PJC brand colors. The design keeps the existing split-panel layout and vanilla HTML/CSS/JS stack while introducing a proper branded masthead, correct official colors, improved metric card readability, and a drill-down mobile navigation pattern.

---

## Brand Colors

| Token | Hex | Usage |
|---|---|---|
| `--green` | `#064429` | Nav bar, filter pills (active), instructor name text, course card titles, stat values |
| `--green-dark` | `#042e1c` | Stat label text, deep hover states |
| `--green-light` | `#e6f0ec` | Filter toolbar background, stat card backgrounds, hover tint |
| `--gold` | `#FFC72C` | Nav bar bottom border (4px), detail panel header background, selected row left border, back arrow on mobile |
| `--gold-dark` | `#e0ae20` | Detail header bottom border, Refresh button hover |
| `--bg` | `#f5f8f6` | Page background, metric tile background |
| `--border` | `#dde8e3` | All dividers and card borders |

Status colors (unchanged — standard semantic):
- Inactive: `#fee2e2` / `#991b1b`
- At Risk: `#fef9c3` / `#854d0e`
- Active: `#dcfce7` / `#166534`

---

## Layout Structure

```
┌─────────────────────────────────────────────────┐
│  WHITE MASTHEAD — PJC logo (left) + user (right) │
├─────────────────────────────────────────────────┤  ← 4px gold border
│  GREEN NAV BAR — title · term · Refresh button   │
├─────────────────────────────────────────────────┤
│  LIGHT GREEN FILTER TOOLBAR — pills + sync status│
├──────────────────────┬──────────────────────────┤
│  INSTRUCTOR LIST     │  COURSE DETAIL PANEL      │
│  (320px, white bg)   │  (flex 1, light bg)       │
│                      │                           │
│  • sorted by status  │  Gold header bar          │
│  • gold left border  │  Scrollable course cards  │
│    on selected row   │                           │
└──────────────────────┴──────────────────────────┘
```

---

## Header — Masthead

- **Background:** white (`#ffffff`)
- **Border bottom:** 1px `#dde8e3`
- **Logo:** `PJCLogo_Stacked_FullColor_NoLocations.jpg`, height 52px, left-aligned
- **Right side:** signed-in email address (from `/.auth/me`) + "Sign out" link in `#064429`
- **Padding:** 14px 28px

## Header — Nav Bar

- **Background:** `#064429`
- **Border bottom:** 4px solid `#FFC72C`
- **Height:** 50px
- **Contents (left to right):**
  - "Faculty Activity Dashboard" — white, 16px, font-weight 600
  - Active term label (e.g. "Spring 2026") — `rgba(255,255,255,.55)`, 11px
  - Refresh button — gold background (`#FFC72C`), green text (`#064429`), font-weight 800

---

## Filter Toolbar

- **Background:** `#e6f0ec`
- **Border bottom:** 1px `#dde8e3`
- **Padding:** 9px 28px
- **Filter pills:** All / Inactive / At Risk / Active with counts
  - Selected pill (any): `#064429` background, white text
  - Inactive pill (unselected): `#fee2e2` background, `#991b1b` text, `#fca5a5` border
  - At Risk pill (unselected): `#fef9c3` background, `#854d0e` text, `#fde047` border
  - Active pill (unselected): `#dcfce7` background, `#166534` text, `#86efac` border
- **Right side:** "Data synced: today · Last refreshed: HH:MM AM" — 10px, muted

---

## Instructor List Panel

- **Width:** 320px (desktop), full-width (mobile)
- **Background:** white
- **Border right:** 1px `#dde8e3`
- Each row:
  - Padding: 11px 18px
  - Border bottom: 1px `#dde8e3`
  - Border left: 3px solid transparent (default) → `#FFC72C` when selected
  - Background: white (default) → `#eaf4ef` when selected
  - Left: instructor name (13px, font-weight 600) + course count (11px, muted)
  - Right: status badge
- Sort order: Inactive first, At Risk second, Active last

---

## Course Detail Panel

**Header bar:**
- Background: `#FFC72C`
- Border bottom: 2px `#e0ae20`
- Padding: 11px 22px
- Left: instructor name — 14px, font-weight 700, color `#064429`
- Right: instructor status badge

**Course cards:**
- Background: white
- Border: 1px `#dde8e3`, border-radius 8px
- Box shadow: `0 1px 3px rgba(0,0,0,.06)`
- Padding: 13px 15px
- Gap between cards: 10px

Each card contains:
1. **Card header** — course name (`#064429`, bold) + course code (muted) on left; status badge on right
2. **Metric grid** (2×2):
   - Last Login, Time Spent, Content Updated, Grades Posted
   - Each metric tile has a colored 3px left border: red (bad), yellow (warn), green (good), gray (neutral)
   - Label: 9px uppercase, muted; Value: 12px, bold, color matches border
3. **Stat row** (2 cols):
   - "Logins This Term" and "Discussion Posts"
   - Background: `#e6f0ec`, label in `#042e1c`, value in `#064429`

---

## Mobile Responsive Behavior

**Breakpoint:** `max-width: 768px`

At mobile widths:
- Masthead: logo centered, email hidden; "Sign out" link moves into the nav bar (right side, gold text)
- Nav bar: title left, Refresh button right (compact)
- Filter toolbar: pills wrap to two rows if needed
- Split panel becomes single column — only the instructor list is shown initially
- **Drill-down navigation:** tapping an instructor replaces the list view with the full-screen detail view
  - Nav bar shows: gold `‹` back arrow + instructor name + status badge
  - Tapping `‹` returns to the instructor list
- Course cards fill the full screen width

---

## File Changes

| File | Change |
|---|---|
| `frontend/styles.css` | Full rewrite with new color tokens and responsive styles |
| `frontend/index.html` | Add masthead section above nav bar; update nav bar markup; add mobile back-button element |
| `frontend/app.js` | Add mobile drill-down logic (show/hide list vs detail view on mobile); update `loadUserInfo` to populate masthead email |

No new files, no new dependencies. Stays vanilla HTML/CSS/JS.

---

## Out of Scope

- Typography changes (system font stack unchanged)
- Animations beyond existing spinner
- Dark mode
- Print stylesheet

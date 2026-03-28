# Design Spec: Persistent Storage + SSO
**Date:** 2026-03-28
**Status:** Approved
**Goal:** Pull all Blackboard data once nightly, store it persistently, enforce FERPA-compliant access via Azure AD SSO.

---

## Problem Statement

The current architecture calls Blackboard's REST API on every dashboard load. This:
- Exhausts Blackboard's rate limit (75k calls/day) during heavy use or setup testing
- Makes the dashboard slow (30–60s loads while Blackboard responds)
- Provides no protection against Blackboard downtime affecting visibility

The fix: decouple the dashboard from Blackboard entirely. Pull once at midnight, serve from storage all day.

---

## Architecture

```
[GitHub Actions / Azure Timer Trigger]
        ↓ nightly at midnight
[sync function] → Blackboard REST API
        ↓ writes
[Azure Blob Storage] ← encrypted at rest, private
        ↑ reads
[HTTP API functions] → authenticated users only
        ↑
[Azure Static Web Apps] ← Azure AD SSO (parisjc.edu)
        ↑
[Browser]
```

---

## Components

### 1. Azure Blob Storage (new)
- **Container:** `faculty-dashboard-data` (private, no public access)
- **Blobs:**
  - `instructors.json` — master list of all instructors with status, course count
  - `instructor/{userId}.json` — full course detail per instructor
  - `meta.json` — last sync timestamp, term info, record counts
- **Security:** private container, access via Azure Managed Identity only (no connection strings in code)
- **Encryption:** Azure Storage encrypts all data at rest by default (AES-256)
- **Retention:** overwritten nightly; no historical data retained (FERPA minimum retention principle)

### 2. Nightly Sync Function (new)
- **Trigger:** Timer Trigger, cron `0 0 5 * * *` (midnight CDT = 05:00 UTC)
- **Deployed as:** Standalone Azure Functions Consumption Plan app (`pjc-faculty-sync`) in `rg-pjc-helpdesk`
- **What it does:**
  1. Fetches all active 2026 terms from Blackboard
  2. Fetches all courses for those terms
  3. Fetches instructor memberships for all courses
  4. For each instructor, fetches full course detail (time spent, content, grades, discussions)
  5. Writes `instructors.json`, one `instructor/{userId}.json` per instructor, `meta.json`
- **On failure:** writes error state to `meta.json`; existing blobs remain intact (stale but available)
- **Env vars:** `BB_BASE_URL`, `BB_CLIENT_KEY`, `BB_CLIENT_SECRET`, `BB_START_YEAR`, `STORAGE_ACCOUNT_NAME`
- **Cost:** Free tier (30 executions/month, ~5–10 min each; well under 400k GB-s free tier)

### 3. HTTP API Functions (modified)
- `/api/instructors` — reads `instructors.json` from blob instead of calling Blackboard
- `/api/instructor/:id` — reads `instructor/{userId}.json` from blob instead of calling Blackboard
- `/api/sync-status` (new) — returns contents of `meta.json` (last sync time, record count, any errors)
- All Blackboard API call code removed from these functions; they become simple blob readers
- In-memory cache retained (5 min TTL) to reduce blob reads within a session

### 4. Azure AD SSO (new)
- Azure Static Web Apps built-in authentication, provider: `aad` (Microsoft)
- Restricted to `parisjc.edu` tenant only via `allowedPrincipals` config
- All routes require authentication — unauthenticated requests redirected to login
- User identity available server-side via `x-ms-client-principal` header
- No user data stored; auth is stateless (Azure handles token validation)
- Configuration: `staticwebapp.config.json` auth block + Azure Portal app registration

### 5. Frontend (minor changes)
- Add "Last synced: [timestamp]" indicator from `/api/sync-status`
- Add logout link (`/.auth/logout`)
- Show user's name from `/.auth/me`
- No manual refresh of Blackboard data (data is from last nightly sync)

---

## Data Flow

**Nightly (midnight CDT):**
```
Timer Trigger → Blackboard API (all calls happen here, ~500 calls/night)
             → writes blobs to Azure Storage
             → writes meta.json with timestamp
```

**Dashboard load (any time):**
```
User → SWA → Azure AD login (if not authenticated)
User → GET /api/instructors → reads instructors.json from blob → returns in <1s
User → GET /api/instructor/:id → reads instructor/{id}.json from blob → returns in <1s
```

---

## FERPA Compliance

| Requirement | Implementation |
|---|---|
| Access control | Azure AD SSO, parisjc.edu tenant only |
| Encryption in transit | HTTPS enforced by SWA (HSTS enabled) |
| Encryption at rest | Azure Blob Storage AES-256 (default) |
| No public data exposure | Blob container is private; no SAS URLs |
| Credential security | Managed Identity — no connection strings in code or env vars |
| Minimum retention | Data overwritten nightly; no historical copies |
| Audit trail | Azure Storage access logs + SWA auth logs available in Azure Monitor |

---

## Blackboard API Call Budget

| Scenario | Calls |
|---|---|
| Current (every dashboard load) | ~50 calls per load |
| After this change (nightly sync) | ~500 calls/night total |
| Daily budget | 75,000 |
| **Usage after change** | **~0.7% of daily budget** |

---

## Error Handling

- If nightly sync fails mid-run: existing blobs untouched, `meta.json` updated with error
- Dashboard shows "Last synced: X hours ago" with error indicator if sync failed
- Manual re-trigger: add a protected `/api/trigger-sync` endpoint (admin-only, callable from Azure Portal or GitHub Actions)

---

## New Infrastructure

| Resource | Type | Cost |
|---|---|---|
| `pjc-faculty-sync` | Azure Functions Consumption Plan | $0/month |
| Storage Account (or reuse existing) | Azure Blob Storage | ~$0.05/month |

---

## Environment Variables

### pjc-faculty-dashboard (existing SWA)
| Variable | Value |
|---|---|
| `BB_BASE_URL` | `https://parisjc.blackboard.com` |
| `BB_CLIENT_KEY` | (Blackboard app key) |
| `BB_CLIENT_SECRET` | (Blackboard app secret) |
| `BB_START_YEAR` | `2026` |
| `STORAGE_ACCOUNT_NAME` | name of the Azure Storage account |

### pjc-faculty-sync (new Functions app)
Same as above — reads from Blackboard, writes to blob.

---

## Out of Scope
- Historical data / trend tracking over time
- Per-user access restrictions (all parisjc.edu users see the same dashboard)
- Email alerts for inactive faculty (future feature)
- Real-time data (by design — nightly is sufficient for the use case)

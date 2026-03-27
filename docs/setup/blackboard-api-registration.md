# Blackboard API Registration Guide

One-time setup before deploying the Faculty Activity Dashboard.

## Step 1: Register a Developer Application

1. Go to [developer.blackboard.com](https://developer.blackboard.com) and sign in (create a free account if needed)
2. Click **My Applications → + Register**
3. Fill in:
   - **Name**: PJC Faculty Dashboard
   - **Description**: Read-only instructor activity reporting
   - **Domain**: your Azure Static Web App domain (e.g., `wonderful-ocean-12345.azurestaticapps.net`)
4. Click **Register**
5. Copy the **Application ID**, **Key**, and **Secret** — you need these in Steps 2 and 3

## Step 2: Add the Integration in Blackboard Admin

1. Log into Blackboard as a system administrator
2. Navigate to **System Admin → Integrations → REST API Integrations**
3. Click **Create Integration** and enter:
   - **Application ID**: (paste from Step 1)
   - **Learn User**: assign a dedicated system account (e.g., `api-dashboard-ro`) — read-only roles only
   - **End User Access**: No
   - **Authorized To Act As User**: No
4. Click **Submit**

> The assigned user needs read access to courses, users, gradebook, and forums. Do not assign administrator roles.

## Step 3: Configure Azure Function App Settings

In **Azure Portal → your Static Web App → Configuration → Application settings**, add:

| Setting | Value |
|---|---|
| `BB_BASE_URL` | `https://pjc.blackboard.com` (your Blackboard domain) |
| `BB_CLIENT_KEY` | Key from Step 1 |
| `BB_CLIENT_SECRET` | Secret from Step 1 |
| `BB_AT_RISK_DAYS` | `8` |
| `BB_INACTIVE_DAYS` | `15` |

## Step 4: Verify the Connection

After deploying, test the connection by opening your deployed dashboard URL and checking the browser console for errors, or use Azure Portal → Functions → terms → **Test/Run**.

Expected response from `/api/terms`:
```json
{ "terms": [{ "id": "...", "name": "Spring 2026", "startDate": "...", "endDate": "..." }] }
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Token fetch failed: 401` | Wrong BB_CLIENT_KEY or BB_CLIENT_SECRET |
| `Token fetch failed: 400` | BB_BASE_URL is incorrect |
| Terms returns empty array | No terms with `availability.available = Yes` and matching date range |
| Instructors returns empty | No courses linked to active terms, or no instructor-role memberships found |
| Time Spent shows N/A | Statistics endpoint not enabled on this Blackboard instance — expected and handled gracefully |

# Nagar Nigraani MERN Transformation Plan

## Goal
Transform the current React + Firebase project into a full MERN-based civic complaints reporting system while keeping the existing frontend usable during migration.

## Current Progress (Completed)
1. Created backend project in `server/`.
2. Added Express app, MongoDB connection, and environment configuration.
3. Implemented JWT auth foundation with citizen registration/login/me APIs.
4. Implemented complaint module with geospatial schema and heatmap API.
5. Added complaint lifecycle event logging (`ComplaintEvent`).
6. Added frontend API client utilities for progressive migration.

## Step-by-Step Execution Plan

### Step 1: Backend Foundation (Done)
- Folder structure:
  - `server/src/config`
  - `server/src/models`
  - `server/src/controllers`
  - `server/src/routes`
  - `server/src/middleware`
  - `server/src/utils`
- Health check endpoint: `GET /api/health`

### Step 2: Authentication Migration (Next)
- Replace frontend registration and login flows to call backend APIs:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- Save JWT token in localStorage.
- Create role-based route guard in frontend.
- Keep Firebase auth as fallback only until migration is stable.

### Step 3: Complaint CRUD Migration
- Replace complaint creation with backend API:
  - `POST /api/complaints`
- Replace dashboard reads:
  - `GET /api/complaints/mine` (citizen)
  - `GET /api/complaints` (official)
  - `GET /api/complaints/heatmap` (official)
- Keep Cloudinary upload path in frontend for now, then send URL to backend.

### Step 4: Workflow Engine
- Add fields and APIs for assignment and SLA:
  - department
  - ward/zone
  - dueAt
  - escalated
- Add status transition policies:
  - Open -> Assigned -> InProgress -> Resolved -> Closed
- Add supervisor/admin endpoints.

### Step 5: AI-Assisted Reporting
- Add `POST /api/ai/classify-complaint` endpoint.
- Start with heuristic or API-backed model for category + severity suggestion.
- Save prediction confidence in complaint object.

### Step 6: Notifications and Engagement
- Add reminders/escalations via worker queue.
- Add points ledger and badges:
  - report submitted
  - report verified
  - helpful comments
- Add leaderboard API.

### Step 7: Analytics and Exam Demo Layer
- KPI endpoints:
  - average resolution time
  - open vs closed trend
  - ward hotspot analysis
  - department performance
- Add admin analytics page in frontend.

## API List (Implemented So Far)
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/complaints`
- `GET /api/complaints`
- `GET /api/complaints/mine`
- `GET /api/complaints/heatmap`
- `PATCH /api/complaints/:id/status`

## Run Instructions

### Backend
1. Open terminal in `server/`
2. Run: `npm install`
3. Run: `npm run dev`
4. Verify: `GET http://localhost:5000/api/health`

### Frontend
1. Open terminal in project root
2. Run: `npm run dev`
3. Ensure `.env` has `VITE_API_BASE_URL=http://localhost:5000/api`

## Important Notes
- Existing Firebase-based frontend still works and is currently not fully switched to backend APIs.
- This hybrid stage avoids breaking features during migration.
- Next coding phase should migrate login/register and complaint create/list pages first.

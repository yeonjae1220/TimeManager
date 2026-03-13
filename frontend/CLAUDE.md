# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run serve      # Dev server on port 3000 (proxies API to localhost:8080)
npm run build      # Build to ../src/main/resources/static (Spring Boot static dir)
npm run lint       # Lint and auto-fix
```

## Architecture

This is a Vue 3 frontend for a time-tracking application. It pairs with a Spring Boot backend running on `localhost:8080`. The dev server proxies all `/api/*` requests to the backend (configured in `vue.config.js`).

### Core Concept

The app organizes time tracking around **Tags** — hierarchical labels a user assigns to tasks. Each tag has a stopwatch that tracks elapsed time (per session, daily, and cumulative). When the stopwatch is stopped, a **Record** is created on the backend.

### Routing (`src/router/index.js`)

| Path | Component | Purpose |
|---|---|---|
| `/` | `HomeView` | Landing page, navigates to tag tree |
| `/api/tag/:id` | `TagList` | Renders the member's tag tree (`:id` = memberId) |
| `/api/tag/detail/:id` | `TagDetail` | Single tag with stopwatch and metadata |
| `/records/:id` | `RecordList` | Time records log for a tag (`:id` = tagId) |

### Component Responsibilities

- **`TagList`** — fetches the member's full tag tree from `/api/tag/:memberId`, renders it via recursive `TagItem` components, and navigates to `TagDetail` on click.
- **`TagItem`** — recursively renders a single tag node and its children; emits a `navigate` event up to `TagList`.
- **`TagDetail`** — the main interaction page. Fetches tag data from `/api/tag/detail/:id`, manages a `reactive` stopwatch state, and calls backend endpoints to start/stop/reset the timer. The stopwatch uses `requestAnimationFrame` for live display updates. On data load, it hydrates `stopwatchState` from the server response.
- **`RecordList`** — lists all time records for a tag; uses **Luxon** (`DateTime.fromISO`) for datetime formatting.

### Modals (`src/Modals/`)

- **`EditTagModal`** — create child tags, change a tag's parent, or soft-delete a tag (by re-parenting it under a special `DISCARDED` tag).
- **`EditRecordModal`** — edit start/end times of an existing record.
- **`AddRecordModal`** — manually create a record for a tag with explicit start/end times.

All modals receive an `isOpen` boolean prop and emit a `"close"` event.

### Key Libraries

- **axios** — all API calls; no centralized HTTP client, called directly in components
- **Luxon** — datetime parsing and formatting in `RecordList`, `EditRecordModal`, `AddRecordModal`
- **lucide-vue-next** — `<Menu>` icon used as a trigger for modals
- **vue-router 4** — history mode routing; `useRoute` / `useRouter` composables used throughout

### Backend API Endpoints (called from frontend)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tag/:memberId` | Fetch tag tree for member |
| GET | `/api/tag/detail/:tagId` | Fetch single tag with stopwatch state |
| POST | `/api/tag/:tagId/start` | Start stopwatch (body: ISO timestamp string) |
| POST | `/api/record/:tagId/stop` | Stop stopwatch and create record |
| POST | `/api/tag/:tagId/reset` | Reset elapsed time |
| POST | `/api/tag/:tagId/create` | Create child tag |
| PUT | `/api/tag/:tagId/updateParent` | Change parent tag |
| GET | `/api/record/log/:tagId` | Fetch record list for a tag |
| POST | `/api/record/create/:tagId` | Manually create a record |
| PUT | `/api/record/updateTime/:recordId` | Update record start/end times |
| DELETE | `/api/record/delete/:recordId` | Delete a record |

### Tag Data Shape (from backend)

```js
{
  id, name, memberId, parentId, childrenList,  // hierarchy
  state,             // boolean — stopwatch currently running?
  latestStartTime,   // epoch ms
  latestEndTime,     // epoch ms
  elapsedTime,       // seconds — current session
  dailyTotalTime,    // seconds
  dailyGoalTime,     // seconds
  tagTotalTime,      // seconds — lifetime for this tag
  totalTime,         // seconds — grand total across all tags
  type               // e.g. "DISCARDED" for the trash tag
}
```

### Notes

- `StopwatchTimer.vue` is entirely commented out — its logic was merged into `TagDetail.vue`.
- `TagDetail` has a nested `onMounted` inside another `onMounted` (bug-prone pattern); data loading relies on `watch({ immediate: true })` on `route.params.id`.
- The build output goes to `../src/main/resources/static`, meaning this repo sits alongside or inside a Spring Boot project.

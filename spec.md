# Calendaily: Product & Technical Spec

_Last updated: 2026-11-21_

This document describes what Calendaily is, how it is meant to behave, and how it is built. It covers the intended behaviour. Where the code does not match it yet, a status marker points to the task in [tasks.md](tasks.md) that will fix it.

**Status markers**

| Marker | Meaning |
|---|---|
| ✅ | Implemented and behaving as specified |
| ⚠️ | Implemented, but with a known defect (see the linked task) |
| ⬜ | Not implemented yet (planned) |

---

## 1. Overview

Calendaily is a personal daily planner. A signed-in user sees a month calendar, opens any day to plan it with a prioritised, reorderable task list and a free-text note, and is offered the chance to carry unfinished work from earlier days over to today.

**Target user:** one person planning their own days. There is no sharing or collaboration in the current scope.

**Goals**
- Planning a day should take seconds: open the day, add tasks, set priority, reorder.
- Unfinished work should never silently disappear. The app brings it forward.
- A user's data is private to them.

**Non-goals (current scope)**
- Team or shared calendars.
- Time-of-day scheduling (meetings, time blocks). Tasks belong to a date, not a time.
- Sync with external calendars.

Future candidates are listed in [tasks.md → Feature backlog](tasks.md#phase-5--feature-backlog-to-discuss).

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Backend | Laravel 13, PHP 8.3+ |
| Auth | Laravel Fortify (registration, password reset, email verification, 2FA) |
| Frontend | Inertia v2 + React 19 + TypeScript |
| UI | Tailwind CSS v4, shadcn/Radix components, lucide icons, framer-motion |
| Dates | date-fns (frontend), Carbon (backend) |
| Drag and drop | @dnd-kit |
| Database | SQLite by default (any Laravel-supported DB should work) |
| Local serving | Laravel Herd |
| CI | GitHub Actions: tests on PHP 8.3/8.4/8.5, plus Pint, Prettier and ESLint, on pushes and PRs to `develop`/`master` |

Workflow: work happens on `develop`. PRs merge into `master`.

---

## 3. Core concepts and rules

### 3.1 Calendar day
- A **calendar day** is one user's record for one date. It holds the day's note and owns its tasks.
- There is at most one calendar day per `(user, date)`.
- Calendar days are **created lazily**. A row exists only once the user adds a task or a note to that date. A date with no row is treated as an empty day.

### 3.2 Task
- A task belongs to exactly one calendar day, and through it to one user.
- Fields: description (required, 1–255 chars), finished flag, priority, and order within the day.
- **Priority** is one of four levels:

  | Value | Label | Colour |
  |---|---|---|
  | 0 | Low | green |
  | 1 | Medium | yellow |
  | 2 | High | orange |
  | 3 | Urgent | red |

  Any other value is rejected. A new task defaults to **Medium** ([decision D3](#9-decisions-and-open-questions)), on the server and in the add dialog. The levels are defined once in `App\Enums\Priority`, and `resources/js/constants/priority.ts` mirrors them (`PriorityTest` checks the two match).
- **Order:** tasks in a day are shown in ascending `order`. A new task goes to the bottom (`max(order) + 1`). Reordering rewrites the day's orders as `1..n`.

### 3.3 "Today" and time zones
- "Today" is the current date **in the user's time zone**. The backend and frontend must agree on it. Until it is stored on the user ([FEAT-01](tasks.md)), the browser sends its time zone with every request.
- Until a per-user setting exists, a single app-level time zone is used consistently on both sides. ⬜ [FEAT-01](tasks.md)

### 3.4 Week layout
- The month grid shows complete weeks: from the start of the week containing the 1st to the end of the week containing the last day.
- A month needs 4, 5 or 6 rows. The grid must fit all of them.
- The week starts on **Monday** ([decision D2](#9-decisions-and-open-questions)). The weekday headers run Mon → Sun, and the backend's date range uses the same week start as the frontend grid. Both read it from `config/calendar.php`, which reaches the frontend as the `weekStartsOn` prop. A user-selectable week start is planned, defaulting to Monday. ⬜ [FEAT-01](tasks.md)

### 3.5 Carry-over
- An **unfinished past task** is a task with `is_finished = false` on a date strictly **before today**. Tasks on today or future dates are never offered for carry-over.
- When the user opens the calendar and unfinished past tasks exist, the app offers to move them to today.
- The candidate list is computed from **all** past days, not only the month on screen.
- The user can accept, or dismiss with "Not now". Dismissing suppresses the prompt for the rest of that day. ⬜ [UX-08](tasks.md)
- Accepting moves the selected tasks to today's calendar day, creating it if needed. They are appended after today's existing tasks.
- Carry-over **moves** tasks: the task's day changes to today, and no record of its original date is kept ([decision D1](#9-decisions-and-open-questions)).

---

## 4. Functional requirements

### 4.1 Account and authentication

| ID | Requirement | Status |
|---|---|---|
| FR-A1 | Users can register, log in, log out, reset their password and verify their email. | ✅ |
| FR-A2 | Users can enable two-factor authentication (TOTP with recovery codes). | ✅ |
| FR-A3 | Users can update their profile and password, delete their account, and choose light, dark or system appearance. | ✅ |
| FR-A4 | Guests visiting `/` see the welcome page. Signed-in users visiting `/` see the calendar. | ✅ |
| FR-A5 | Deleting an account deletes all of its calendar days and tasks (cascade). | ✅ |

### 4.2 Month view

| ID | Requirement | Status |
|---|---|---|
| FR-M1 | Shows the current month on load, with previous/next controls, month and year pickers, and a "Today" button that opens today's day view. | ✅ |
| FR-M2 | Each cell shows the date number, highlights today, and dims days outside the month. | ✅ |
| FR-M3 | Each cell with tasks shows a done/total count, a progress bar, and up to 3 task previews. If there are more, it shows "+N more". | ⚠️ "+N more" is missing ([UX-10](tasks.md)) |
| FR-M4 | A cell indicates that the day has a note. | ⬜ [UX-10](tasks.md) |
| FR-M5 | Clicking a cell opens that day's view. | ✅ |
| FR-M6 | Data for every visible cell, including leading and trailing days from adjacent months, is loaded. | ✅ |
| FR-M7 | The current month and selected day are reflected in the URL, so refresh, back/forward and deep links work. | ⬜ [UX-07](tasks.md) |

### 4.3 Day view

| ID | Requirement | Status |
|---|---|---|
| FR-D1 | Shows the weekday and full date, and a back button to the month view. | ✅ |
| FR-D2 | Shows the task list, a completion percentage and a progress bar. | ✅ |
| FR-D3 | An empty day shows an empty state with an "Add Task" action. | ✅ |
| FR-D4 | Shows an editable note for the day (max 500 chars). Changes are saved automatically and are never lost or overwritten by stale state. | ⚠️ Saved on blur, not automatically yet ([UX-09](tasks.md)) |

### 4.4 Tasks

| ID | Requirement | Status |
|---|---|---|
| FR-T1 | Add a task with a description and priority. Enter submits, Escape cancels, and Submit is disabled while the description is empty. | ⚠️ [UX-03](tasks.md) |
| FR-T2 | Edit a task's description and priority. | ✅ |
| FR-T3 | Toggle a task finished or unfinished. | ✅ |
| FR-T4 | Delete a task, with a confirmation or an undo. | ⚠️ Deletes without confirmation ([UX-02](tasks.md)) |
| FR-T5 | Reorder tasks by drag and drop, and by keyboard. The new order shows immediately and is persisted. | ⚠️ Not optimistic ([UX-04](tasks.md)) |
| FR-T6 | All task actions are usable on touch devices. They are not hover-only. | ⚠️ [UX-05](tasks.md) |
| FR-T7 | Failed actions show a visible error and leave the UI consistent with the server. | ⚠️ Errors only go to the console ([UX-01](tasks.md)) |

### 4.5 Carry-over

| ID | Requirement | Status |
|---|---|---|
| FR-C1 | Prompt to carry over unfinished past tasks, following the rules in [3.5](#35-carry-over). | ✅ |
| FR-C2 | The user can choose which tasks to carry over. | ⬜ [UX-08](tasks.md) |
| FR-C3 | Dismissing the prompt suppresses it until the next day. | ⬜ [UX-08](tasks.md) |

---

## 5. Data model

### 5.1 Current schema

**`users`**: Laravel starter-kit columns plus Fortify 2FA columns (`two_factor_secret`, `two_factor_recovery_codes`, `two_factor_confirmed_at`).

**`calendar_days`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `user_id` | FK → users | cascade on delete, indexed |
| `date` | date | indexed |
| `note` | text, nullable | Validated to 500 chars |
| timestamps | | |
| | | unique `(user_id, date)` |

**`tasks`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `calendar_day_id` | FK → calendar_days | cascade on delete |
| `description` | string(255) | |
| `is_finished` | boolean, default false | |
| `order` | integer, nullable | 1-based within a day |
| `priority` | tinyint, default 1 | 0–3, see [3.2](#32-task) |
| timestamps | | |

Ownership of a task is derived through its calendar day: `task.calendar_day.user_id`.

### 5.2 Relationships
- `User` has many `CalendarDay`, and has many `Task` through them.
- `CalendarDay` belongs to `User` and has many `Task`, always ordered by `order` ascending.
- `Task` belongs to `CalendarDay`. `is_finished` is cast to a boolean, and `priority`, `order` and `calendar_day_id` to integers.

Every endpoint returns tasks as `TaskResource` and days as `CalendarDayResource`, so ids are numbers and `is_finished` is a boolean.

---

## 6. HTTP API

All endpoints require an authenticated, verified session (`auth` + `verified` middleware). They return JSON and are called from the frontend with axios.

### 6.1 Rules that apply to every endpoint
- **Authorization:** a user can only read or modify their own calendar days and tasks. Any request touching another user's resource gets **403** (or **404**), and nothing changes. Bulk endpoints (reorder, carry-over) must reject the whole request if any id is not owned by the user. Enforced by `TaskPolicy`, `CalendarDayPolicy` and ownership checks in `TaskService` ([SEC-01](tasks.md)).
- **Validation:** invalid input returns **422** with Laravel's standard error body. It never returns a 500.
- **Dates** are `YYYY-MM-DD` strings. Months are `YYYY-MM`.

### 6.2 Endpoints

#### `GET /api/calendar?month=YYYY-MM`
Returns every day with data in the visible grid for that month. `month` defaults to the current month and must match `YYYY-MM`.

```json
{
  "calendarData": {
    "2026-11-21": {
      "calendar_day": { "id": 12, "note": "..." },
      "tasks": [
        { "id": 40, "description": "...", "is_finished": false,
          "calendar_day_id": 12, "priority": 1, "order": 1 }
      ]
    }
  }
}
```
The frontend type is `CalendarData` in [resources/js/types/calendar.ts](resources/js/types/calendar.ts). Change both together.

#### `POST /tasks`
Body: `{ description: string (1–255), date: YYYY-MM-DD, priority?: 0–3 }`. `priority` defaults to 1 (Medium). Finds or creates the calendar day for `date`, then appends the task. **201** with the task.

#### `PUT /tasks/{task}`
Body (all optional): `{ description, is_finished, priority }`. **200** with the updated task. `date` and `order` are not accepted here: moving a task uses its own endpoint ([FEAT-02](tasks.md)) and ordering uses reorder.

#### `DELETE /tasks/{task}`
**200** `{ "message": "Task deleted successfully" }`.

#### `POST /calendar-days`
Body: `{ date: YYYY-MM-DD, note: string|null (≤500) }`. One per user per date. **201** with the day.

#### `PUT /calendar-days/{calendarDay}`
Body: `{ note: string|null (≤500) }`. **200** with the day.

#### `PUT /api/tasks/reorder`
Body: `{ tasks: [{ id }, ...] }` (at least one, no duplicates), all from the same calendar day and in the new order. Rewrites `order` as `1..n` in one query. **200**. **403** if any task isn't the user's, **422** for an invalid body, an unknown id, or tasks from more than one day (`ReorderTasksRequest`).

#### `GET /api/tasks/unfinished`
Returns `{ unfinishedTasks: { [date]: Task[] } }`: the user's unfinished tasks on days strictly before today (in the user's time zone), from any month. Dates are oldest first, and tasks within a date follow `order`. An empty result is `{}`.

#### `POST /api/tasks/carry-over`
Body: `{ task_ids: number[] }` (at least one). The server resolves "today" itself and checks that every task is owned by the user (**403** otherwise), unfinished and dated before today (**422** otherwise). The tasks are appended after today's existing tasks, oldest day first, and today's day is created if needed. **200** with the moved tasks.

---

## 7. Frontend architecture

- **Single page.** `HomeController@index` renders the `home` Inertia page with a single `weekStartsOn` prop. After that, all data goes through the JSON API above.
- [resources/js/pages/home.tsx](resources/js/pages/home.tsx) owns `calendar: CalendarData`, fetches again when the month changes, fetches the carry-over candidates from `GET /api/tasks/unfinished` whenever the month view is shown, and switches between the month grid and the day view.
- [resources/js/components/day-panel-content.tsx](resources/js/components/day-panel-content.tsx) renders a day: tasks (dnd-kit sortable), add/edit dialogs and the note.
- [resources/js/hooks/useTaskActions.ts](resources/js/hooks/useTaskActions.ts) makes the per-day API calls and patches local state through `updateData(prev => next)`. It does not fetch again.
- Priority labels and styles live in [resources/js/constants/priority.ts](resources/js/constants/priority.ts).
- Wayfinder generates typed route helpers (`resources/js/routes`, `resources/js/actions`, gitignored). Auth and settings pages use them. The calendar and task code should too ([DEBT-06](tasks.md)).

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Every resource is scoped to its owner, enforced by policies and tested ([SEC-01](tasks.md)). Standard Laravel CSRF and session protections apply. Production passwords: min 12 chars, mixed case, numbers, symbols, not compromised (already configured). |
| Validation | All input is validated in Form Requests, and validation limits match the column sizes. |
| Time | Server, client and stored dates agree on "today" and on week boundaries. No hardcoded time zones. Until FEAT-01 stores a zone per user, the browser sends its zone in the `X-Timezone` header and the server falls back to the app time zone. |
| Responsiveness | Usable from 360px phone width up to desktop. No hover-only actions. |
| Accessibility | Icon-only buttons have accessible names. The calendar and task list work with the keyboard. Colour isn't the only way priority is shown (a text label is also shown). |
| Feedback | Every mutation shows success or failure to the user. Optimistic updates roll back on failure. |
| Quality gates | CI must be green before merging: PHPUnit, `tsc --noEmit`, ESLint, Prettier and Pint. Domain endpoints have feature tests, including authorization tests. |
| Migrations | Every migration has a working `down()`. |

---

## 9. Decisions and open questions

### Decisions (2026-11-21)

| # | Decision | Consequence |
|---|---|---|
| D1 | Carry-over **moves** tasks to today. No history of the original date is kept. | Current behaviour stays. FEAT-08 (carry-over history) is not planned. |
| D2 | Weeks start on **Monday**. | The grid and weekday headers switch to Mon → Sun (BUG-02). FEAT-01 defaults to Monday. |
| D3 | New tasks default to **Medium** priority. | The add dialog changes from Low to Medium (DEBT-05). |
| D4 | First features after the fixes: **move/snooze a task** (FEAT-02), **recurring tasks** (FEAT-09), **week view** (FEAT-10). | These are next once phases 0–4 are done. |

### Open questions

| # | Question | Options / notes |
|---|---|---|
| Q3 | Where should the time zone come from? | Browser-detected and saved on the user (proposed), or chosen in settings. BUG-04 uses the browser's zone per request for now; storing it is FEAT-01. |
| Q5 | Should the data layer stay as axios + local state, or move to TanStack Query / Inertia partial reloads? | See DEBT-08. |

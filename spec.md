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
| UI | Tailwind CSS v4, shadcn/Radix components, lucide icons, framer-motion, sonner (toasts) |
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
- The user picks which of the tasks to move (all are ticked to start), or dismisses with "Not now". Dismissing, or carrying tasks over, suppresses the prompt for the rest of that day in that browser.
- Accepting moves the selected tasks to today's calendar day, creating it if needed. They are appended after today's existing tasks.
- Carry-over **moves** tasks: the task's day changes to today, and no record of its original date is kept ([decision D1](#9-decisions-and-open-questions)).
- Occurrences of a recurring task are never offered: a missed one comes back by itself ([decision D7](#9-decisions-and-open-questions)).

### 3.6 Recurring tasks
- A task can repeat: every day, every weekday (Mon–Fri), every week on chosen weekdays, every month on the same date, or every N days, weeks or months. A rule can have an end date.
- The rule is stored once (`recurring_tasks`). Its occurrences are ordinary tasks linked to it, so each one can be finished, edited, reordered, moved or deleted on its own ([decision D6](#9-decisions-and-open-questions)).
- A rule starts on the day of the task it was made from, so that day must be one of its occurrences. Weeks are counted from the week containing that day. A monthly rule skips months that don't have its date (the 31st).
- Occurrences are created when the calendar is read, from today up to the end of the range read, at most a year ahead. Past days are never backfilled. Each rule remembers how far it has been generated, so a deleted or moved occurrence isn't created again.
- Editing a repeating task applies to that task only, or to it and the following occurrences. Changing the rule restarts it from that task and replaces the unfinished occurrences after it. Choosing "Doesn't repeat" stops the series after that task: later unfinished occurrences are deleted, and the rest become one-off tasks. Occurrences on days before today are history and never change.

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
| FR-M3 | Each cell with tasks shows a done/total count ("All done" once every task is finished), a progress bar, and up to 3 task previews. If there are more, it shows "+N more". On phones it shows a dot per task instead. | ✅ |
| FR-M4 | A cell indicates that the day has a note. | ✅ |
| FR-M5 | Clicking a cell opens that day's view. Cells are buttons: Tab reaches one, and the arrow keys, Home and End move between them. | ✅ |
| FR-M6 | Data for every visible cell, including leading and trailing days from adjacent months, is loaded. | ✅ |
| FR-M7 | The current month and selected day are reflected in the URL (`/?day=yyyy-MM-dd&month=yyyy-MM`), so refresh, back/forward and deep links work. The day view's back button goes back in history when the month view is behind it. | ✅ |

### 4.2a Week and agenda views

| ID | Requirement | Status |
|---|---|---|
| FR-W1 | The calendar header switches between Month, Week and Agenda. The view is in the URL (`/?view=week&week=yyyy-MM-dd`, `/?month=yyyy-MM&view=agenda`), and the month view, the default, keeps its URLs. | ✅ |
| FR-W2 | The week view shows the seven days of one week, from the configured week start, with every task and a done/total count, and pages a week at a time. On smaller screens the days are stacked. | ✅ |
| FR-W3 | In the week view, tasks can be checked off, and dragged by their handle (mouse, touch, or the keyboard a day at a time) onto another day to move them there ([FR-T8](#44-tasks)). | ✅ |
| FR-W4 | The agenda view lists the month's days that have tasks or a note, plus today, with their tasks (which can be checked off) and the start of the note. An empty month says so. | ✅ |
| FR-W5 | A day opened from the week or agenda view goes back to that view. | ✅ |

### 4.3 Day view

| ID | Requirement | Status |
|---|---|---|
| FR-D1 | Shows the weekday and full date, and a back button to the month view. | ✅ |
| FR-D2 | Shows the task list, a completion percentage and a progress bar. | ✅ |
| FR-D3 | A day without tasks shows an empty state, worded for a past day, today or a future day, with an "Add Task" action. The note stays available. | ✅ |
| FR-D4 | Shows an editable note for the day (max 500 chars). Changes are saved automatically (shortly after typing stops, on blur, and on leaving the day), with a Saving…/Saved indicator, and are never lost or overwritten by stale state. | ✅ |
| FR-D5 | A view menu sorts the task list by "My order" (the default, the drag order), priority (Urgent first) or status (unfinished first), and can hide completed tasks, counted under the list with a "Show" link. The choice applies to every day and is remembered in the browser. Tasks can only be dragged in "My order", and hidden tasks keep their places when the shown ones are reordered. | ✅ |

### 4.4 Tasks

| ID | Requirement | Status |
|---|---|---|
| FR-T1 | Add a task with a description and priority. Enter submits, Escape cancels, and Submit is disabled while the description is empty or a save is in flight. | ✅ |
| FR-T2 | Edit a task's description and priority. | ✅ |
| FR-T3 | Toggle a task finished or unfinished. | ✅ |
| FR-T4 | Delete a task, with an undo: the task disappears at once, and the delete is sent after 5 seconds unless "Undo" is pressed. | ✅ |
| FR-T5 | Reorder tasks by drag and drop, and by keyboard. The new order shows immediately and is persisted, and goes back if the server rejects it. | ✅ |
| FR-T6 | All task actions are usable on touch devices. They are not hover-only. | ✅ |
| FR-T7 | Failed actions show a visible error (a toast, or the message next to the field for a 422) and leave the UI consistent with the server. | ✅ |
| FR-T8 | Move a task to another date from its Move menu: Today, Tomorrow, or a picked date. It leaves its day at once and goes to the end of the new day's list. | ✅ |
| FR-T9 | A task can repeat ([3.6](#36-recurring-tasks)). Repeating tasks show their rule ("Every weekday"), and editing one asks whether the change applies to the following occurrences too. | ✅ |

### 4.5 Carry-over

| ID | Requirement | Status |
|---|---|---|
| FR-C1 | Prompt to carry over unfinished past tasks, following the rules in [3.5](#35-carry-over). | ✅ |
| FR-C2 | The user can choose which tasks to carry over. | ✅ |
| FR-C3 | Dismissing the prompt suppresses it until the next day. | ✅ |

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
| `recurring_task_id` | FK → recurring_tasks, nullable | null on delete. Set on a recurring task's occurrences |
| timestamps | | |

**`recurring_tasks`** (see [3.6](#36-recurring-tasks))

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `user_id` | FK → users | cascade on delete |
| `description`, `priority` | | Copied to new occurrences |
| `frequency` | string | `daily`, `weekly` or `monthly` (`App\Enums\RepeatFrequency`) |
| `interval` | smallint, default 1 | Every N days, weeks or months (1–99) |
| `weekdays` | json, nullable | Weekly rules: 0 = Sunday … 6 = Saturday |
| `starts_on`, `ends_on` | date | `ends_on` is nullable |
| `generated_through` | date, nullable | The last date occurrences were created up to |
| timestamps | | |

Ownership of a task is derived through its calendar day: `task.calendar_day.user_id`.

### 5.2 Relationships
- `User` has many `CalendarDay`, and has many `Task` through them.
- `CalendarDay` belongs to `User` and has many `Task`, always ordered by `order` ascending.
- `User` has many `RecurringTask`, and a `RecurringTask` has many `Task` occurrences. A `Task` may belong to a `RecurringTask`.
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
Returns every day with data in the visible grid for that month. `month` defaults to the current month and must match `YYYY-MM`. It first creates the user's missing recurring-task occurrences up to the end of the grid ([3.6](#36-recurring-tasks)).

```json
{
  "calendarData": {
    "2026-11-21": {
      "calendar_day": { "id": 12, "note": "..." },
      "tasks": [
        { "id": 40, "description": "...", "is_finished": false,
          "calendar_day_id": 12, "priority": 1, "order": 1,
          "recurrence": null }
      ]
    }
  }
}
```
`recurrence` is null for a one-off task, and otherwise `{ frequency, interval, weekdays, ends_on }`. The frontend type is `CalendarData` in [resources/js/types/calendar.ts](resources/js/types/calendar.ts). Change both together.

#### `POST /tasks`
Body: `{ description: string (1–255), date: YYYY-MM-DD, priority?: 0–3, recurrence?: { frequency, interval?: 1–99, weekdays?: (0–6)[], ends_on?: YYYY-MM-DD } | null }`. `priority` defaults to 1 (Medium). Finds or creates the calendar day for `date`, then appends the task. With a `recurrence`, the task is the first occurrence of a new rule starting on `date` (weekly rules need `weekdays`, which must include `date`'s weekday, and `ends_on` can't be before `date`; **422** otherwise). **201** with the task.

#### `PUT /tasks/{task}`
Body (all optional): `{ description, is_finished, priority }`. **200** with the updated task. `date` and `order` are not accepted here: moving a task uses its own endpoint (below) and ordering uses reorder.

#### `DELETE /tasks/{task}`
**200** `{ "message": "Task deleted successfully" }`.

#### `POST /calendar-days`
Body: `{ date: YYYY-MM-DD, note: string|null (≤500) }`. One per user per date. **201** with the day.

#### `PUT /calendar-days/{calendarDay}`
Body: `{ note: string|null (≤500) }`. **200** with the day.

#### `PUT /api/tasks/{task}/move`
Body: `{ date: YYYY-MM-DD }`. Finds or creates the user's day for `date` and appends the task after that day's tasks. Moving a task to the day it is already on changes nothing. **200** with the task. **403** for another user's task, **422** for an invalid date (`MoveTaskRequest`).

#### `PUT /api/tasks/{task}/series`
Body: `{ description, priority, recurrence: {...} | null }`, all required (`recurrence` may be null). Saves the task with its repeat rule ([3.6](#36-recurring-tasks)): for a task in a series it updates the rule and the unfinished occurrences after the task, replaces them if the schedule changed, or, with a null `recurrence`, stops the series after the task. For a one-off task a `recurrence` makes it repeat. **200** with the task. **403** for another user's task, **422** for an invalid body or a rule that doesn't include the task's day (`UpdateTaskSeriesRequest`).

#### `PUT /api/tasks/reorder`
Body: `{ tasks: [{ id }, ...] }` (at least one, no duplicates), all from the same calendar day and in the new order. Rewrites `order` as `1..n` in one query. **200**. **403** if any task isn't the user's, **422** for an invalid body, an unknown id, or tasks from more than one day (`ReorderTasksRequest`).

#### `GET /api/tasks/unfinished`
Returns `{ unfinishedTasks: { [date]: Task[] } }`: the user's unfinished tasks on days strictly before today (in the user's time zone), from any month, leaving out recurring occurrences. Dates are oldest first, and tasks within a date follow `order`. An empty result is `{}`.

#### `POST /api/tasks/carry-over`
Body: `{ task_ids: number[] }` (at least one). The server resolves "today" itself and checks that every task is owned by the user (**403** otherwise), unfinished and dated before today (**422** otherwise). The tasks are appended after today's existing tasks, oldest day first, and today's day is created if needed. **200** with the moved tasks.

---

## 7. Frontend architecture

- **Single page.** `HomeController@index` renders the `home` Inertia page with the props `weekStartsOn`, `month`, `day`, `view` and `week` (from the query string: null when absent or invalid, and `view` falls back to `month`). After that, all data goes through the JSON API above.
- [resources/js/pages/home.tsx](resources/js/pages/home.tsx) reads the view, the visible month or week and the selected day from the URL props, changes them with Inertia's client-side `router.push`/`replace`, and shows `CalendarHeader` over the month grid (`MonthGrid` of `DayCell`s), `WeekView` or `AgendaView`, or the `DayView`. Every view reads the month's cached query: a week is always inside the grid of the month it starts in.
- **Data layer: TanStack Query** ([decision D5](#9-decisions-and-open-questions)). [resources/js/lib/calendar-api.ts](resources/js/lib/calendar-api.ts) holds the query keys and one axios function per endpoint. Each month's `CalendarData` is its own query (`['calendar', 'yyyy-MM']`), cached and refetched in the background when shown again or when the window regains focus.
- [resources/js/hooks/use-calendar.ts](resources/js/hooks/use-calendar.ts) reads the visible month's query, fetches the carry-over candidates from `GET /api/tasks/unfinished` whenever the month view is shown, and carries tasks over (then invalidates every cached month).
- [resources/js/components/day-panel-content.tsx](resources/js/components/day-panel-content.tsx) renders a day: tasks (dnd-kit sortable), add/edit dialogs and the note.
- [resources/js/hooks/useTaskActions.ts](resources/js/hooks/useTaskActions.ts) runs the per-day mutations (`useMutation`) and, once the server confirms, patches the visible month's cached query through `updateData(prev => next)`. It does not fetch again. Reordering is optimistic, and deletes wait out an undo toast first. The note autosaves through [use-note-autosave.ts](resources/js/hooks/use-note-autosave.ts).
- **Errors:** [resources/js/lib/query-client.ts](resources/js/lib/query-client.ts) shows a toast for any failed query or mutation (titled by its `meta.errorMessage`) and refetches the calendar after a failed mutation. The task dialog shows 422 messages next to its fields.
- Priority labels and styles live in [resources/js/constants/priority.ts](resources/js/constants/priority.ts).
- Wayfinder generates typed route helpers (`resources/js/routes`, `resources/js/actions`, gitignored). Every page uses them, including the calendar and task code's axios calls.

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
| D5 | The data layer is **TanStack Query** (answers Q5). | Each month is a cached query refetched on focus, and mutations go through `useMutation`, which makes rollback (UX-01) and optimistic reordering (UX-04) straightforward (DEBT-08). |
| D4 | First features after the fixes: **move/snooze a task** (FEAT-02), **recurring tasks** (FEAT-09), **week view** (FEAT-10). | These are next once phases 0–4 are done. |
| D6 | Recurring tasks are stored as a rule plus **real task rows**, created when the calendar is read, from today up to the end of the range read (at most a year ahead). Past days are not backfilled. | Every task action works on occurrences unchanged. A rule keeps a watermark, so a deleted or moved occurrence isn't created again (FEAT-09). |
| D7 | Unfinished occurrences of a recurring task are **not** offered for carry-over. | A missed repeat comes back by itself, so a week away doesn't fill the prompt with copies of it (FEAT-09). |
| D8 | A user's **stored time zone** decides "today", on the server and in the browser. It is detected once from the browser and can be changed under Settings. | The browser's own zone is only used until one is stored, so a device set to another zone (travelling, a work laptop) doesn't move "today" (FEAT-01). |

### Open questions

| # | Question | Options / notes |
|---|---|---|
| Q3 | Where should the time zone come from? | Browser-detected and saved on the user (proposed), or chosen in settings. BUG-04 uses the browser's zone per request for now; storing it is FEAT-01. |

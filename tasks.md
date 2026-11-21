# Calendaily: Tasks

_Last updated: 2026-11-21_ · Behaviour is defined in [spec.md](spec.md).

This is every known bug, cleanup and feature idea from the 2026-11-21 project review, grouped into phases in the order we plan to tackle them. Tick a box when its task is merged into `develop`.

**Size:** `S` takes under half a day · `M` takes about 1–2 days · `L` takes several days or needs design work first.
**IDs are stable.** Reference them in commits and PRs (e.g. `fix(SEC-01): ...`) and never renumber them.

## Summary

| Phase | Focus | Tasks |
|---|---|---|
| 0 | Get CI green | CI-01 – CI-04 |
| 1 | Security | SEC-01 – SEC-02 |
| 2 | Data-correctness bugs | BUG-01 – BUG-10 |
| 3 | Tech debt | DEBT-01 – DEBT-09 |
| 4 | UX polish | UX-01 – UX-12 |
| 5 | Feature backlog (to discuss) | FEAT-01 – FEAT-19 |

Current CI state (checked 2026-11-21, after Phases 0–3): `composer run ci:check` passes, with **118 PHPUnit tests**, a clean `tsc --noEmit`, and no ESLint, Prettier or Pint errors.

---

## Phase 0: Get CI green

- [x] **CI-01: Fix failing starter-kit tests** · `S`
  - Problem: `DashboardTest`, `AuthenticationTest`, `EmailVerificationTest`, `RegistrationTest` and `VerificationNotificationTest` use `route('dashboard')`, which doesn't exist (`RouteNotFoundException`). `ExampleTest` expects guests to get 200 on `route('home')` but gets a 302.
  - Fix: point the tests at `route('home')`, and rename `DashboardTest` to `HomeTest`. Fix `ExampleTest` once CI-02 decides how `/` behaves for guests. Do this together with BUG-01, because the post-login redirect target changes too.
  - Files: [tests/Feature/](tests/Feature/)
  - Done when: `php artisan test --compact` passes.

- [x] **CI-02: Resolve the duplicate `GET /` route** · `S`
  - Problem: [routes/web.php](routes/web.php) registers `/` twice: `welcome` for everyone, then `home` inside the auth group. The second one wins, so guests are redirected to login and the welcome page can't be reached.
  - Fix: one route that renders `welcome` for guests and `home` for signed-in users, or move the app to a separate path. Also fix the "HOme" link text in [welcome.tsx](resources/js/pages/welcome.tsx).
  - Done when: guests see the welcome page at `/`, signed-in users see the calendar, and both cases are covered by tests.

- [x] **CI-03: Fix TypeScript errors** · `S`
  - [welcome.tsx:2](resources/js/pages/welcome.tsx#L2) imports `homes` (it should be `home`).
  - [sortable-task.tsx:30](resources/js/components/sortable-task.tsx#L30): `PRIORITY_STYLES[task.priority]` can't be indexed by `number`. Type priority as `0 | 1 | 2 | 3` (see DEBT-05) or give the map a `Record<number, …>` type.
  - Done when: `npm run types:check` is clean.

- [x] **CI-04: Fix ESLint and Prettier errors** · `S`
  - Run `npm run lint` and `npm run format`, then fix the remaining errors by hand: unused `i` and `finishedAllTasks` in [home.tsx](resources/js/pages/home.tsx), and the missing `todaysCalendarDayId` dependency in the `unfinishedTasks` `useMemo`.
  - Done when: `composer run ci:check` passes locally.

---

## Phase 1: Security

- [x] **SEC-01: Enforce ownership on every task and calendar-day endpoint** · `M` · 🔴 critical
  - Problem: every Form Request's `authorize()` only checks `Auth::check()`. Any signed-in user can:
    - update or delete **any** task via `PUT/DELETE /tasks/{id}`;
    - edit **any** day's note via `PUT /calendar-days/{id}`;
    - move **any** task into their own day (or into someone else's) via `POST /api/tasks/carry-over`, because it accepts raw task ids and a raw `calendar_day_id` ([TaskService.php:52](app/Services/TaskService.php#L52));
    - change the order of **any** task via `PUT /api/tasks/reorder`.
  - Fix: add `TaskPolicy` (ownership through `calendarDay.user_id`) and `CalendarDayPolicy`, and use them in the controllers or the Form Requests' `authorize()`. In `TaskService`, scope bulk queries to the user's tasks and reject the request if any id isn't theirs. Resolve the carry-over target day on the server, not from client input.
  - Done when: every endpoint returns 403 or 404 for another user's resource and changes nothing (covered by SEC-02).

- [x] **SEC-02: Authorization test suite** · `S`
  - For each endpoint, test that user A cannot read or modify user B's day or tasks, including bulk endpoints with a mix of owned and foreign ids.
  - Depends on DEBT-01 (factories).

---

## Phase 2: Data-correctness bugs

- [x] **BUG-01: Post-login redirect goes to a route that doesn't exist** · `S`
  - Problem: `'home' => '/home'` in [config/fortify.php:76](config/fortify.php#L76), but no `/home` route exists, so redirects after login, registration and verification can land on a 404.
  - Fix: set it to `/`, or to the route chosen in CI-02.

- [x] **BUG-02: Leading Sunday in the month grid shows no data** · `S`
  - Problem: Carbon's `startOfWeek()` gives Monday, while date-fns `startOfWeek()` gives Sunday. For July 2026 the API fetches from Mon Jun 29, but the grid starts on Sun Jun 28, so tasks on that Sunday never appear ([HomeController.php:26](app/Http/Controllers/HomeController.php#L26)).
  - Fix: weeks start on **Monday** (spec decision D2). Use `startOfWeek(Carbon::MONDAY)` / `endOfWeek(Carbon::SUNDAY)` on the backend, `{ weekStartsOn: 1 }` for every date-fns week call on the frontend, and Mon → Sun weekday headers. Keep the value in one shared constant so FEAT-01 can make it a setting later.
  - Done when: a test asserts the API range matches the grid for a month that starts mid-week.

- [x] **BUG-03: Six-week months overflow the grid** · `S`
  - Problem: the grid is fixed at `grid-rows-5` ([home.tsx:279](resources/js/pages/home.tsx#L279)). Months that span 6 weeks (e.g. August 2026) overflow.
  - Fix: set the row count from `calendarDays.length / 7`.

- [x] **BUG-04: Inconsistent "today" across the app** · `M`
  - Problem: carry-over hardcodes `Asia/Manila` ([TaskService.php:43](app/Services/TaskService.php#L43)), `config/app.php` is UTC, and the frontend uses the browser's local date. Around midnight they can disagree about which day is "today".
  - Fix: one source of the user's time zone, used on both server and client. Remove the hardcoded zone. A full user setting is FEAT-01.

- [x] **BUG-05: Carry-over offers future tasks, and only checks the visible month** · `M`
  - Problem: `unfinishedTasks` ([home.tsx:100](resources/js/pages/home.tsx#L100)) includes every unfinished task in the loaded grid that isn't on today's day. That covers **future** dates and leading/trailing days, and misses past months entirely. Accepting it moves future tasks back to today.
  - Fix: add `GET /api/tasks/unfinished` returning unfinished tasks dated strictly before today (in the user's time zone). Change carry-over to take `{ task_ids }` and validate on the server (owned, unfinished, past). Append moved tasks after today's existing order.
  - Done when: the behaviour matches [spec §3.5](spec.md#35-carry-over), with tests.

- [x] **BUG-06: Invalid input causes 500s instead of 422s** · `S`
  - `GET /api/calendar?month=garbage` throws `InvalidFormatException`. Validate it as `date_format:Y-m`.
  - A missing `priority` on `POST /tasks` hits an undefined index in `TaskService::create`. Make it required, or default it.
  - `priority` is only checked as `int`, so any value is accepted, and an out-of-range value crashes the UI (`PRIORITY_STYLES[7]` is undefined). Use `in:0,1,2,3` or an enum rule.
  - Carry-over with an empty `tasks` array leaves `$taskIds` undefined ([TaskController.php:93](app/Http/Controllers/TaskController.php#L93)).

- [x] **BUG-07: A day's note can be wiped by stale local state** · `S` · _suspected, not reproduced_
  - Problem: [day-panel-content.tsx:34](resources/js/components/day-panel-content.tsx#L34) copies the note into `useState` once on mount. Clicking "Today" while viewing another month opens the day before its data has loaded. Focusing and blurring the empty textarea then saves `''` over the real note.
  - Fix: sync local state when `dayData.calendar_day.note` changes (if the user hasn't edited it), or key the component on the loaded data. Reproduce first, then add a test.

- [x] **BUG-08: Note length limits don't match** · `S`
  - Problem: validation allows 500 chars, but `calendar_days.note` is `string` (VARCHAR 255). SQLite doesn't care, but MySQL or Postgres would truncate or reject.
  - Fix: a migration changing `note` to `text`, or set validation to 255. `text` is recommended if notes get richer (FEAT-13).

- [x] **BUG-09: Editing a task you just added fails with a 500** · `S`
  - Problem: `handleAddTask` stores `date` on the new task in local state ([useTaskActions.ts:77](resources/js/hooks/useTaskActions.ts#L77)). Editing it sends `date` back. `UpdateTaskRequest` accepts it and `Task::$fillable` includes it, but the `tasks.date` column was dropped, so the update query fails.
  - Fix: remove `date` from `Task::$fillable` and `UpdateTaskRequest`, stop adding it on the client, and have the edit request send only `description` and `priority`. Also use the `task` argument rather than `newTask` state for the description ([useTaskActions.ts:76](resources/js/hooks/useTaskActions.ts#L76)).

- [x] **BUG-10: Rolling back migrations is broken** · `S`
  - [2026_04_12_101754_add_order_and_priority_to_tasks_table.php](database/migrations/2026_04_12_101754_add_order_and_priority_to_tasks_table.php) `down()` drops a column called `sort` instead of `order`. Its `up()` also uses the `Task` model, which is fragile as the model changes. Use the query builder.
  - [2026_03_28_094028_add_day_id_to_tasks_table.php](database/migrations/2026_03_28_094028_add_day_id_to_tasks_table.php) `down()` doesn't drop `calendar_day_id`.
  - Done when: `php artisan migrate:fresh && php artisan migrate:rollback --step=4 && php artisan migrate` works on a scratch DB.

---

## Phase 3: Tech debt

- [x] **DEBT-01: Feature tests and factories for the domain** · `M`
  - Fill in `TaskFactory`, and add `CalendarDayFactory` with states (finished, priority, past/future date).
  - Feature tests for `GET /api/calendar` (range and shape), task CRUD, notes, reorder and carry-over.

- [x] **DEBT-02: Remove dead code and unused routes** · `S`
  - Empty `index/create/show/edit/destroy` methods in [TaskController.php](app/Http/Controllers/TaskController.php) and [CalendarDayController.php](app/Http/Controllers/CalendarDayController.php). Restrict the resource routes with `->only([...])` to what's used.
  - `$request['user_id'] = auth()->id();` in `CalendarDayController@store`, which has no effect.
  - The empty [use-calendar.tsx](resources/js/hooks/use-calendar.tsx), the stale `TaskActions` type in [types/calendar.ts](resources/js/types/calendar.ts), the commented-out nav in [app-sidebar.tsx](resources/js/components/app-sidebar.tsx), and unused imports.
  - Manual `MAX_TASK_DESC_LENGTH` truncation in [home.tsx](resources/js/pages/home.tsx), which duplicates CSS `truncate`.

- [x] **DEBT-03: Dedicated Form Requests and dependency injection** · `S`
  - `ReorderTasksRequest` (`tasks` array, `tasks.*.id` exists) and `CarryOverTasksRequest` (`task_ids` array), instead of reusing `UpdateTaskRequest` with manual `has()` checks.
  - Inject `TaskService` through the constructor instead of `new TaskService()`.
  - `bulkUpdate` runs one `find` per task. Use a single scoped query, or `upsert`.

- [x] **DEBT-04: Model casts, relations and consistent types** · `S`
  - `Task::casts()`: `is_finished` → bool, `priority` → int (or an enum, see DEBT-05).
  - Add `CalendarDay::user()` and `User::tasks()` (hasManyThrough).
  - Frontend `Task.id` / `calendar_day_id` are typed `string`, but the API returns numbers.
  - Return API resources (`TaskResource`, `CalendarDayResource`) instead of hand-built arrays in `HomeController@calendar`.

- [x] **DEBT-05: One shared priority definition** · `S`
  - A PHP `Priority` enum used for validation, casts and the DB default, plus the TS constants generated from it or kept in sync.
  - Make the add dialog default to **Medium**, matching the DB default (spec decision D3).
  - Rename the "Urgent!" label to "Urgent" to match the spec.

- [x] **DEBT-06: Use Wayfinder instead of hardcoded URLs** · `S`
  - Replace the axios string URLs in [useTaskActions.ts](resources/js/hooks/useTaskActions.ts), [day-panel-content.tsx](resources/js/components/day-panel-content.tsx) and [home.tsx](resources/js/pages/home.tsx) with Wayfinder actions. One of them, `api/tasks/reorder`, is relative (no leading `/`) and breaks on any nested URL.

- [x] **DEBT-07: Split up `home.tsx`** · `M`
  - Extract `CalendarHeader`, `MonthGrid`, `DayCell` and `DayView`, and move fetching and carry-over logic into a hook (`useCalendar`).

- [x] **DEBT-08: Decide on the data-fetching approach** · `M` · _decided: TanStack Query (spec decision D5)_
  - Options: TanStack Query (caching, optimistic updates with rollback, refetch on focus), or Inertia props with partial reloads, instead of hand-rolled axios and `useState`. This makes UX-01 and UX-04 easier.

- [x] **DEBT-09: Small render-performance fixes** · `S`
  - `calendarDays` `useMemo` depends on `startDate`/`endDate` Date objects that are recreated on every render, so it never memoises. Use the month key as the dependency.
  - `emptyDayData` is recreated on every render. Hoist it to module scope.

---

## Phase 4: UX polish

- [ ] **UX-01: Visible error and success feedback** · `S`
  - Every failure today is a silent `console.error`. Add a toast system (e.g. `sonner`), show 422 validation messages inline in the dialogs, and roll back or refetch after a failed mutation.

- [ ] **UX-02: Confirm or undo task deletion** · `S`
  - Either a confirm dialog or (preferred) an "Undo" toast for a few seconds before the delete is sent.

- [ ] **UX-03: Make the add/edit dialogs real forms** · `S`
  - Wrap them in `<form>` so Enter submits. Escape and clicking outside close them (they're controlled `AlertDialog`s with no `onOpenChange` today).
  - Disable Submit while the description is empty or a save is in flight, and show a loading state.
  - Reset the priority after adding a task. Show the 255-char limit.
  - Consider `Dialog` instead of `AlertDialog`, which is meant for confirmations. Replace the hardcoded `bg-green-800!` Submit colour with a theme token.

- [ ] **UX-04: Optimistic reordering** · `S`
  - Apply the new order immediately and roll back if the request fails. Today the list snaps back until the server responds.

- [ ] **UX-05: Touch and mobile support** · `M`
  - Edit, delete and the drag handle are `opacity-0` until hover, so they're unreachable on touch devices. Show them always on small screens, or use a per-task menu.
  - Configure dnd-kit `TouchSensor`/`KeyboardSensor` explicitly.
  - Add a compact month grid for phones (e.g. dots instead of task previews), and check the `h-screen` layout inside the sidebar shell for double scrollbars.

- [ ] **UX-06: Accessibility pass** · `M`
  - `aria-label`s on icon-only buttons (prev/next, back, edit, delete, drag, finish toggle).
  - Day cells become `<button>`s with arrow-key navigation, and today gets `aria-current="date"`.
  - Check colour contrast of the priority badges in dark mode. The edit icon shouldn't turn destructive red on hover.

- [ ] **UX-07: Put the month and day in the URL** · `M`
  - e.g. `/?month=2026-11&day=2026-11-21`, so refresh, browser back/forward and deep links work. The back button in the day view should behave like browser back.

- [ ] **UX-08: Better carry-over dialog** · `S`
  - Checkboxes to choose which tasks to carry over, with select all/none.
  - "Not now" suppresses the prompt until tomorrow (today it reopens every time you return to the month view).
  - Show readable dates ("Thu, Nov 19") and priority badges.

- [ ] **UX-09: Autosave notes** · `S`
  - Save with a debounce while typing, show a "Saving…/Saved" indicator, and keep save-on-blur as a fallback.

- [ ] **UX-10: Richer month-view cells** · `S`
  - "+N more" when a day has more than 3 tasks, a note indicator (the code for it is commented out in [home.tsx](resources/js/pages/home.tsx)), and an "all done" style using the unused `finishedAllTasks`.

- [ ] **UX-11: Year picker range** · `S`
  - The ±5-year list moves with the current date as you navigate. Use a fixed range around the real current year, or allow free input.

- [ ] **UX-12: Copy and empty states** · `S`
  - The empty day says "Nothing to do today" for every date. Use the right wording for past and future days.
  - Give the dialogs a real description (it's empty today, and Radix warns about that).

---

## Phase 5: Feature backlog (to discuss)

**Next up (spec decision D4):** FEAT-02, FEAT-09 and FEAT-10, once phases 0–4 are done. The rest aren't prioritised yet. Before starting any feature, add acceptance criteria to it.

### Small to medium
- [ ] **FEAT-01: User settings for time zone and week start** · `M`. Detect the time zone on first login and store it on the user. Add a week-start setting under Settings (default Monday), used by both the API and the grid. This is the long-term fix for BUG-02 and BUG-04.
- [ ] **FEAT-02: Move or snooze a task to another date** · `M` · ⭐ next up. "Move to tomorrow" or a date picker from the task menu, plus drag a task onto a calendar day. Needs a `PUT /api/tasks/{task}/move` endpoint.
- [ ] **FEAT-03: Natural-language quick add** · `M`. e.g. "Call Bob tomorrow !high" parses the date and priority.
- [ ] **FEAT-04: Optional time and duration on tasks** · `M`. Optional due time or time block, with "all day" as the default. This conflicts with a spec non-goal, so it needs a scope decision.
- [ ] **FEAT-05: Sort, filter and hide completed** · `S`. Sort by priority or status in the day view, and a "hide completed" toggle.
- [ ] **FEAT-06: Search** · `M`. Search across all tasks and notes, and jump to the day.
- [ ] **FEAT-07: Keyboard shortcuts** · `S`. `n` new task, `t` today, `←/→` month or day, `Esc` back to the month view, `?` help.
- [ ] ~~**FEAT-08: Carry-over history**~~ · not planned. We decided carry-over only moves tasks (spec decision D1). Kept here for reference: it would record `carried_from_date` / `carry_count` and show a "carried over ×3" badge.

### Larger
- [ ] **FEAT-09: Recurring tasks** · `L` · ⭐ next up. Daily, weekdays, weekly or custom rules. Needs a design decision: generate task rows ahead of time, or expand them when the calendar is read.
- [ ] **FEAT-10: Week view and agenda/list view** · `L` · ⭐ next up. Alongside the month view, with a view switcher.
- [ ] **FEAT-11: Subtasks / checklists** · `M`
- [ ] **FEAT-12: Tags, labels or projects with colours** · `M`
- [ ] **FEAT-13: Rich-text or markdown notes, and a daily journal template** · `M`
- [ ] **FEAT-14: Stats and streaks** · `M`. Completion rate per day, week or month, a streak counter, and a heatmap.
- [ ] **FEAT-15: Reminders and notifications** · `L`. A morning email digest of today's plan, or web push. Needs queues and a scheduler in production.
- [ ] **FEAT-16: External calendar integration** · `L`. A read-only iCal feed export first, then possibly Google or Outlook sync.
- [ ] **FEAT-17: PWA and offline support** · `L`. Installable app with offline caching and queued mutations.
- [ ] **FEAT-18: Data export and import** · `S`. CSV or JSON export of all tasks and notes, and import.
- [ ] **FEAT-19: Sharing and collaboration** · `L`. Share a day or list, or plan together. This is out of the current scope (spec §1).

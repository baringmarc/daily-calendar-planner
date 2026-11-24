import type { Priority } from '@/constants/priority';
import type { RepeatFrequency } from '@/constants/recurrence';

// A repeat rule's schedule (FEAT-09). Mirrors RecurringTask::schedule().
// `weekdays` (0 = Sunday ... 6 = Saturday) is only set for weekly rules.
export type Recurrence = {
    frequency: RepeatFrequency;
    interval: number;
    weekdays: number[] | null;
    ends_on: string | null;
};

// Mirrors App\Http\Resources\TaskResource. Change both together.
export type Task = {
    id: number;
    description: string;
    is_finished: boolean;
    calendar_day_id: number;
    priority: Priority;
    order: number;
    // Null for a one-off task.
    recurrence: Recurrence | null;
};

// Mirrors App\Http\Resources\CalendarDayResource. `id` is null until the
// day has been saved: a day row is only created with its first task or note.
export type CalendarDay = {
    id: number | null;
    note: string | null;
};

export type DayData = {
    calendar_day: CalendarDay;
    tasks: Task[];
};

export type UnfinishedTasks = Record<string, Task[]>;

// `GET /api/calendar`, keyed by Y-m-d date.
export type CalendarData = Record<string, DayData>;

// `GET /api/search` (FEAT-06). Mirrors SearchController. A day comes with
// only its matching tasks, and its note only when the note matches.
export type SearchDay = {
    date: string;
    note: string | null;
    tasks: Task[];
};

export type SearchGroup = {
    days: SearchDay[];
    // More days matched than the group lists.
    has_more: boolean;
};

// Today and later days soonest first, earlier days most recent first.
export type SearchResults = {
    upcoming: SearchGroup;
    earlier: SearchGroup;
};

// The calendar's views (FEAT-10), from ?view= in the URL.
export type CalendarView = 'month' | 'week' | 'agenda';

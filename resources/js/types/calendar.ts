import type { Priority } from '@/constants/priority';

// Mirrors App\Http\Resources\TaskResource. Change both together.
export type Task = {
    id: number;
    description: string;
    is_finished: boolean;
    calendar_day_id: number;
    priority: Priority;
    order: number;
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

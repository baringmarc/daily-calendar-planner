import axios from 'axios';
import CalendarDayController from '@/actions/App/Http/Controllers/CalendarDayController';
import HomeController from '@/actions/App/Http/Controllers/HomeController';
import TaskController from '@/actions/App/Http/Controllers/TaskController';
import type { Priority } from '@/constants/priority';
import type {
    CalendarData,
    CalendarDay,
    Recurrence,
    Task,
    UnfinishedTasks,
} from '@/types';

/**
 * TanStack Query keys. Every month's calendar lives under `calendar`, so
 * `invalidateQueries({ queryKey: queryKeys.calendar })` refreshes them all.
 */
export const queryKeys = {
    calendar: ['calendar'] as const,
    calendarMonth: (month: string) => ['calendar', month] as const,
    unfinishedTasks: ['tasks', 'unfinished'] as const,
    parsedTask: (text: string) => ['tasks', 'parse', text] as const,
};

// --- Queries ---

/** `month` is yyyy-MM. */
export async function fetchCalendarMonth(month: string): Promise<CalendarData> {
    const res = await axios.get(
        HomeController.calendar.url({ query: { month } }),
    );

    return res.data.calendarData ?? {};
}

export async function fetchUnfinishedTasks(): Promise<UnfinishedTasks> {
    const res = await axios.get(TaskController.unfinished.url());

    return res.data.unfinishedTasks ?? {};
}

/**
 * A quick-add line read on the server (FEAT-03): the description without
 * the date and priority words, and those, or null when there are none.
 */
export type ParsedTask = {
    description: string;
    date: string | null;
    priority: Priority | null;
};

export async function parseTask(text: string): Promise<ParsedTask> {
    const res = await axios.get(TaskController.parse.url({ query: { text } }));

    return res.data;
}

// --- Mutations ---

/** With a `recurrence`, the task is the first of a repeating series. */
export async function createTask(task: {
    description: string;
    date: string;
    priority: Priority;
    recurrence: Recurrence | null;
}): Promise<Task> {
    const res = await axios.post(TaskController.store.url(), task);

    return res.data;
}

export async function updateTask(
    id: number,
    changes: Partial<Pick<Task, 'description' | 'is_finished' | 'priority'>>,
): Promise<Task> {
    const res = await axios.put(TaskController.update.url(id), changes);

    return res.data;
}

export async function deleteTask(id: number): Promise<void> {
    await axios.delete(TaskController.destroy.url(id));
}

/**
 * A delete that survives the page unloading, which cancels axios requests.
 * Sends the same headers axios would, including Laravel's XSRF token.
 */
export function deleteTaskOnUnload(id: number): void {
    const xsrf = document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);

    void fetch(TaskController.destroy.url(id), {
        method: 'DELETE',
        keepalive: true,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
        },
    });
}

/**
 * Saves a task with its repeat rule (FEAT-09): changes the rule and the
 * unfinished occurrences after the task, makes a one-off task repeat, or,
 * with a null `recurrence`, stops the series after it.
 */
export async function updateTaskSeries(
    id: number,
    changes: {
        description: string;
        priority: Priority;
        recurrence: Recurrence | null;
    },
): Promise<Task> {
    const res = await axios.put(TaskController.updateSeries.url(id), changes);

    return res.data;
}

/** `date` is yyyy-MM-dd. The task goes to the end of that day's list. */
export async function moveTask(id: number, date: string): Promise<Task> {
    const res = await axios.put(TaskController.move.url(id), { date });

    return res.data;
}

/** `ids` are one day's tasks in their new order. */
export async function reorderTasks(ids: number[]): Promise<void> {
    await axios.put(TaskController.reorder.url(), {
        tasks: ids.map((id) => ({ id })),
    });
}

export async function carryOverTasks(ids: number[]): Promise<Task[]> {
    const res = await axios.post(TaskController.carryOverTasks.url(), {
        task_ids: ids,
    });

    return res.data;
}

export async function createCalendarDay(day: {
    date: string;
    note: string;
}): Promise<CalendarDay> {
    const res = await axios.post(CalendarDayController.store.url(), day);

    return res.data;
}

export async function updateCalendarDay(
    id: number,
    changes: { note: string },
): Promise<CalendarDay> {
    const res = await axios.put(CalendarDayController.update.url(id), changes);

    return res.data;
}

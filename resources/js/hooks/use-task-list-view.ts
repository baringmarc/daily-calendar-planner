import { useState } from 'react';
import type { Task } from '@/types';

// How the day view's task list is shown (FEAT-05). "manual" is the order
// the user dragged the tasks into.
export type TaskSort = 'manual' | 'priority' | 'status';

export type TaskListView = {
    sort: TaskSort;
    hideCompleted: boolean;
};

export const TASK_SORTS: { value: TaskSort; label: string }[] = [
    { value: 'manual', label: 'My order' },
    { value: 'priority', label: 'Priority' },
    { value: 'status', label: 'Status' },
];

const DEFAULT_VIEW: TaskListView = { sort: 'manual', hideCompleted: false };

// One choice for every day, remembered in this browser only. Storage can be
// unavailable (private mode, SSR), in which case it lasts until a reload.
const STORAGE_KEY = 'calendaily:task-list-view';

function readView(): TaskListView {
    try {
        const stored = JSON.parse(
            window.localStorage.getItem(STORAGE_KEY) ?? 'null',
        ) as Partial<TaskListView> | null;

        return {
            sort: TASK_SORTS.some(({ value }) => value === stored?.sort)
                ? (stored!.sort as TaskSort)
                : DEFAULT_VIEW.sort,
            hideCompleted: stored?.hideCompleted === true,
        };
    } catch {
        return DEFAULT_VIEW;
    }
}

function writeView(view: TaskListView) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
    } catch {
        // Only remembered until the page is reloaded.
    }
}

// Ties keep the manual order, since `tasks` arrive in it and sort is stable.
const COMPARE: Record<TaskSort, ((a: Task, b: Task) => number) | null> = {
    manual: null,
    priority: (a, b) => b.priority - a.priority,
    status: (a, b) => Number(a.is_finished) - Number(b.is_finished),
};

/**
 * The tasks to show, in the order to show them.
 */
export function arrangeTasks(tasks: Task[], view: TaskListView): Task[] {
    const shown = view.hideCompleted
        ? tasks.filter((task) => !task.is_finished)
        : [...tasks];
    const compare = COMPARE[view.sort];

    return compare ? shown.sort(compare) : shown;
}

/**
 * The day's whole list after the shown tasks were dragged into `reordered`.
 * Hidden tasks keep their places, and the shown ones fill the places the
 * shown ones had, in their new order.
 */
export function mergeReorder(all: Task[], reordered: Task[]): Task[] {
    const shownIds = new Set(reordered.map((task) => task.id));
    let next = 0;

    return all.map((task) =>
        shownIds.has(task.id) ? reordered[next++] : task,
    );
}

export function useTaskListView() {
    const [view, setView] = useState(readView);

    const update = (changes: Partial<TaskListView>) => {
        const next = { ...view, ...changes };

        setView(next);
        writeView(next);
    };

    return {
        view,
        setSort: (sort: TaskSort) => update({ sort }),
        setHideCompleted: (hideCompleted: boolean) => update({ hideCompleted }),
    };
}

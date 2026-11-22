import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { EMPTY_DAY_DATA } from '@/hooks/use-calendar';
import { moveTask, queryKeys } from '@/lib/calendar-api';
import type { CalendarData, Task } from '@/types';

// Applies `updater` to every cached month. A date can be in two months'
// grids (as a leading or trailing day), so each of them is patched.
function patchCachedMonths(
    queryClient: QueryClient,
    updater: (calendar: CalendarData) => CalendarData,
) {
    queryClient.setQueriesData<CalendarData>(
        { queryKey: queryKeys.calendar },
        (calendar) => (calendar ? updater(calendar) : calendar),
    );
}

// Takes the task out of whichever day it's on and puts `placed` at the end
// of `date`'s list. A month whose grid doesn't show `date` gains a key it
// never reads, which its next refetch drops. `dayId` is the target day's id
// once the server has confirmed it, and null before.
function placeTask(
    calendar: CalendarData,
    placed: Task,
    date: string,
    dayId: number | null,
): CalendarData {
    const next: CalendarData = {};

    for (const [key, day] of Object.entries(calendar)) {
        next[key] = day.tasks.some((t) => t.id === placed.id)
            ? { ...day, tasks: day.tasks.filter((t) => t.id !== placed.id) }
            : day;
    }

    const target = next[date] ?? EMPTY_DAY_DATA;

    next[date] = {
        calendar_day: {
            ...target.calendar_day,
            // The server creates the day if needed. Keep its id, so a note
            // saved there next updates the row instead of creating another.
            id: target.calendar_day.id ?? dayId,
        },
        tasks: [...target.tasks, placed],
    };

    return next;
}

/**
 * Moves a task to another date (FEAT-02). The task leaves its day at once,
 * in every cached month, and the server's copy (with its new day and order)
 * replaces it when the move is confirmed. A failure refetches the calendar
 * (see lib/query-client.ts), which puts it back.
 */
export function useMoveTask() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: ({ task, date }: { task: Task; date: string }) =>
            moveTask(task.id, date),
        onMutate: async ({ task, date }) => {
            // A refetch already in flight would land with the task back
            // on its old day.
            await queryClient.cancelQueries({ queryKey: queryKeys.calendar });

            patchCachedMonths(queryClient, (calendar) =>
                placeTask(calendar, task, date, null),
            );
        },
        onSuccess: (moved, { date }) => {
            patchCachedMonths(queryClient, (calendar) =>
                placeTask(calendar, moved, date, moved.calendar_day_id),
            );
            toast.success(`Moved to ${format(parseISO(date), 'EEE, MMM d')}`, {
                description: moved.description,
            });
        },
        meta: { errorMessage: "Couldn't move the task" },
    });

    // `date` is yyyy-MM-dd.
    return (task: Task, date: string) => mutation.mutate({ task, date });
}

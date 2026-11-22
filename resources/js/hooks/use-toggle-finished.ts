import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, updateTask } from '@/lib/calendar-api';
import type { CalendarData, Task } from '@/types';

/**
 * Checks a task off (or back on) outside the day view: from the week and
 * agenda views (FEAT-10). The server's copy replaces the task wherever it
 * is cached, since a date can be in two months' grids.
 */
export function useToggleFinished() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (task: Task) =>
            updateTask(task.id, { is_finished: !task.is_finished }),
        onSuccess: (saved) =>
            queryClient.setQueriesData<CalendarData>(
                { queryKey: queryKeys.calendar },
                (calendar) =>
                    calendar &&
                    Object.fromEntries(
                        Object.entries(calendar).map(([key, day]) => [
                            key,
                            day.tasks.some((t) => t.id === saved.id)
                                ? {
                                      ...day,
                                      tasks: day.tasks.map((t) =>
                                          t.id === saved.id ? saved : t,
                                      ),
                                  }
                                : day,
                        ]),
                    ),
            ),
        meta: { errorMessage: "Couldn't update the task" },
    });

    return (task: Task) => mutation.mutate(task);
}

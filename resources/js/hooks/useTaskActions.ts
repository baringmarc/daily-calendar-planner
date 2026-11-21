import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { TaskFormValues } from '@/components/task-form-dialog';
import {
    createCalendarDay,
    createTask,
    deleteTask,
    reorderTasks,
    queryKeys,
    updateCalendarDay,
    updateTask,
} from '@/lib/calendar-api';
import { validationErrors } from '@/lib/errors';
import {
    cancelDelete,
    commitDelete,
    scheduleDelete,
} from '@/lib/pending-deletes';
import type { DayData, Task } from '@/types';

// How long a deleted task can be brought back before the delete is sent.
const UNDO_DELETE_MS = 5000;

// Which task dialog is open: adding a new task, or editing one.
type TaskDialog = { task: Task | null } | null;

/**
 * One day's mutations. Each one patches the cached calendar through
 * `updateData` once the server confirms it, instead of fetching again.
 */
export function useTaskActions({
    date,
    dayData,
    updateData,
}: {
    date: Date;
    dayData: DayData;
    updateData: (updater: (prev: DayData) => DayData) => void;
}) {
    const queryClient = useQueryClient();
    const [taskDialog, setTaskDialog] = useState<TaskDialog>(null);

    const dateKey = format(date, 'yyyy-MM-dd');

    const replaceTask = (task: Task) =>
        updateData((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)),
        }));

    // A day row only exists once it has a task or a note, so the first note
    // creates it. The new id is also kept in a ref, because the autosave can
    // queue the next save before the cache update has re-rendered this hook.
    const createdDayId = useRef<number | null>(null);
    const saveNote = useMutation({
        mutationFn: (note: string) => {
            const id = dayData.calendar_day.id ?? createdDayId.current;

            return id
                ? updateCalendarDay(id, { note })
                : createCalendarDay({ date: dateKey, note });
        },
        onSuccess: (day) => {
            createdDayId.current = day.id;
            updateData((prev) => ({ ...prev, calendar_day: day }));
        },
        meta: { errorMessage: "Couldn't save the note" },
    });

    // Adds a task, or saves the one being edited.
    const saveTask = useMutation({
        mutationFn: ({
            task,
            values,
        }: {
            task: Task | null;
            values: TaskFormValues;
        }) =>
            task
                ? updateTask(task.id, values)
                : createTask({ ...values, date: dateKey }),
        onSuccess: (saved, { task }) => {
            if (task) {
                replaceTask(saved);
            } else {
                // The server creates the day row with its first task, so
                // remember its id: a note saved next must update that row,
                // not try to create a second one (a 422).
                updateData((prev) => ({
                    calendar_day: {
                        ...prev.calendar_day,
                        id: prev.calendar_day.id ?? saved.calendar_day_id,
                    },
                    tasks: [...prev.tasks, saved],
                }));
            }

            setTaskDialog(null);
        },
        meta: {
            errorMessage: "Couldn't save the task",
            inlineValidation: true,
        },
    });

    // Sent once the undo window has passed (see deleteWithUndo). The task
    // has already left the list, so success has nothing left to patch.
    const removeTask = useMutation({
        mutationFn: deleteTask,
        meta: { errorMessage: "Couldn't delete the task" },
    });

    // Hides the task straight away and offers an undo for a few seconds
    // before the delete is sent (UX-02).
    const deleteWithUndo = (task: Task) => {
        let index = -1;

        updateData((prev) => {
            index = prev.tasks.findIndex((t) => t.id === task.id);

            return {
                ...prev,
                tasks: prev.tasks.filter((t) => t.id !== task.id),
            };
        });

        const toastId = `delete-task-${task.id}`;

        scheduleDelete(task.id, UNDO_DELETE_MS, () => {
            toast.dismiss(toastId);
            removeTask.mutate(task.id);
        });

        toast('Task deleted', {
            id: toastId,
            description: task.description,
            duration: UNDO_DELETE_MS,
            action: {
                label: 'Undo',
                onClick: () => {
                    if (!cancelDelete(task.id)) {
                        return;
                    }

                    // Back into its old place, unless a refetch already
                    // brought it back.
                    updateData((prev) => {
                        if (prev.tasks.some((t) => t.id === task.id)) {
                            return prev;
                        }

                        const tasks = [...prev.tasks];
                        tasks.splice(index, 0, task);

                        return { ...prev, tasks };
                    });
                },
            },
            // Closing the toast means "yes, delete it".
            onDismiss: () => commitDelete(task.id),
        });
    };

    const toggleFinished = useMutation({
        mutationFn: (task: Task) =>
            updateTask(task.id, { is_finished: !task.is_finished }),
        onSuccess: replaceTask,
        meta: { errorMessage: "Couldn't update the task" },
    });

    // Optimistic: the new order shows at once, and goes back to the old one
    // if the server rejects it (UX-04).
    const reorder = useMutation({
        mutationFn: (tasks: Task[]) =>
            reorderTasks(tasks.map((task) => task.id)),
        onMutate: async (tasks) => {
            // A refetch already in flight would land with the old order.
            await queryClient.cancelQueries({ queryKey: queryKeys.calendar });

            const previous = dayData.tasks;

            updateData((prev) => ({
                ...prev,
                tasks: tasks.map((task, i) => ({ ...task, order: i + 1 })),
            }));

            return { previous };
        },
        onError: (_error, _tasks, context) => {
            if (context) {
                updateData((prev) => ({ ...prev, tasks: context.previous }));
            }
        },
        meta: { errorMessage: "Couldn't reorder the tasks" },
    });

    // Opening or closing the dialog clears the last attempt's errors.
    const openTaskDialog = (task: Task | null) => {
        saveTask.reset();
        setTaskDialog({ task });
    };

    const closeTaskDialog = () => {
        saveTask.reset();
        setTaskDialog(null);
    };

    return {
        // The add/edit dialog
        taskDialog,
        openAddTask: () => openTaskDialog(null),
        openEditTask: (task: Task) => openTaskDialog(task),
        closeTaskDialog,
        submitTask: (values: TaskFormValues) =>
            saveTask.mutate({ task: taskDialog?.task ?? null, values }),
        isSavingTask: saveTask.isPending,
        // 422 messages by field
        taskErrors: validationErrors(saveTask.error),
        // Actions
        // Rejects if it failed.
        saveNote: async (note: string) => {
            await saveNote.mutateAsync(note);
        },
        deleteTask: deleteWithUndo,
        toggleFinished: (task: Task) => toggleFinished.mutate(task),
        // `tasks` is the day's whole list in its new order.
        reorderTasks: (tasks: Task[]) => reorder.mutate(tasks),
    };
}

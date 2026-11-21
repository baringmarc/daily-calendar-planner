import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';
import type { TaskFormValues } from '@/components/task-form-dialog';
import {
    createCalendarDay,
    createTask,
    deleteTask,
    reorderTasks,
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
    const [taskDialog, setTaskDialog] = useState<TaskDialog>(null);

    const dateKey = format(date, 'yyyy-MM-dd');

    const replaceTask = (task: Task) =>
        updateData((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)),
        }));

    // A day row only exists once it has a task or a note, so the first note
    // creates it.
    const saveNote = useMutation({
        mutationFn: (note: string) =>
            dayData.calendar_day.id
                ? updateCalendarDay(dayData.calendar_day.id, { note })
                : createCalendarDay({ date: dateKey, note }),
        onSuccess: (day) =>
            updateData((prev) => ({ ...prev, calendar_day: day })),
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
                updateData((prev) => ({
                    ...prev,
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

    const reorder = useMutation({
        mutationFn: async (tasks: Task[]) => {
            await reorderTasks(tasks.map((task) => task.id));

            return tasks;
        },
        onSuccess: (tasks) => updateData((prev) => ({ ...prev, tasks })),
        meta: { errorMessage: "Couldn't reorder the tasks" },
    });

    // Returns whether the note is now saved.
    const updateNotes = async (note: string): Promise<boolean> => {
        if (note === dayData.calendar_day.note) {
            return true;
        }

        try {
            await saveNote.mutateAsync(note);

            return true;
        } catch {
            return false;
        }
    };

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
        updateNotes,
        deleteTask: deleteWithUndo,
        toggleFinished: (task: Task) => toggleFinished.mutate(task),
        // `tasks` is the day's whole list in its new order.
        reorderTasks: (tasks: Task[]) => reorder.mutate(tasks),
    };
}

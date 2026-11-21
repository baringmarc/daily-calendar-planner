import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
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
import type { DayData, Task } from '@/types';

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

    const removeTask = useMutation({
        mutationFn: async (id: number) => {
            await deleteTask(id);

            return id;
        },
        onSuccess: (id) =>
            updateData((prev) => ({
                ...prev,
                tasks: prev.tasks.filter((t) => t.id !== id),
            })),
        meta: { errorMessage: "Couldn't delete the task" },
    });

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
        deleteTask: (task: Task) => removeTask.mutate(task.id),
        toggleFinished: (task: Task) => toggleFinished.mutate(task),
        // `tasks` is the day's whole list in its new order.
        reorderTasks: (tasks: Task[]) => reorder.mutate(tasks),
    };
}

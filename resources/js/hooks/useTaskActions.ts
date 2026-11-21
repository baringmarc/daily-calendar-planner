import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import type { Priority } from '@/constants/priority';
import {
    createCalendarDay,
    createTask,
    deleteTask,
    reorderTasks,
    updateCalendarDay,
    updateTask,
} from '@/lib/calendar-api';
import type { DayData, Task } from '@/types';

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
    const [newTask, setNewTask] = useState('');
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [currentEditTask, setCurrentEditTask] = useState<Task | null>(null);

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
        onError: () => console.error('Failed to update notes'),
    });

    const addTask = useMutation({
        mutationFn: createTask,
        onSuccess: (task) => {
            updateData((prev) => ({ ...prev, tasks: [...prev.tasks, task] }));
            setNewTask('');
            setIsAddingTask(false);
        },
        onError: () => console.error('Failed to add task'),
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
        onError: () => console.error('Failed to delete task'),
    });

    const toggleFinished = useMutation({
        mutationFn: ({
            id,
            is_finished,
        }: {
            id: number;
            is_finished: boolean;
        }) => updateTask(id, { is_finished }),
        onSuccess: replaceTask,
        onError: () => console.error('Failed to update task'),
    });

    const editTask = useMutation({
        mutationFn: (task: Task) =>
            updateTask(task.id, {
                description: task.description,
                priority: task.priority,
            }),
        onSuccess: (task) => {
            replaceTask(task);
            setCurrentEditTask(null);
        },
        onError: () => console.error('Failed to update task'),
    });

    const reorder = useMutation({
        mutationFn: async (tasks: Task[]) => {
            await reorderTasks(tasks.map((task) => task.id));

            return tasks;
        },
        onSuccess: (tasks) => updateData((prev) => ({ ...prev, tasks })),
        onError: () => console.error('Failed to reorder tasks'),
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

    const handleAddTask = async (task: string, priority: Priority) => {
        if (!task.trim()) {
            return;
        }

        addTask.mutate({ description: task.trim(), date: dateKey, priority });
    };

    const handleDeleteTask = async (id: number) => {
        removeTask.mutate(id);
    };

    const toggleFinishTask = async (id: number, is_finished: boolean) => {
        toggleFinished.mutate({ id, is_finished });
    };

    // toggle edit mode (opens edit modal)
    const toggleEditTask = (task: Task | null) => {
        setIsAddingTask(false);
        setCurrentEditTask(task);
    };

    const handleEditTask = async (task: Task | null) => {
        if (task) {
            editTask.mutate(task);
        }
    };

    // `tasks` is the day's whole list in its new order.
    const updateTaskOrder = (tasks: Task[]) => reorder.mutate(tasks);

    return {
        // state
        newTask,
        setNewTask,
        isAddingTask,
        setIsAddingTask,
        currentEditTask,
        setCurrentEditTask,
        // actions
        updateNotes,
        handleAddTask,
        handleDeleteTask,
        toggleFinishTask,
        toggleEditTask,
        handleEditTask,
        updateTaskOrder,
    };
}

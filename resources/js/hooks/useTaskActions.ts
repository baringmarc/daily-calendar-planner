import { useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import type { DayData, Task } from '@/types';

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

    const updateNotes = async (note: string) => {
        if (note === dayData?.calendar_day?.note) return;

        const dateKey = format(date, 'yyyy-MM-dd');

        try {
            if (!dayData?.calendar_day?.id) {
                const res = await axios.post('/calendar-days', {
                    date: dateKey,
                    note,
                });

                if (res.status !== 201) throw new Error();

                updateData((prev) => ({
                    ...prev,
                    calendar_day: { id: res.data.id, date: dateKey, note },
                }));
            } else {
                const res = await axios.put(
                    `/calendar-days/${dayData.calendar_day.id}`,
                    { note },
                );

                if (res.status !== 200) throw new Error();

                updateData((prev) => ({
                    ...prev,
                    calendar_day: {
                        ...prev.calendar_day,
                        note,
                    },
                }));
            }
        } catch {
            console.error('Failed to update notes');
        }
    };

    // ADD task
    const handleAddTask = async (task: string, priority: number) => {
        if (!task.trim()) return;

        const dateKey = format(date, 'yyyy-MM-dd');

        try {
            const res = await axios.post('/tasks', {
                description: task.trim(),
                date: dateKey,
                is_finished: false,
                priority: priority,
            });

            if (res.status !== 201) throw new Error();

            const newTaskData = {
                ...res.data,
                description: newTask.trim(),
                date: dateKey,
            };

            updateData((prev) => ({
                ...prev,
                tasks: [...prev.tasks, newTaskData],
            }));

            setNewTask('');
            setIsAddingTask(false);
        } catch {
            console.error('Failed to add task');
        }
    };

    // DELETE task
    const handleDeleteTask = async (id: string) => {
        try {
            const res = await axios.delete(`/tasks/${id}`);
            if (res.status !== 200) throw new Error();

            updateData((prev) => ({
                ...prev,
                tasks: prev.tasks.filter((t) => t.id !== id),
            }));
        } catch {
            console.error('Failed to delete task');
        }
    };

    // - check off task
    const toggleFinishTask = async (id: string, is_finished: boolean) => {
        try {
            const res = await axios.put(`/tasks/${id}`, { is_finished });
            if (res.status !== 200) throw new Error();

            updateData((prev) => ({
                ...prev,
                tasks: prev.tasks.map((task) =>
                    task.id === id ? res.data : task,
                ),
            }));
        } catch {
            console.error('Failed to update task');
        }
    };

    // toggle edit mode (opens edit modal)
    const toggleEditTask = (task: Task | null) => {
        setIsAddingTask(false);
        setCurrentEditTask(task);
    };

    // EDIT task
    const handleEditTask = async (task: Task | null) => {
        if (!task) return;

        try {
            const res = await axios.put(`/tasks/${task.id}`, task);

            if (res.status !== 200) throw new Error();

            updateData((prev) => ({
                ...prev,
                tasks: prev.tasks.map((task) =>
                    task.id === currentEditTask?.id ? res.data : task,
                ),
            }));

            setCurrentEditTask(null);
        } catch {
            console.error('Failed to update task');
        }
    };

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
    };
}

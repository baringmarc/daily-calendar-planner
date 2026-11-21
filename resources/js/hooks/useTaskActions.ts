import axios from 'axios';
import { format } from 'date-fns';
import { useState } from 'react';
import CalendarDayController from '@/actions/App/Http/Controllers/CalendarDayController';
import TaskController from '@/actions/App/Http/Controllers/TaskController';
import type { Priority } from '@/constants/priority';
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

    // Returns whether the note is now saved.
    const updateNotes = async (note: string): Promise<boolean> => {
        if (note === dayData?.calendar_day?.note) {
            return true;
        }

        const dateKey = format(date, 'yyyy-MM-dd');

        try {
            if (!dayData?.calendar_day?.id) {
                const res = await axios.post(
                    CalendarDayController.store.url(),
                    {
                        date: dateKey,
                        note,
                    },
                );

                if (res.status !== 201) {
                    throw new Error();
                }

                updateData((prev) => ({
                    ...prev,
                    calendar_day: { id: res.data.id, note },
                }));
            } else {
                const res = await axios.put(
                    CalendarDayController.update.url(dayData.calendar_day.id),
                    { note },
                );

                if (res.status !== 200) {
                    throw new Error();
                }

                updateData((prev) => ({
                    ...prev,
                    calendar_day: {
                        ...prev.calendar_day,
                        note,
                    },
                }));
            }

            return true;
        } catch {
            console.error('Failed to update notes');

            return false;
        }
    };

    // ADD task
    const handleAddTask = async (task: string, priority: Priority) => {
        if (!task.trim()) {
            return;
        }

        const dateKey = format(date, 'yyyy-MM-dd');

        try {
            const res = await axios.post(TaskController.store.url(), {
                description: task.trim(),
                date: dateKey,
                is_finished: false,
                priority: priority,
            });

            if (res.status !== 201) {
                throw new Error();
            }

            updateData((prev) => ({
                ...prev,
                tasks: [...prev.tasks, res.data],
            }));

            setNewTask('');
            setIsAddingTask(false);
        } catch {
            console.error('Failed to add task');
        }
    };

    // DELETE task
    const handleDeleteTask = async (id: number) => {
        try {
            const res = await axios.delete(TaskController.destroy.url(id));

            if (res.status !== 200) {
                throw new Error();
            }

            updateData((prev) => ({
                ...prev,
                tasks: prev.tasks.filter((t) => t.id !== id),
            }));
        } catch {
            console.error('Failed to delete task');
        }
    };

    // - check off task
    const toggleFinishTask = async (id: number, is_finished: boolean) => {
        try {
            const res = await axios.put(TaskController.update.url(id), {
                is_finished,
            });

            if (res.status !== 200) {
                throw new Error();
            }

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
        if (!task) {
            return;
        }

        try {
            const res = await axios.put(TaskController.update.url(task.id), {
                description: task.description,
                priority: task.priority,
            });

            if (res.status !== 200) {
                throw new Error();
            }

            updateData((prev) => ({
                ...prev,
                tasks: prev.tasks.map((t) => (t.id === task.id ? res.data : t)),
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

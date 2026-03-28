import type { DayData } from '@/types';
import {
    AlignLeft,
    CalendarIcon,
    CheckCircle2,
    CheckSquare,
    Circle,
    Plus,
    Trash2,
    SquarePen,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { format } from 'date-fns';

import { router } from '@inertiajs/react';
import axios from 'axios';

// --- Day Panel Content Component ---
export function DayPanelContent({
    date,
    dayData,
    updateData,
}: {
    date: Date;
    dayData: DayData;
    updateData: (updater: (prev: DayData) => DayData) => void;
}) {
    const [newTask, setNewTask] = useState('');
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [currentEditTask, setCurrentEditTask] = useState<string>('');
    const [currentEditTaskID, setCurrentEditTaskID] = useState<string | null>(
        null,
    );

    // Reset local state when date changes
    useEffect(() => {
        setNewTask('');
        setIsAddingNote(false);
        setIsAddingTask(false);
        setCurrentEditTask('');
        setCurrentEditTaskID(null);
    }, [date]);

    const hasContent = !!dayData?.notes || dayData.tasks.length > 0;
    const isEditing = isAddingNote || isAddingTask || !currentEditTaskID;

    const updateNotes = (val: string) => {
        updateData((prev) => ({ ...prev, notes: val }));
    };

    const handleAddTask = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newTask.trim()) return;

        const payload = {
            id: '',
            description: newTask.trim(),
            date: format(date, 'yyyy-MM-dd'),
            is_finished: false,
        };

        try {
            const res = await axios.post('/tasks', payload);
            if (!res || res.status !== 201) {
                console.error('Failed to add task');
                return;
            }

            payload.id = res.data.id;

            updateData((prev) => ({
                ...prev,
                tasks: [...prev.tasks, payload],
            }));

            setIsAddingTask(false);
            setNewTask('');
        } catch (error) {
            console.error('Failed to add task');
        }
    };

    const handleDeleteTask = async (id: string) => {
        try {
            const res = await axios.delete(`/tasks/${id}`);
            if (!res || res.status !== 200) {
                console.error('Failed to delete task');
                return;
            }

            updateData((prev) => ({
                ...prev,
                tasks: prev.tasks.filter((t) => t.id !== id),
            }));
        } catch (error) {
            console.error('Failed to delete task');
        }
    };

    const toggleFinishTask = async (id: string, is_finished: boolean) => {
        try {
            const res = await axios.put(`/tasks/${id}`, {
                is_finished,
            });

            if (!res || res.status !== 200) {
                console.error('Failed to update task');
                return;
            }

            updateData((prev) => ({
                ...prev,
                tasks: prev.tasks.map((task) =>
                    task.id === id ? res.data : task,
                ),
            }));
        } catch (error) {
            console.error('Failed to update task');
        }
    };

    const toggleEditTask = (id: string, description: string) => {
        setIsAddingTask(false);
        setCurrentEditTaskID(id);
        setCurrentEditTask(description);
    };

    const handleEditTask = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (currentEditTaskID === null) return;

        try {
            const res = await axios.put(`/tasks/${currentEditTaskID}`, {
                description: currentEditTask.trim(),
            });

            if (!res.data || res.status !== 200) {
                console.error('Failed to update task');
                return;
            }

            updateData((prev) => ({
                ...prev,
                tasks: prev.tasks.map((task) =>
                    task.id === currentEditTaskID ? res.data : task,
                ),
            }));

            setCurrentEditTask('');
            setCurrentEditTaskID(null);
        } catch (error) {
            console.error('Failed to add task');
        }
    };

    // Empty State
    if (!hasContent && !isEditing) {
        return (
            <div className="flex flex-col items-center justify-center space-y-6 p-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
                    <CalendarIcon className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="space-y-2">
                    <p className="text-xl font-semibold text-foreground">
                        Nothing to do today
                    </p>
                    <p className="mx-auto max-w-[250px] text-sm text-muted-foreground">
                        Take a break, or add some tasks and notes for this day.
                    </p>
                </div>
            </div>
        );
    }

    const completedCount = dayData.tasks.filter((t) => t.is_finished).length;
    const progressPercent =
        dayData.tasks.length === 0
            ? 0
            : Math.round((completedCount / dayData.tasks.length) * 100);

    return (
        <div className="space-y-10 pb-10">
            {/* tasks Section */}
            <section className="space-y-5">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                            <CheckSquare className="h-4 w-4" />
                            Tasks
                        </h3>
                        {dayData.tasks.length > 0 && (
                            <span className="text-xs font-medium text-accent">
                                {progressPercent}% Complete
                            </span>
                        )}
                    </div>

                    {dayData.tasks.length > 0 && (
                        <Progress
                            value={progressPercent}
                            className="h-2 bg-muted/50 transition-all duration-500 [&>div]:bg-accent"
                        />
                    )}
                </div>

                <div className="space-y-2">
                    {dayData.tasks.map((task) =>
                        currentEditTaskID === task.id ? (
                            <form
                                onSubmit={handleEditTask}
                                className="relative mt-2"
                                key={task.description}
                            >
                                <Input
                                    value={currentEditTask}
                                    onChange={(e) =>
                                        setCurrentEditTask(e.target.value)
                                    }
                                    className="h-11 border-none bg-muted/20 pr-12 focus-visible:ring-1 focus-visible:ring-accent"
                                    autoFocus={true}
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={!currentEditTask.trim()}
                                    className="absolute top-1 right-1 bottom-1 h-auto bg-accent text-accent-foreground hover:bg-accent/90"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </form>
                        ) : (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={task.id}
                                className={cn(
                                    'group flex items-center gap-3 rounded-lg border p-3 transition-all',
                                    task.is_finished
                                        ? 'border-transparent bg-muted/30'
                                        : 'border-border bg-card shadow-sm hover:border-accent/30',
                                )}
                            >
                                <button
                                    onClick={() =>
                                        toggleFinishTask(
                                            task.id,
                                            !task.is_finished,
                                        )
                                    }
                                    className="shrink-0 text-muted-foreground transition-colors hover:text-accent focus:outline-none"
                                >
                                    {task.is_finished ? (
                                        <CheckCircle2 className="h-5 w-5 text-accent" />
                                    ) : (
                                        <Circle className="h-5 w-5" />
                                    )}
                                </button>
                                <span
                                    className={cn(
                                        'flex-1 text-sm transition-all',
                                        task.is_finished
                                            ? 'text-muted-foreground line-through opacity-70'
                                            : 'font-medium text-foreground',
                                    )}
                                >
                                    {task.description}
                                </span>

                                <button
                                    onClick={() =>
                                        toggleEditTask(
                                            task.id,
                                            task.description,
                                        )
                                    }
                                    className="shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                                >
                                    <SquarePen className="h-4 w-4" />
                                </button>

                                <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </motion.div>
                        ),
                    )}
                </div>

                {!isAddingTask && !currentEditTaskID && (
                    <Button
                        onClick={() => setIsAddingTask(true)}
                        className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                        <Plus className="h-4 w-4" />
                        Add Task
                    </Button>
                )}

                {/* Add Todo Input */}
                {isAddingTask && (
                    <form onSubmit={handleAddTask} className="relative mt-2">
                        <Input
                            value={newTask}
                            onChange={(e) => setNewTask(e.target.value)}
                            placeholder="What needs to be done?"
                            className="h-11 border-none bg-muted/20 pr-12 focus-visible:ring-1 focus-visible:ring-accent"
                            autoFocus={
                                isAddingTask && dayData.tasks.length === 0
                            }
                        />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={!newTask.trim()}
                            className="absolute top-1 right-1 bottom-1 h-auto bg-accent text-accent-foreground hover:bg-accent/90"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </form>
                )}

                <div className="mt-10">
                    <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                        <AlignLeft className="h-4 w-4" />
                        Notes
                    </h3>
                    <Textarea
                        value={dayData?.notes}
                        onChange={(e) => updateNotes(e.target.value)}
                        placeholder="Write your notes here..."
                        className="mt-2 min-h-[150px] resize-none border-none bg-muted/20 text-base transition-all focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-accent"
                        autoFocus={isAddingNote && !dayData?.notes}
                    />
                </div>
            </section>
        </div>
    );
}

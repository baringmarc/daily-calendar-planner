import type { DayData, Task } from '@/types';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { AlignLeft, CalendarIcon, CheckSquare, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { Input } from './ui/input';

import { useTaskActions } from '@/hooks/useTaskActions';

import { AddTaskDialog } from '@/components/add-task-dialog';

import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableTask } from '@/components/sortable-task';
import { arrayMove } from '@dnd-kit/sortable';

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
    const [notes, setNotes] = useState(dayData?.calendar_day?.note || '');

    const {
        //- task state
        newTask,
        setNewTask,
        isAddingTask,
        setIsAddingTask,
        currentEditTaskID,
        currentEditTask,
        setCurrentEditTask,
        setCurrentEditTaskID,
        // - task actions
        updateNotes,
        handleAddTask,
        handleDeleteTask,
        toggleFinishTask,
        toggleEditTask,
        handleEditTask,
    } = useTaskActions({
        date,
        dayData,
        updateData,
    });

    // - drag logic
    const [activeId, setActiveId] = useState<string | null>(null);

    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id as string);
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const oldIndex = dayData.tasks.findIndex((t) => t.id === active.id);
        const newIndex = dayData.tasks.findIndex((t) => t.id === over.id);

        const newTasks = arrayMove(dayData.tasks, oldIndex, newIndex);

        setActiveId(null);
        updateTaskOrder(newTasks);
    };

    const updateTaskOrder = async (tasks: Task[]) => {
        try {
            const res = await axios.put(`api/tasks/reorder`, {
                tasks: tasks,
            });
            if (res.status !== 200) throw new Error();

            updateData((prev) => ({
                ...prev,
                tasks: tasks,
            }));
        } catch {
            console.error('Failed to reorder tasks');
        }
    };

    // Reset local state when date changes
    useEffect(() => {
        setNewTask('');
        setIsAddingTask(false);
        setCurrentEditTask('');
        setCurrentEditTaskID(null);
    }, [date]);

    const hasContent =
        !!dayData?.calendar_day?.note || dayData.tasks.length > 0;
    const isEditing = isAddingTask || !!currentEditTaskID;

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
                    <p className="mx-auto max-w-62.5 text-sm text-muted-foreground">
                        Take a break, or add some tasks and notes for this day.
                    </p>
                </div>

                <Button
                    onClick={() => setIsAddingTask(true)}
                    className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                    <Plus className="h-4 w-4" />
                    Add Task
                </Button>
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
            <AddTaskDialog
                open={isAddingTask}
                onOpenChange={setIsAddingTask}
                newTask={newTask}
                setNewTask={setNewTask}
                handleAddTask={handleAddTask}
            />
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

                <DndContext
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    collisionDetection={closestCenter}
                >
                    <DragOverlay>
                        {activeId ? (
                            <div className="rounded-lg border bg-card p-3 shadow-lg">
                                {
                                    dayData.tasks.find((t) => t.id === activeId)
                                        ?.description
                                }
                            </div>
                        ) : null}
                    </DragOverlay>

                    <SortableContext
                        items={dayData.tasks.map((task) => task.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2">
                            {dayData.tasks.map((task) => (
                                <SortableTask
                                    key={task.id}
                                    task={task}
                                    actions={{
                                        currentEditTaskID,
                                        currentEditTask,
                                        setCurrentEditTask,
                                        handleDeleteTask,
                                        handleEditTask,
                                        toggleFinishTask,
                                        toggleEditTask,
                                    }}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>

                {!isAddingTask && !currentEditTaskID && (
                    <Button
                        onClick={() => setIsAddingTask(true)}
                        className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                        <Plus className="h-4 w-4" />
                        Add Task
                    </Button>
                )}

                <div className="mt-10">
                    <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                        <AlignLeft className="h-4 w-4" />
                        Notes
                    </h3>
                    <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        onBlur={(e) => updateNotes(e.target.value)}
                        placeholder="Write your notes here..."
                        className="mt-2 min-h-37.5 resize-none border-none bg-muted/20 text-base transition-all focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-accent"
                        // autoFocus={isAddingNote && !dayData?.calendar_day?.note}
                    />
                </div>
            </section>
        </div>
    );
}

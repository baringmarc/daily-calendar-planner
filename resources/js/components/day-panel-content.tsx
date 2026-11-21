import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';

import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';

import { format } from 'date-fns';
import { AlignLeft, CalendarIcon, CheckSquare, Plus } from 'lucide-react';
import { useState } from 'react';
import { SortableTask } from '@/components/sortable-task';
import { TaskFormDialog } from '@/components/task-form-dialog';
import { useTaskActions } from '@/hooks/useTaskActions';
import type { DayData } from '@/types';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Textarea } from './ui/textarea';

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
    const savedNote = dayData?.calendar_day?.note || '';
    const [notes, setNotes] = useState(savedNote);
    const [isNoteDirty, setIsNoteDirty] = useState(false);
    const [prevSavedNote, setPrevSavedNote] = useState(savedNote);

    // Follow the saved note when it changes underneath the panel, e.g. when
    // the day's data finishes loading after the panel opened. Without this
    // the textarea keeps the empty value it mounted with, and blurring it
    // saves '' over the real note (BUG-07). Unsaved edits are kept.
    if (savedNote !== prevSavedNote) {
        setPrevSavedNote(savedNote);

        if (!isNoteDirty) {
            setNotes(savedNote);
        }
    }

    const saveNotes = async () => {
        if (!isNoteDirty) {
            return;
        }

        if (await updateNotes(notes)) {
            setIsNoteDirty(false);
        }
    };

    const {
        taskDialog,
        openAddTask,
        openEditTask,
        closeTaskDialog,
        submitTask,
        isSavingTask,
        taskErrors,
        updateNotes,
        deleteTask,
        toggleFinished,
        reorderTasks,
    } = useTaskActions({
        date,
        dayData,
        updateData,
    });

    // - drag logic
    const [activeId, setActiveId] = useState<number | null>(null);

    function handleDragStart(event: DragStartEvent) {
        setActiveId(Number(event.active.id));
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = dayData.tasks.findIndex((t) => t.id === active.id);
        const newIndex = dayData.tasks.findIndex((t) => t.id === over.id);

        const newTasks = arrayMove(dayData.tasks, oldIndex, newIndex);

        setActiveId(null);
        reorderTasks(newTasks);
    };

    const hasContent =
        !!dayData?.calendar_day?.note || dayData.tasks.length > 0;

    const taskFormDialog = (
        <TaskFormDialog
            open={taskDialog !== null}
            onOpenChange={(open) => !open && closeTaskDialog()}
            task={taskDialog?.task ?? null}
            dateLabel={format(date, 'EEEE, MMMM d')}
            onSubmit={submitTask}
            isSaving={isSavingTask}
            errors={taskErrors}
        />
    );

    // Empty State
    if (!hasContent) {
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
                    onClick={openAddTask}
                    className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                    <Plus className="h-4 w-4" />
                    Add Task
                </Button>

                {taskFormDialog}
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
            {taskFormDialog}

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
                                    onToggleFinished={toggleFinished}
                                    onEdit={openEditTask}
                                    onDelete={deleteTask}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>

                <Button
                    onClick={openAddTask}
                    className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                    <Plus className="h-4 w-4" />
                    Add Task
                </Button>

                <div className="mt-10">
                    <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                        <AlignLeft className="h-4 w-4" />
                        Notes
                    </h3>
                    <Textarea
                        value={notes}
                        onChange={(e) => {
                            setNotes(e.target.value);
                            setIsNoteDirty(true);
                        }}
                        onBlur={saveNotes}
                        placeholder="Write your notes here..."
                        className="mt-2 min-h-37.5 resize-none border-none bg-muted/20 text-base transition-all focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-accent"
                        // autoFocus={isAddingNote && !dayData?.calendar_day?.note}
                    />
                </div>
            </section>
        </div>
    );
}

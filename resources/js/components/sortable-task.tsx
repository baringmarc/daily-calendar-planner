import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    CheckCircle2,
    Circle,
    Plus,
    Trash2,
    SquarePen,
    Logs,
} from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

import type { Task, TaskActions } from '@/types';

export function SortableTask({
    task,
    actions,
}: {
    task: Task;
    actions: {
        currentEditTaskID: string | null;
        currentEditTask: string;
        setCurrentEditTask: (value: string) => void;
        handleDeleteTask: (id: string) => Promise<void>;
        toggleFinishTask: (id: string, is_finished: boolean) => Promise<void>;
        toggleEditTask: (id: string, description: string) => void;
        handleEditTask: (e: React.FormEvent) => Promise<void>;
    };
}) {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const {
        //- task state
        currentEditTaskID,
        currentEditTask,
        setCurrentEditTask,
        handleDeleteTask,
        handleEditTask,
        toggleFinishTask,
        toggleEditTask,
    } = actions;

    // - edit task mode
    if (currentEditTaskID === task.id) {
        return (
            <form
                onSubmit={handleEditTask}
                className="relative mt-2"
                key={task.description}
            >
                <Input
                    value={currentEditTask}
                    onChange={(e) => setCurrentEditTask(e.target.value)}
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
        );
    }

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
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
                onClick={() => toggleFinishTask(task.id, !task.is_finished)}
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
                onClick={() => toggleEditTask(task.id, task.description)}
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

            <button
                {...attributes}
                {...listeners}
                className="active:cursor:grabbing shrink-0 cursor-grab text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
            >
                <Logs className="h-4 w-4" />
            </button>
        </motion.div>
    );
}

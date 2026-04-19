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

import type { Task } from '@/types';
import { PRIORITY_MAP, PRIORITY_STYLES } from '@/constants/priority';

export function SortableTask({
    task,
    actions,
}: {
    task: Task;
    actions: {
        currentEditTask: Task | null;
        setCurrentEditTask: React.Dispatch<React.SetStateAction<Task | null>>;
        handleDeleteTask: (id: string) => Promise<void>;
        toggleFinishTask: (id: string, is_finished: boolean) => Promise<void>;
        toggleEditTask: (task: Task) => void;
    };
}) {
    const priorityStyle = PRIORITY_STYLES[task.priority];

    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const {
        //- task state
        handleDeleteTask,
        toggleFinishTask,
        toggleEditTask,
    } = actions;

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={task.id}
            className={cn(
                'group flex items-center gap-3 rounded-lg border border-l-4 p-3 transition-all',
                task.is_finished
                    ? 'border-transparent bg-muted/70'
                    : cn(
                          'border-border bg-card shadow-sm hover:border-accent/70',
                          priorityStyle.card,
                      ),
            )}
        >
            <span
                className={cn(
                    'w-16 rounded-full px-2 py-0.5 text-center text-xs font-medium',
                    priorityStyle.badge,
                )}
            >
                {PRIORITY_MAP[task.priority].label}
            </span>
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
                onClick={() => toggleEditTask(task)}
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

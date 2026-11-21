import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Trash2, SquarePen, Logs } from 'lucide-react';
import { PRIORITY_MAP, PRIORITY_STYLES } from '@/constants/priority';
import { cn } from '@/lib/utils';

import type { Task } from '@/types';

// Edit, delete and the drag handle. With a mouse they appear on hover or
// focus; on touch screens, which can't hover, they are always shown.
const ROW_ACTION =
    'shrink-0 rounded-md p-1 text-muted-foreground transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100';

export function SortableTask({
    task,
    onToggleFinished,
    onEdit,
    onDelete,
}: {
    task: Task;
    onToggleFinished: (task: Task) => void;
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
}) {
    const priorityStyle = PRIORITY_STYLES[task.priority];

    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={task.id}
            className={cn(
                'group flex items-center gap-2 rounded-lg border border-l-4 p-2.5 transition-all sm:gap-3 sm:p-3',
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
                    'w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium',
                    priorityStyle.badge,
                )}
            >
                {PRIORITY_MAP[task.priority].label}
            </span>
            <button
                type="button"
                role="checkbox"
                aria-checked={task.is_finished}
                aria-label={`Done: ${task.description}`}
                onClick={() => onToggleFinished(task)}
                className="shrink-0 rounded-full text-muted-foreground transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
                {task.is_finished ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                    <Circle className="h-5 w-5" />
                )}
            </button>
            <span
                className={cn(
                    'min-w-0 flex-1 text-sm break-words transition-all',
                    task.is_finished
                        ? 'text-muted-foreground line-through opacity-70'
                        : 'font-medium text-foreground',
                )}
            >
                {task.description}
            </span>

            <button
                type="button"
                aria-label={`Edit: ${task.description}`}
                onClick={() => onEdit(task)}
                className={cn(ROW_ACTION, 'hover:text-foreground')}
            >
                <SquarePen className="h-4 w-4" />
            </button>

            <button
                type="button"
                aria-label={`Delete: ${task.description}`}
                onClick={() => onDelete(task)}
                className={cn(ROW_ACTION, 'hover:text-destructive')}
            >
                <Trash2 className="h-4 w-4" />
            </button>

            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={`Reorder: ${task.description}`}
                className={cn(
                    ROW_ACTION,
                    // touch-none: a touch on the handle drags the task
                    // instead of scrolling the page.
                    'cursor-grab touch-none hover:text-foreground active:cursor-grabbing',
                )}
            >
                <Logs className="h-4 w-4" />
            </button>
        </motion.div>
    );
}

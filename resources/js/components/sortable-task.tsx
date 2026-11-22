import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { addDays, format } from 'date-fns';
import { motion } from 'framer-motion';
import {
    CalendarClock,
    CheckCircle2,
    Circle,
    Trash2,
    SquarePen,
    Logs,
    Repeat,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PRIORITY_MAP, PRIORITY_STYLES } from '@/constants/priority';
import { describeRecurrence } from '@/constants/recurrence';
import { isToday, isTomorrow, today } from '@/lib/clock';
import { cn } from '@/lib/utils';

import type { Task } from '@/types';

// Edit, delete and the drag handle. With a mouse they appear on hover or
// focus; on touch screens, which can't hover, they are always shown.
// An open menu keeps its trigger visible.
const ROW_ACTION =
    'shrink-0 rounded-md p-1 text-muted-foreground transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100 data-[state=open]:opacity-100';

const ymd = (date: Date) => format(date, 'yyyy-MM-dd');

export function SortableTask({
    task,
    date,
    onToggleFinished,
    onEdit,
    onDelete,
    onMove,
    onPickMoveDate,
    canReorder = true,
}: {
    task: Task;
    // The day the task is on.
    date: Date;
    onToggleFinished: (task: Task) => void;
    onEdit: (task: Task) => void;
    onDelete: (task: Task) => void;
    // `to` is yyyy-MM-dd.
    onMove: (task: Task, to: string) => void;
    // Opens the date picker for "Pick a date…".
    onPickMoveDate: (task: Task) => void;
    // False while the list is sorted (FEAT-05): only "My order" can be
    // dragged into a new order.
    canReorder?: boolean;
}) {
    const priorityStyle = PRIORITY_STYLES[task.priority];

    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: task.id, disabled: !canReorder });

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
                {task.recurrence && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted-foreground">
                        <Repeat aria-hidden="true" className="h-3 w-3" />
                        {describeRecurrence(task.recurrence)}
                    </span>
                )}
            </span>

            <button
                type="button"
                aria-label={`Edit: ${task.description}`}
                onClick={() => onEdit(task)}
                className={cn(ROW_ACTION, 'hover:text-foreground')}
            >
                <SquarePen className="h-4 w-4" />
            </button>

            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label={`Move: ${task.description}`}
                    className={cn(ROW_ACTION, 'hover:text-foreground')}
                >
                    <CalendarClock className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Move to</DropdownMenuLabel>
                    {!isToday(date) && (
                        <DropdownMenuItem
                            onSelect={() => onMove(task, ymd(today()))}
                        >
                            Today
                        </DropdownMenuItem>
                    )}
                    {!isTomorrow(date) && (
                        <DropdownMenuItem
                            onSelect={() =>
                                onMove(task, ymd(addDays(today(), 1)))
                            }
                        >
                            Tomorrow
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onPickMoveDate(task)}>
                        Pick a date…
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <button
                type="button"
                aria-label={`Delete: ${task.description}`}
                onClick={() => onDelete(task)}
                className={cn(ROW_ACTION, 'hover:text-destructive')}
            >
                <Trash2 className="h-4 w-4" />
            </button>

            {canReorder && (
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
            )}
        </motion.div>
    );
}

import type {
    DndContextProps,
    DragEndEvent,
    KeyboardCoordinateGetter,
    UniqueIdentifier,
} from '@dnd-kit/core';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    rectIntersection,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { format, isToday, parseISO } from 'date-fns';
import { CheckCircle2, Circle, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { PRIORITY_MAP, PRIORITY_STYLES } from '@/constants/priority';
import { dayKey } from '@/hooks/use-calendar';
import { cn } from '@/lib/utils';
import type { CalendarData, Task } from '@/types';

// What the drag carries: the task and the day (yyyy-MM-dd) it's on.
type DragData = { task: Task; date: string };

const dayLabel = (date: string) => format(parseISO(date), 'EEEE, MMMM d');

const KEY_STEPS: Record<string, number> = {
    ArrowLeft: -1,
    ArrowUp: -1,
    ArrowRight: 1,
    ArrowDown: 1,
};

// With the keyboard, each arrow key moves the picked-up task one whole day
// (the default moves it 25px). `dates` are the week's days in order.
function dayStepCoordinates(dates: string[]): KeyboardCoordinateGetter {
    return (event, { context, currentCoordinates }) => {
        const step = KEY_STEPS[event.code];

        if (step === undefined) {
            return undefined;
        }

        event.preventDefault();

        const from =
            context.over?.id ??
            (context.active?.data.current as DragData | undefined)?.date;
        const index = dates.indexOf(String(from)) + step;
        const target = context.droppableRects.get(dates[index]);

        if (!target || !context.collisionRect) {
            return currentCoordinates;
        }

        // Inside the target day, near its top, so it's the day it overlaps
        // most.
        return {
            x:
                target.left +
                Math.max(0, (target.width - context.collisionRect.width) / 2),
            y: target.top + 8,
        };
    };
}

/**
 * Seven days side by side (stacked on smaller screens) with every task
 * (FEAT-10). Tasks can be checked off, and dragged by their handle onto
 * another day to move them there (FEAT-02).
 */
export function WeekView({
    days,
    calendar,
    onSelectDay,
    onToggleFinished,
    onMoveTask,
}: {
    // The week's seven days, from the configured week start.
    days: Date[];
    calendar: CalendarData;
    onSelectDay: (day: Date) => void;
    onToggleFinished: (task: Task) => void;
    // `to` is yyyy-MM-dd.
    onMoveTask: (task: Task, to: string) => void;
}) {
    const [dragged, setDragged] = useState<Task | null>(null);

    // A few pixels of movement start a drag, so tapping the handle doesn't.
    // The keyboard picks a task up with Space or Enter.
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: dayStepCoordinates(days.map(dayKey)),
        }),
    );

    const describe = (id: UniqueIdentifier) =>
        days
            .flatMap((day) => calendar[dayKey(day)]?.tasks ?? [])
            .find((t) => t.id === id)?.description ?? 'Task';
    const accessibility: DndContextProps['accessibility'] = {
        screenReaderInstructions: {
            draggable:
                'To move this task to another day, press Space or Enter to pick it up, move it a day at a time with the arrow keys, and press Space or Enter again to drop it. Press Escape to cancel. The Move menu in the day view does the same.',
        },
        announcements: {
            onDragStart: ({ active }) => `Picked up ${describe(active.id)}.`,
            onDragOver: ({ active, over }) =>
                over
                    ? `${describe(active.id)} is over ${dayLabel(String(over.id))}.`
                    : `${describe(active.id)} is not over a day.`,
            onDragEnd: ({ active, over }) =>
                over
                    ? `${describe(active.id)} dropped on ${dayLabel(String(over.id))}.`
                    : `${describe(active.id)} dropped back in place.`,
            onDragCancel: ({ active }) =>
                `Move cancelled. ${describe(active.id)} is back in place.`,
        },
    };

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        setDragged(null);

        const data = active.data.current as DragData | undefined;

        if (data && over && over.id !== data.date) {
            onMoveTask(data.task, String(over.id));
        }
    };

    return (
        <DndContext
            sensors={sensors}
            accessibility={accessibility}
            collisionDetection={rectIntersection}
            onDragStart={({ active }) =>
                setDragged((active.data.current as DragData).task)
            }
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragged(null)}
        >
            <div className="grid flex-1 grid-cols-1 overflow-y-auto bg-muted/10 lg:grid-cols-7 lg:divide-x lg:divide-border">
                {days.map((day) => (
                    <WeekDay
                        key={dayKey(day)}
                        day={day}
                        tasks={calendar[dayKey(day)]?.tasks ?? []}
                        onSelect={() => onSelectDay(day)}
                        onToggleFinished={onToggleFinished}
                    />
                ))}
            </div>

            <DragOverlay>
                {dragged && (
                    <div className="rounded-md border bg-card p-2 text-sm font-medium shadow-lg">
                        {dragged.description}
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}

function WeekDay({
    day,
    tasks,
    onSelect,
    onToggleFinished,
}: {
    day: Date;
    tasks: Task[];
    onSelect: () => void;
    onToggleFinished: (task: Task) => void;
}) {
    const date = dayKey(day);
    const today = isToday(day);
    const { setNodeRef, isOver } = useDroppable({ id: date });
    const doneCount = tasks.filter((t) => t.is_finished).length;

    return (
        <section
            ref={setNodeRef}
            aria-label={format(day, 'EEEE, MMMM d')}
            className={cn(
                'flex min-h-28 flex-col gap-2 border-b border-border bg-card p-2 transition-colors lg:min-h-0 lg:border-b-0',
                isOver && 'bg-primary/5 ring-2 ring-primary/40 ring-inset',
            )}
        >
            <button
                type="button"
                onClick={onSelect}
                aria-current={today ? 'date' : undefined}
                aria-label={`Open ${format(day, 'EEEE, MMMM d')}${today ? ', today' : ''}`}
                className="flex items-center justify-between gap-2 rounded-md px-1 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
                <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {format(day, 'EEE')}
                    </span>
                    <span
                        className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium',
                            today && 'bg-primary text-primary-foreground',
                        )}
                    >
                        {format(day, 'd')}
                    </span>
                </span>
                {tasks.length > 0 && (
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                        {doneCount}/{tasks.length}
                    </span>
                )}
            </button>

            {tasks.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground/70">
                    No tasks
                </p>
            ) : (
                <ul className="space-y-1.5">
                    {tasks.map((task) => (
                        <WeekTask
                            key={task.id}
                            task={task}
                            date={date}
                            onToggleFinished={onToggleFinished}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function WeekTask({
    task,
    date,
    onToggleFinished,
}: {
    task: Task;
    date: string;
    onToggleFinished: (task: Task) => void;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: task.id,
        data: { task, date } satisfies DragData,
    });
    const style = PRIORITY_STYLES[task.priority];

    return (
        <li
            ref={setNodeRef}
            className={cn(
                'group flex items-start gap-1.5 rounded-md border border-l-4 p-1.5 text-sm',
                task.is_finished
                    ? 'border-transparent bg-muted/70'
                    : cn('border-border bg-card shadow-xs', style.card),
                isDragging && 'opacity-40',
            )}
        >
            <button
                type="button"
                role="checkbox"
                aria-checked={task.is_finished}
                aria-label={`Done: ${task.description}`}
                onClick={() => onToggleFinished(task)}
                className="mt-0.5 shrink-0 rounded-full text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
                {task.is_finished ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                    <Circle className="h-4 w-4" />
                )}
            </button>
            <span className="min-w-0 flex-1">
                <span
                    className={cn(
                        'block break-words',
                        task.is_finished
                            ? 'text-muted-foreground line-through opacity-70'
                            : 'font-medium',
                    )}
                >
                    {task.description}
                </span>
                {!task.is_finished && (
                    <span
                        className={cn(
                            'mt-1 inline-block rounded-full px-1.5 text-[10px] font-medium',
                            style.badge,
                        )}
                    >
                        {PRIORITY_MAP[task.priority].label}
                    </span>
                )}
            </span>
            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={`Move to another day: ${task.description}`}
                // touch-none: a touch on the handle drags the task instead
                // of scrolling the page.
                className="shrink-0 cursor-grab touch-none rounded-md p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100"
            >
                <GripVertical className="h-4 w-4" />
            </button>
        </li>
    );
}

import { eachDayOfInterval, endOfMonth, format, isToday } from 'date-fns';
import {
    CalendarIcon,
    CheckCircle2,
    ChevronRight,
    Circle,
    StickyNote,
} from 'lucide-react';
import { useMemo } from 'react';
import { PRIORITY_MAP, PRIORITY_STYLES } from '@/constants/priority';
import { dayKey } from '@/hooks/use-calendar';
import { cn } from '@/lib/utils';
import type { CalendarData, Task } from '@/types';

/**
 * The month as a list (FEAT-10): every day that has tasks or a note, plus
 * today, in date order. Tasks can be checked off here, and a day's heading
 * opens its day view.
 */
export function AgendaView({
    monthStart,
    calendar,
    onSelectDay,
    onToggleFinished,
}: {
    monthStart: Date;
    calendar: CalendarData;
    onSelectDay: (day: Date) => void;
    onToggleFinished: (task: Task) => void;
}) {
    const monthDays = useMemo(
        () =>
            eachDayOfInterval({
                start: monthStart,
                end: endOfMonth(monthStart),
            }),
        [monthStart],
    );

    const shownDays = monthDays.filter((day) => {
        const data = calendar[dayKey(day)];

        return (
            isToday(day) || !!data?.tasks.length || !!data?.calendar_day.note
        );
    });

    if (shownDays.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                    <CalendarIcon className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <p className="text-lg font-semibold">
                    Nothing planned in {format(monthStart, 'MMMM')}
                </p>
                <p className="max-w-72 text-sm text-muted-foreground">
                    Open a day from the month or week view to add tasks or a
                    note.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-muted/10 p-3 sm:p-6">
            <ol
                aria-label={`${format(monthStart, 'MMMM yyyy')} agenda`}
                className="mx-auto max-w-3xl space-y-4"
            >
                {shownDays.map((day) => (
                    <AgendaDay
                        key={dayKey(day)}
                        day={day}
                        tasks={calendar[dayKey(day)]?.tasks ?? []}
                        note={calendar[dayKey(day)]?.calendar_day.note ?? null}
                        onSelect={() => onSelectDay(day)}
                        onToggleFinished={onToggleFinished}
                    />
                ))}
            </ol>
        </div>
    );
}

function AgendaDay({
    day,
    tasks,
    note,
    onSelect,
    onToggleFinished,
}: {
    day: Date;
    tasks: Task[];
    note: string | null;
    onSelect: () => void;
    onToggleFinished: (task: Task) => void;
}) {
    const today = isToday(day);
    const doneCount = tasks.filter((t) => t.is_finished).length;

    return (
        <li
            aria-current={today ? 'date' : undefined}
            className={cn(
                'rounded-lg border bg-card shadow-xs',
                today && 'border-primary/50',
            )}
        >
            <h2>
                <button
                    type="button"
                    onClick={onSelect}
                    className="flex w-full items-center justify-between gap-3 rounded-t-lg px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <span className="flex items-center gap-2">
                        <span className="font-semibold">
                            {format(day, 'EEE, MMM d')}
                        </span>
                        {today && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                                Today
                            </span>
                        )}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {tasks.length > 0 && (
                            <span className="tabular-nums">
                                {doneCount}/{tasks.length} done
                            </span>
                        )}
                        <ChevronRight className="h-4 w-4" />
                    </span>
                </button>
            </h2>

            <div className="space-y-2 border-t px-4 py-3">
                {tasks.length === 0 && !note && (
                    <p className="text-sm text-muted-foreground">
                        Nothing planned yet.
                    </p>
                )}

                {tasks.length > 0 && (
                    <ul className="space-y-1.5">
                        {tasks.map((task) => (
                            <li
                                key={task.id}
                                className="flex items-center gap-2 text-sm"
                            >
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={task.is_finished}
                                    aria-label={`Done: ${task.description}`}
                                    onClick={() => onToggleFinished(task)}
                                    className="shrink-0 rounded-full text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {task.is_finished ? (
                                        <CheckCircle2 className="h-5 w-5 text-primary" />
                                    ) : (
                                        <Circle className="h-5 w-5" />
                                    )}
                                </button>
                                <span
                                    className={cn(
                                        'w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium',
                                        PRIORITY_STYLES[task.priority].badge,
                                    )}
                                >
                                    {PRIORITY_MAP[task.priority].label}
                                </span>
                                <span
                                    className={cn(
                                        'min-w-0 flex-1 break-words',
                                        task.is_finished &&
                                            'text-muted-foreground line-through opacity-70',
                                    )}
                                >
                                    {task.description}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {note && (
                    <p className="flex gap-2 text-sm text-muted-foreground">
                        <StickyNote
                            aria-label="Note"
                            className="mt-0.5 h-4 w-4 shrink-0"
                        />
                        <span className="line-clamp-2 whitespace-pre-line">
                            {note}
                        </span>
                    </p>
                )}
            </div>
        </li>
    );
}

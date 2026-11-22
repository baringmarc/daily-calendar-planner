import { format } from 'date-fns';
import { CheckCheck, CheckSquare, Square, StickyNote } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { isToday } from '@/lib/clock';
import { cn } from '@/lib/utils';
import type { DayData } from '@/types';

// How many tasks a cell previews before it stops listing them.
const PREVIEW_TASKS = 3;
// How many dots the compact cell on a phone shows.
const PHONE_DOTS = 4;

export function DayCell({
    day,
    data,
    isCurrentMonth,
    isFocusTarget,
    onSelect,
}: {
    day: Date;
    data: DayData | undefined;
    isCurrentMonth: boolean;
    // The one cell reached with Tab; arrow keys move between the others.
    isFocusTarget: boolean;
    onSelect: (day: Date) => void;
}) {
    const tasks = data?.tasks ?? [];
    const hasNotes = !!data?.calendar_day.note;
    const hasTasks = tasks.length > 0;
    const doneCount = tasks.filter((t) => t.is_finished).length;
    const allDone = hasTasks && doneCount === tasks.length;
    const hiddenCount = tasks.length - PREVIEW_TASKS;
    const today = isToday(day);

    // The visible content is a summary for sighted users. Screen readers
    // get it as one sentence instead.
    const label = [
        format(day, 'EEEE, MMMM d, yyyy'),
        today && 'today',
        allDone
            ? `all ${tasks.length} tasks done`
            : hasTasks && `${doneCount} of ${tasks.length} tasks done`,
        hasNotes && 'has a note',
    ]
        .filter(Boolean)
        .join(', ');

    return (
        <button
            type="button"
            data-day={format(day, 'yyyy-MM-dd')}
            tabIndex={isFocusTarget ? 0 : -1}
            aria-label={label}
            aria-current={today ? 'date' : undefined}
            onClick={() => onSelect(day)}
            className={cn(
                'group relative flex cursor-pointer flex-col items-stretch border-r border-b border-border p-1 text-left transition-all outline-none hover:bg-card/80 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:p-2',
                isCurrentMonth
                    ? 'bg-card'
                    : 'bg-muted/30 text-muted-foreground',
                // A finished day steps back, so the days with work left
                // stand out.
                allDone && 'bg-primary/5',
            )}
        >
            <div
                aria-hidden="true"
                className="flex flex-col items-center gap-1 sm:flex-row sm:items-start sm:justify-between"
            >
                <span
                    className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors',
                        today
                            ? 'bg-primary text-primary-foreground'
                            : 'group-hover:bg-muted',
                    )}
                >
                    {format(day, 'd')}
                </span>

                {/* Phones: a dot per task, filled until it's done */}
                {(hasTasks || hasNotes) && (
                    <div className="flex max-w-full flex-wrap items-center justify-center gap-0.5 sm:hidden">
                        {hasNotes && (
                            <StickyNote className="h-2.5 w-2.5 text-muted-foreground" />
                        )}
                        {tasks.slice(0, PHONE_DOTS).map((task) => (
                            <span
                                key={task.id}
                                className={cn(
                                    'h-1.5 w-1.5 rounded-full',
                                    task.is_finished
                                        ? 'bg-muted-foreground/30'
                                        : 'bg-primary',
                                )}
                            />
                        ))}
                        {tasks.length > PHONE_DOTS && (
                            <span className="text-[9px] leading-none text-muted-foreground">
                                +
                            </span>
                        )}
                    </div>
                )}

                {(hasTasks || hasNotes) && (
                    <div className="hidden space-y-1 sm:block">
                        <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold text-muted-foreground">
                            {hasNotes && <StickyNote className="h-3 w-3" />}
                            {allDone ? (
                                <>
                                    <CheckCheck className="h-3 w-3 text-primary" />
                                    <span className="text-primary">
                                        All done
                                    </span>
                                </>
                            ) : (
                                hasTasks && (
                                    <>
                                        <CheckSquare className="h-3 w-3 text-primary" />
                                        <span>
                                            {doneCount}/{tasks.length}
                                        </span>
                                    </>
                                )
                            )}
                        </div>
                        {hasTasks && (
                            <Progress
                                value={(doneCount / tasks.length) * 100}
                                className="h-1.5 rounded-full bg-primary/20 [&>div]:bg-primary"
                            />
                        )}
                    </div>
                )}
            </div>

            <div
                aria-hidden="true"
                className="mt-2.5 hidden w-full flex-col space-y-2 px-1 sm:flex"
            >
                {tasks.slice(0, PREVIEW_TASKS).map((task) => (
                    <div
                        key={task.id}
                        className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground"
                    >
                        {task.is_finished ? (
                            <CheckSquare className="h-3 w-3 shrink-0" />
                        ) : (
                            <Square className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span
                            className={cn(
                                'truncate opacity-80',
                                task.is_finished && 'line-through opacity-60',
                            )}
                        >
                            {task.description}
                        </span>
                    </div>
                ))}

                {hiddenCount > 0 && (
                    <div className="text-[11px] font-medium text-muted-foreground">
                        +{hiddenCount} more
                    </div>
                )}

                {!hasTasks && !hasNotes && !isCurrentMonth && (
                    <div className="text-[11px] text-muted-foreground opacity-50">
                        -
                    </div>
                )}
            </div>
        </button>
    );
}

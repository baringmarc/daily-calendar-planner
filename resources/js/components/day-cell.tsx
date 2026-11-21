import { format, isToday } from 'date-fns';
import { CheckSquare, Square } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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
    onSelect,
}: {
    day: Date;
    data: DayData | undefined;
    isCurrentMonth: boolean;
    onSelect: (day: Date) => void;
}) {
    const tasks = data?.tasks ?? [];
    const hasNotes = !!data?.calendar_day.note;
    const hasTasks = tasks.length > 0;
    const doneCount = tasks.filter((t) => t.is_finished).length;

    return (
        <div
            onClick={() => onSelect(day)}
            className={cn(
                'group relative cursor-pointer border-r border-b border-border p-1 transition-all hover:bg-card/80 sm:p-2',
                isCurrentMonth
                    ? 'bg-card'
                    : 'bg-muted/30 text-muted-foreground',
            )}
        >
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-start sm:justify-between">
                <span
                    className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors',
                        isToday(day)
                            ? 'bg-accent text-accent-foreground'
                            : 'group-hover:bg-muted',
                    )}
                >
                    {format(day, 'd')}
                </span>

                {/* Phones: a dot per task, filled until it's done */}
                {hasTasks && (
                    <div
                        className="flex max-w-full flex-wrap justify-center gap-0.5 sm:hidden"
                        aria-hidden="true"
                    >
                        {tasks.slice(0, PHONE_DOTS).map((task) => (
                            <span
                                key={task.id}
                                className={cn(
                                    'h-1.5 w-1.5 rounded-full',
                                    task.is_finished
                                        ? 'bg-muted-foreground/30'
                                        : 'bg-accent',
                                )}
                            />
                        ))}
                    </div>
                )}

                {hasTasks && (
                    <div className="hidden space-y-1 sm:block">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-accent opacity-90">
                            <CheckSquare className="h-3 w-3" />
                            <span>
                                {doneCount}/{tasks.length}
                            </span>
                        </div>
                        <Progress
                            value={(doneCount / tasks.length) * 100}
                            className="h-1.5 rounded-full bg-accent/20 [&>div]:bg-accent"
                        />
                    </div>
                )}
            </div>

            <div className="mt-2.5 hidden w-full flex-col space-y-2 px-1 sm:flex">
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
                        <span className="truncate opacity-80">
                            {task.description}
                        </span>
                    </div>
                ))}

                {!hasTasks && !hasNotes && !isCurrentMonth && (
                    <div className="text-[11px] text-muted-foreground opacity-50">
                        -
                    </div>
                )}
            </div>
        </div>
    );
}

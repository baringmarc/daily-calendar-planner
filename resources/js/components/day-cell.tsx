import { format, isToday } from 'date-fns';
import { CheckSquare, Square } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { DayData } from '@/types';

// How many tasks a cell previews before it stops listing them.
const PREVIEW_TASKS = 3;

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
                'group relative cursor-pointer border-r border-b border-border p-2 transition-all hover:bg-card/80',
                isCurrentMonth
                    ? 'bg-card'
                    : 'bg-muted/30 text-muted-foreground',
            )}
        >
            <div className="flex items-start justify-between">
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

                {hasTasks && (
                    <div className="space-y-1">
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

            <div className="mt-2.5 flex w-full flex-col space-y-2 px-1">
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

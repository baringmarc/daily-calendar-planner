import { format, isSameMonth } from 'date-fns';
import { DayCell } from '@/components/day-cell';
import { dayKey } from '@/hooks/use-calendar';
import type { CalendarData } from '@/types';

export function MonthGrid({
    days,
    monthStart,
    calendar,
    onSelectDay,
}: {
    // Whole weeks, starting on the configured first day of the week.
    days: Date[];
    monthStart: Date;
    calendar: CalendarData;
    onSelectDay: (day: Date) => void;
}) {
    const weekDays = days.slice(0, 7).map((day) => format(day, 'EEE'));

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-muted/10">
            {/* Weekday headers */}
            <div className="grid shrink-0 grid-cols-7 border-b border-border bg-card">
                {weekDays.map((day) => (
                    <div
                        key={day}
                        className="py-3 text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Days */}
            <div
                className="grid flex-1 grid-cols-7 overflow-y-auto"
                style={{
                    // 4, 5 or 6 weeks depending on the month
                    gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))`,
                }}
            >
                {days.map((day) => (
                    <DayCell
                        key={day.toString()}
                        day={day}
                        data={calendar[dayKey(day)]}
                        isCurrentMonth={isSameMonth(day, monthStart)}
                        onSelect={onSelectDay}
                    />
                ))}
            </div>
        </div>
    );
}

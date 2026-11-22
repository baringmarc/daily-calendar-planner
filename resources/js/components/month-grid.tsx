import { format, isSameMonth } from 'date-fns';
import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { DayCell } from '@/components/day-cell';
import { dayKey } from '@/hooks/use-calendar';
import { isToday } from '@/lib/clock';
import type { CalendarData } from '@/types';

// How far each key moves the focus through the grid, in days.
const KEY_STEPS: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
};

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
    const gridRef = useRef<HTMLDivElement>(null);

    // Roving focus: only one cell is in the tab order. It starts on today
    // (or the 1st when today isn't on screen) and follows the arrow keys.
    const [focusedKey, setFocusedKey] = useState<string | null>(null);
    const keys = days.map(dayKey);
    const todayIndex = days.findIndex((day) => isToday(day));
    const focusIndex = Math.max(
        0,
        focusedKey && keys.includes(focusedKey)
            ? keys.indexOf(focusedKey)
            : todayIndex !== -1
              ? todayIndex
              : keys.indexOf(dayKey(monthStart)),
    );

    const moveFocus = (index: number) => {
        const key = keys[Math.min(Math.max(index, 0), keys.length - 1)];

        setFocusedKey(key);
        gridRef.current
            ?.querySelector<HTMLElement>(`[data-day="${key}"]`)
            ?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        const weekStart = focusIndex - (focusIndex % 7);

        if (event.key in KEY_STEPS) {
            moveFocus(focusIndex + KEY_STEPS[event.key]);
        } else if (event.key === 'Home') {
            moveFocus(weekStart);
        } else if (event.key === 'End') {
            moveFocus(weekStart + 6);
        } else {
            return;
        }

        event.preventDefault();
    };

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-muted/10">
            {/* Weekday headers */}
            <div
                aria-hidden="true"
                className="grid shrink-0 grid-cols-7 border-b border-border bg-card"
            >
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
                ref={gridRef}
                role="group"
                aria-label={format(monthStart, 'MMMM yyyy')}
                onKeyDown={handleKeyDown}
                className="grid flex-1 grid-cols-7 overflow-y-auto"
                style={{
                    // 4, 5 or 6 weeks depending on the month. Rows share the
                    // height, but on a short screen they keep 4rem and the
                    // grid scrolls.
                    gridTemplateRows: `repeat(${days.length / 7}, minmax(4rem, 1fr))`,
                }}
            >
                {days.map((day, i) => (
                    <DayCell
                        key={day.toString()}
                        day={day}
                        data={calendar[dayKey(day)]}
                        isCurrentMonth={isSameMonth(day, monthStart)}
                        isFocusTarget={i === focusIndex}
                        onSelect={(selected) => {
                            setFocusedKey(dayKey(selected));
                            onSelectDay(selected);
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

import { addDays, format, isSameMonth, isSameYear, setMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CalendarView } from '@/types';

const VIEWS: { value: CalendarView; label: string }[] = [
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' },
    { value: 'agenda', label: 'Agenda' },
];

// "Nov 16 – 22, 2026", "Nov 30 – Dec 6, 2026" or "Dec 28, 2026 – Jan 3, 2027".
function weekTitle(weekStart: Date): string {
    const weekEnd = addDays(weekStart, 6);

    if (!isSameYear(weekStart, weekEnd)) {
        return `${format(weekStart, 'MMM d, yyyy')} – ${format(weekEnd, 'MMM d, yyyy')}`;
    }

    return isSameMonth(weekStart, weekEnd)
        ? `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd, yyyy')}`
        : `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

// The year picker lists this many years either side of the real current
// year. It stays put while you navigate (UX-11).
const YEARS_AROUND = 10;

function yearOptions(shownYear: number): number[] {
    const thisYear = new Date().getFullYear();
    const years = Array.from(
        { length: YEARS_AROUND * 2 + 1 },
        (_, i) => thisYear - YEARS_AROUND + i,
    );

    // A month further out (by paging, or from a URL) is still selectable.
    if (!years.includes(shownYear)) {
        years.push(shownYear);
        years.sort((a, b) => a - b);
    }

    return years;
}

export function CalendarHeader({
    view,
    onViewChange,
    currentDate,
    weekStart,
    onPrev,
    onNext,
    onToday,
    onMonthSelect,
    onYearSelect,
}: {
    view: CalendarView;
    onViewChange: (view: CalendarView) => void;
    // The first of the month shown by the month and agenda views.
    currentDate: Date;
    // The first day of the week shown by the week view.
    weekStart: Date;
    // A month back or forward, or a week in the week view.
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    onMonthSelect: (month: number) => void;
    onYearSelect: (year: number) => void;
}) {
    const unit = view === 'week' ? 'week' : 'month';
    const years = yearOptions(currentDate.getFullYear());

    return (
        <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={onPrev}
                        aria-label={`Previous ${unit}`}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={onNext}
                        aria-label={`Next ${unit}`}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
                <Button variant="outline" className="h-10" onClick={onToday}>
                    Today
                </Button>
            </div>

            <ToggleGroup
                type="single"
                variant="outline"
                value={view}
                // Clicking the selected view again would deselect it.
                onValueChange={(value) =>
                    value && onViewChange(value as CalendarView)
                }
                aria-label="Calendar view"
                className="order-last w-full sm:order-none sm:w-auto"
            >
                {VIEWS.map(({ value, label }) => (
                    <ToggleGroupItem
                        key={value}
                        value={value}
                        // The selected view uses the primary colour (white on
                        // the accent colour is too faint) and keeps it on
                        // hover. Hovering another view only tints it, so it
                        // never looks selected.
                        className="h-10 flex-1 px-3 data-[state=off]:hover:bg-muted data-[state=off]:hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground sm:flex-none"
                    >
                        {label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>

            {view === 'week' ? (
                <h1 className="px-2 text-base font-medium sm:text-lg">
                    {weekTitle(weekStart)}
                </h1>
            ) : (
                <div className="flex items-center gap-1 sm:gap-3">
                    <Select
                        value={currentDate.getMonth().toString()}
                        onValueChange={(value) =>
                            onMonthSelect(parseInt(value))
                        }
                    >
                        <SelectTrigger
                            aria-label="Month"
                            className="h-10 w-[124px] border-none bg-transparent text-base font-medium transition-colors hover:bg-muted/50 sm:w-[140px]"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTHS.map((m) => (
                                <SelectItem key={m} value={m.toString()}>
                                    {format(setMonth(new Date(), m), 'MMMM')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={currentDate.getFullYear().toString()}
                        onValueChange={(value) => onYearSelect(parseInt(value))}
                    >
                        <SelectTrigger
                            aria-label="Year"
                            className="h-10 w-[88px] border-none bg-transparent text-base font-medium transition-colors hover:bg-muted/50 sm:w-[100px]"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((y) => (
                                <SelectItem key={y} value={y.toString()}>
                                    {y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </header>
    );
}

import { format, setMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

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
    currentDate,
    onPrevMonth,
    onNextMonth,
    onToday,
    onMonthSelect,
    onYearSelect,
}: {
    currentDate: Date;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onToday: () => void;
    onMonthSelect: (month: number) => void;
    onYearSelect: (year: number) => void;
}) {
    const years = yearOptions(currentDate.getFullYear());

    return (
        <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={onPrevMonth}
                        aria-label="Previous month"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={onNextMonth}
                        aria-label="Next month"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
                <Button variant="outline" className="h-10" onClick={onToday}>
                    Today
                </Button>
            </div>

            <div className="flex items-center gap-1 sm:gap-3">
                <Select
                    value={currentDate.getMonth().toString()}
                    onValueChange={(value) => onMonthSelect(parseInt(value))}
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
        </header>
    );
}

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
    const years = Array.from(
        { length: 11 },
        (_, i) => currentDate.getFullYear() - 5 + i,
    );

    return (
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={onPrevMonth}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={onNextMonth}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
                <Button variant="outline" className="h-10" onClick={onToday}>
                    Today
                </Button>
            </div>

            <div className="flex items-center gap-3">
                <Select
                    value={currentDate.getMonth().toString()}
                    onValueChange={(value) => onMonthSelect(parseInt(value))}
                >
                    <SelectTrigger className="h-10 w-[140px] border-none bg-transparent text-base font-medium transition-colors hover:bg-muted/50 focus:ring-0">
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
                    <SelectTrigger className="h-10 w-[100px] border-none bg-transparent text-base font-medium transition-colors hover:bg-muted/50 focus:ring-0">
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

import AppLayout from '@/layouts/app-layout';
import { home } from '@/routes';
import type { DayData, Store, CalendarData, Task } from '@/types';
import React, { useState, useMemo, useEffect } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isToday,
    startOfWeek,
    endOfWeek,
    setMonth,
    setYear,
} from 'date-fns';
import {
    ChevronLeft,
    ChevronRight,
    AlignLeft,
    CheckSquare,
    Moon,
    Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { DayPanelContent } from '@/components/day-panel-content';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function Home({ calendarData }: { calendarData: CalendarData }) {
    // --- State ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // "Database" simulated via localStorage
    // const [store, setStore] = useState<Store>(() => {
    //     const saved = localStorage.getItem('calen-notes-db');
    //     return saved ? JSON.parse(saved) : {};
    // });
    const [calendar, setCalendar] = useState<CalendarData>(calendarData || {});

    useEffect(() => {
        localStorage.setItem('calen-notes-db', JSON.stringify(calendar));
    }, [calendar]);

    const emptyDayData = { notes: '', tasks: [] };

    // --- Calendar Math ---
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = useMemo(() => {
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [startDate, endDate]);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const years = Array.from(
        { length: 11 },
        (_, i) => currentDate.getFullYear() - 5 + i,
    );
    const months = Array.from({ length: 12 }, (_, i) => i);

    // --- Actions ---
    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const handleMonthSelect = (val: string) => {
        setCurrentDate(setMonth(currentDate, parseInt(val)));
    };

    const handleYearSelect = (val: string) => {
        setCurrentDate(setYear(currentDate, parseInt(val)));
    };

    const updateDayData = (date: Date, updater: (prev: DayData) => DayData) => {
        const key = format(date, 'yyyy-MM-dd');
        setCalendar((prev) => {
            const currentData = prev[key] || emptyDayData;
            return { ...prev, [key]: updater(currentData) };
        });
    };

    // --- Render Helpers ---
    const selectedDateKey = selectedDate
        ? format(selectedDate, 'yyyy-MM-dd')
        : null;
    const currentDayData =
        selectedDateKey && calendar[selectedDateKey]
            ? calendar[selectedDateKey]
            : emptyDayData;

    return (
        <AppLayout>
            <AnimatePresence mode="wait">
                {!selectedDate ? (
                    <div
                        key="calendar"
                        className="flex h-screen w-full overflow-hidden bg-background text-foreground"
                    >
                        {/* CALENDAR VIEW */}
                        <div className="flex flex-1 flex-col">
                            {/* Header */}
                            <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground"
                                            onClick={handlePrevMonth}
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground"
                                            onClick={handleNextMonth}
                                        >
                                            <ChevronRight className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="h-10"
                                        onClick={() => {
                                            setCurrentDate(new Date());
                                            setSelectedDate(new Date());
                                        }}
                                    >
                                        Today
                                    </Button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Select
                                        value={currentDate
                                            .getMonth()
                                            .toString()}
                                        onValueChange={handleMonthSelect}
                                    >
                                        <SelectTrigger className="h-10 w-[140px] border-none bg-transparent text-base font-medium transition-colors hover:bg-muted/50 focus:ring-0">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {months.map((m) => (
                                                <SelectItem
                                                    key={m}
                                                    value={m.toString()}
                                                >
                                                    {format(
                                                        setMonth(new Date(), m),
                                                        'MMMM',
                                                    )}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select
                                        value={currentDate
                                            .getFullYear()
                                            .toString()}
                                        onValueChange={handleYearSelect}
                                    >
                                        <SelectTrigger className="h-10 w-[100px] border-none bg-transparent text-base font-medium transition-colors hover:bg-muted/50 focus:ring-0">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {years.map((y) => (
                                                <SelectItem
                                                    key={y}
                                                    value={y.toString()}
                                                >
                                                    {y}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </header>

                            {/* Calendar Grid */}
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

                                {/* Days Grid */}
                                <div className="grid flex-1 grid-cols-7 grid-rows-5 overflow-y-auto">
                                    {calendarDays.map((day, i) => {
                                        const dayKey = format(
                                            day,
                                            'yyyy-MM-dd',
                                        );
                                        const data = calendar[dayKey];
                                        const hasNotes = !!data?.notes;
                                        const hasTasks =
                                            data?.tasks?.length > 0;
                                        const totaltasks =
                                            data?.tasks?.length || 0;
                                        const donetasks =
                                            data?.tasks?.filter(
                                                (t) => t.is_finished,
                                            ).length || 0;
                                        const isSelected =
                                            selectedDate &&
                                            format(
                                                selectedDate,
                                                'yyyy-MM-dd',
                                            ) === dayKey;
                                        const isCurrentMonth = isSameMonth(
                                            day,
                                            monthStart,
                                        );

                                        return (
                                            <div
                                                key={day.toString()}
                                                onClick={() =>
                                                    setSelectedDate(day)
                                                }
                                                className={cn(
                                                    'group relative cursor-pointer border-r border-b border-border p-2 transition-all hover:bg-card/80',
                                                    !isCurrentMonth &&
                                                        'bg-muted/30 text-muted-foreground',
                                                    isCurrentMonth && 'bg-card',
                                                    isSelected &&
                                                        'z-10 bg-accent/5 ring-2 ring-accent ring-inset',
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
                                                                    {donetasks}/
                                                                    {totaltasks}
                                                                </span>
                                                            </div>
                                                            <Progress
                                                                value={
                                                                    totaltasks ===
                                                                    0
                                                                        ? 0
                                                                        : (donetasks /
                                                                              totaltasks) *
                                                                          100
                                                                }
                                                                className="h-1.5 rounded-full bg-accent/20 [&>div]:bg-accent"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-2.5 flex w-full flex-col space-y-2 px-1">
                                                    {hasTasks &&
                                                        data?.tasks.map(
                                                            (task: Task) => (
                                                                <div
                                                                    key={
                                                                        task.id
                                                                    }
                                                                    className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground"
                                                                >
                                                                    <AlignLeft className="h-3 w-3 shrink-0" />
                                                                    <span className="truncate opacity-80">
                                                                        {
                                                                            task.description
                                                                        }
                                                                    </span>
                                                                </div>
                                                            ),
                                                        )}

                                                    {hasNotes && (
                                                        <div className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground">
                                                            <AlignLeft className="h-3 w-3 shrink-0" />
                                                            <span className="truncate opacity-80">
                                                                {data.notes}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {!hasTasks &&
                                                        !hasNotes &&
                                                        !isCurrentMonth && (
                                                            <div className="text-[11px] text-muted-foreground opacity-50">
                                                                -
                                                            </div>
                                                        )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <motion.div
                        key="day-view"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground"
                    >
                        {/* Day View Header */}
                        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10"
                                    onClick={() => setSelectedDate(null)}
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight">
                                        {format(selectedDate, 'EEEE')}
                                    </h1>
                                    <p className="text-sm text-muted-foreground">
                                        {format(selectedDate, 'MMMM d, yyyy')}
                                    </p>
                                </div>
                            </div>
                        </header>

                        {/* Day View Content */}
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="mx-auto max-w-2xl">
                                <DayPanelContent
                                    date={selectedDate}
                                    dayData={currentDayData}
                                    updateData={(updater) =>
                                        updateDayData(selectedDate, updater)
                                    }
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AppLayout>
    );
}

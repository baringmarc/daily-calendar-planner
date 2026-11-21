import axios from 'axios';
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
import type { Day } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Spinner } from '@/components/ui/spinner';
import { UnfinishedTasksDialog } from '@/components/unfinished-tasks-dialog';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { DayData, CalendarData, Task, UnfinishedTasks } from '@/types';

export default function Home({ weekStartsOn }: { weekStartsOn: Day }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [calendar, setCalendar] = useState<CalendarData>({});
    const [isLoading, setIsLoading] = useState(false);
    const [unfinishedTasks, setUnfinishedTasks] = useState<UnfinishedTasks>({});
    const [openUnfinishedTasksDialog, setOpenUnfinishedTasksDialog] =
        useState(false);

    const emptyDayData: DayData = {
        calendar_day: {
            id: null,
            note: '',
        },
        tasks: [],
    };

    // --- Calendar Math ---
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn });
    const endDate = endOfWeek(monthEnd, { weekStartsOn });

    const calendarDays = useMemo(() => {
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [startDate, endDate]);

    const weekCount = calendarDays.length / 7;
    const weekDays = calendarDays.slice(0, 7).map((day) => format(day, 'EEE'));
    const years = Array.from(
        { length: 11 },
        (_, i) => currentDate.getFullYear() - 5 + i,
    );
    const months = Array.from({ length: 12 }, (_, i) => i);

    // - handle date navigation
    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const handleMonthSelect = (val: string) => {
        setCurrentDate(setMonth(currentDate, parseInt(val)));
    };
    const handleYearSelect = (val: string) => {
        setCurrentDate(setYear(currentDate, parseInt(val)));
    };

    const fetchCalendar = useCallback(async (date: Date) => {
        setIsLoading(true);

        try {
            const res = await axios.get('/api/calendar', {
                params: { month: format(date, 'yyyy-MM') },
            });

            setCalendar(res.data.calendarData || {});
        } catch (error) {
            console.log('Error fetching calendar data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // - unfinished tasks from days before today, across all months
    const fetchUnfinishedTasks = useCallback(async () => {
        try {
            const res = await axios.get('/api/tasks/unfinished');

            setUnfinishedTasks(res.data.unfinishedTasks || {});
        } catch (error) {
            console.log('Error fetching unfinished tasks:', error);
        }
    }, []);

    // Fetch again whenever the user is back on the month view, since tasks
    // may have been finished in the day view.
    const isMonthView = selectedDay === null;

    useEffect(() => {
        if (isMonthView) {
            fetchUnfinishedTasks();
        }
    }, [isMonthView, fetchUnfinishedTasks]);

    // - check if there are unfinished tasks from previous days
    useEffect(() => {
        if (Object.keys(unfinishedTasks).length > 0 && !selectedDay) {
            setOpenUnfinishedTasksDialog(true);
        }
    }, [unfinishedTasks, selectedDay]);

    const carryOverTasks = async (carryOverTasks: UnfinishedTasks) => {
        try {
            await axios.post('/api/tasks/carry-over', {
                task_ids: Object.values(carryOverTasks)
                    .flat()
                    .map((task) => task.id),
            });

            setOpenUnfinishedTasksDialog(false);
            setUnfinishedTasks({});

            // Refetch calendar data to reflect changes
            fetchCalendar(currentDate);
        } catch (error) {
            console.log('Error carrying over tasks:', error);
        }
    };

    useEffect(() => {
        fetchCalendar(currentDate);
    }, [currentDate, fetchCalendar]);

    const updateDayData = (date: Date, updater: (prev: DayData) => DayData) => {
        const key = format(date, 'yyyy-MM-dd');
        setCalendar((prev) => {
            const currentData = prev[key] ?? emptyDayData;

            return { ...prev, [key]: updater(currentData) };
        });
    };

    const selectedDayKey = selectedDay
        ? format(selectedDay, 'yyyy-MM-dd')
        : null;
    const currentDayData =
        selectedDayKey && calendar[selectedDayKey]
            ? calendar[selectedDayKey]
            : emptyDayData;

    return (
        <AppLayout>
            <UnfinishedTasksDialog
                open={openUnfinishedTasksDialog}
                onOpenChange={setOpenUnfinishedTasksDialog}
                unfinishedTasks={unfinishedTasks}
                carryOverTasks={carryOverTasks}
            />
            <AnimatePresence mode="wait">
                {!selectedDay ? (
                    <div
                        key="calendar"
                        className="flex h-screen w-full overflow-hidden bg-background text-foreground"
                    >
                        {isLoading && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60">
                                <Spinner />
                            </div>
                        )}

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
                                            setSelectedDay(new Date());
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
                                <div
                                    className="grid flex-1 grid-cols-7 overflow-y-auto"
                                    style={{
                                        // 4, 5 or 6 weeks depending on the month
                                        gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))`,
                                    }}
                                >
                                    {calendarDays.map((day) => {
                                        const dayKey = format(
                                            day,
                                            'yyyy-MM-dd',
                                        );
                                        const data = calendar[dayKey];

                                        const tasks = data?.tasks || [];

                                        const hasNotes =
                                            !!data?.calendar_day.note;
                                        const hasTasks = tasks.length > 0;
                                        const totaltasks = tasks.length || 0;
                                        const donetasks =
                                            tasks.filter((t) => t.is_finished)
                                                .length || 0;
                                        const isSelected =
                                            selectedDay &&
                                            format(
                                                selectedDay,
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
                                                    setSelectedDay(day)
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
                                                        tasks
                                                            .slice(0, 3)
                                                            .map(
                                                                (
                                                                    task: Task,
                                                                ) => (
                                                                    <div
                                                                        key={
                                                                            task.id
                                                                        }
                                                                        className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground"
                                                                    >
                                                                        {task.is_finished ? (
                                                                            <CheckSquare className="h-3 w-3 shrink-0" />
                                                                        ) : (
                                                                            <Square className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                                        )}
                                                                        <span className="truncate opacity-80">
                                                                            {
                                                                                task.description
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                ),
                                                            )}

                                                    {/* {hasNotes && (
                                                        <div className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground">
                                                            <AlignLeft className="h-3 w-3 shrink-0" />
                                                            <span className="truncate opacity-80">
                                                                {data.notes}
                                                            </span>
                                                        </div>
                                                    )} */}

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
                    // - individual day view
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
                                    onClick={() => setSelectedDay(null)}
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight">
                                        {format(selectedDay, 'EEEE')}
                                    </h1>
                                    <p className="text-sm text-muted-foreground">
                                        {format(selectedDay, 'MMMM d, yyyy')}
                                    </p>
                                </div>
                            </div>
                        </header>

                        {/* Day View Content */}
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="mx-auto max-w-2xl">
                                <DayPanelContent
                                    date={selectedDay}
                                    dayData={currentDayData}
                                    updateData={(updater) =>
                                        updateDayData(selectedDay, updater)
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

import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    parseISO,
    setMonth,
    setYear,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import type { Day } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CalendarHeader } from '@/components/calendar-header';
import { DayView } from '@/components/day-view';
import { MonthGrid } from '@/components/month-grid';
import { Spinner } from '@/components/ui/spinner';
import { UnfinishedTasksDialog } from '@/components/unfinished-tasks-dialog';
import { useCalendar } from '@/hooks/use-calendar';
import AppLayout from '@/layouts/app-layout';

export default function Home({ weekStartsOn }: { weekStartsOn: Day }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);

    const {
        calendar,
        isLoading,
        getDayData,
        updateDayData,
        unfinishedTasks,
        isCarryOverOpen,
        setIsCarryOverOpen,
        carryOverTasks,
    } = useCalendar({ currentDate, isMonthView: selectedDay === null });

    // Keyed on the month rather than on Date objects, which are new on
    // every render and would defeat the memo.
    const monthKey = format(currentDate, 'yyyy-MM');
    const monthStart = useMemo(
        () => startOfMonth(parseISO(`${monthKey}-01`)),
        [monthKey],
    );

    const calendarDays = useMemo(
        () =>
            eachDayOfInterval({
                start: startOfWeek(monthStart, { weekStartsOn }),
                end: endOfWeek(endOfMonth(monthStart), { weekStartsOn }),
            }),
        [monthStart, weekStartsOn],
    );

    return (
        <AppLayout fillViewport>
            <UnfinishedTasksDialog
                open={isCarryOverOpen}
                onOpenChange={setIsCarryOverOpen}
                unfinishedTasks={unfinishedTasks}
                carryOverTasks={carryOverTasks}
            />
            <AnimatePresence mode="wait">
                {!selectedDay ? (
                    <div
                        key="calendar"
                        className="relative flex min-h-0 w-full flex-1 overflow-hidden bg-background text-foreground"
                    >
                        {isLoading && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60">
                                <Spinner />
                            </div>
                        )}

                        <div className="flex flex-1 flex-col">
                            <CalendarHeader
                                currentDate={currentDate}
                                onPrevMonth={() =>
                                    setCurrentDate(subMonths(currentDate, 1))
                                }
                                onNextMonth={() =>
                                    setCurrentDate(addMonths(currentDate, 1))
                                }
                                onToday={() => {
                                    setCurrentDate(new Date());
                                    setSelectedDay(new Date());
                                }}
                                onMonthSelect={(month) =>
                                    setCurrentDate(setMonth(currentDate, month))
                                }
                                onYearSelect={(year) =>
                                    setCurrentDate(setYear(currentDate, year))
                                }
                            />

                            <MonthGrid
                                days={calendarDays}
                                monthStart={monthStart}
                                calendar={calendar}
                                onSelectDay={setSelectedDay}
                            />
                        </div>
                    </div>
                ) : (
                    <DayView
                        key="day-view"
                        date={selectedDay}
                        dayData={getDayData(selectedDay)}
                        updateData={(updater) =>
                            updateDayData(selectedDay, updater)
                        }
                        onBack={() => setSelectedDay(null)}
                    />
                )}
            </AnimatePresence>
        </AppLayout>
    );
}

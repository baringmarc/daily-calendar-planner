import { router } from '@inertiajs/react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isWithinInterval,
    parseISO,
    setMonth,
    setYear,
    startOfWeek,
    subMonths,
} from 'date-fns';
import type { Day } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import { CalendarHeader } from '@/components/calendar-header';
import { DayView } from '@/components/day-view';
import { MonthGrid } from '@/components/month-grid';
import { Spinner } from '@/components/ui/spinner';
import { UnfinishedTasksDialog } from '@/components/unfinished-tasks-dialog';
import { dayKey, useCalendar } from '@/hooks/use-calendar';
import AppLayout from '@/layouts/app-layout';
import { home } from '@/routes';

type HomeProps = {
    weekStartsOn: Day;
    // From ?month=yyyy-MM and ?day=yyyy-MM-dd, already validated by
    // HomeController. Null when absent.
    month: string | null;
    day: string | null;
};

// The URL of the last day view opened from the month view in this tab, so
// its back button knows the month view is the history entry behind it. In
// sessionStorage because Inertia remounts the page on back/forward, and a
// reload keeps the browser history.
const DAY_FROM_MONTH_KEY = 'calendaily:day-opened-from-month';

function rememberDayOpenedFromMonth(url: string) {
    try {
        window.sessionStorage.setItem(DAY_FROM_MONTH_KEY, url);
    } catch {
        // Without storage the back button falls back to replacing the entry.
    }
}

function isDayOpenedFromMonth(): boolean {
    try {
        return (
            window.sessionStorage.getItem(DAY_FROM_MONTH_KEY) ===
            homeUrl(Object.fromEntries(new URLSearchParams(location.search)))
        );
    } catch {
        return false;
    }
}

const monthKeyOf = (date: Date) => format(date, 'yyyy-MM');

// The page's URL, with the parameters in the alphabetical order Laravel
// normalises them to. Inertia pushes an extra history entry on reload when
// the server's URL doesn't match the browser's.
const homeUrl = ({ day, month }: { day?: string | null; month?: string }) =>
    home.url({ query: { day, month } });

// The month grid shows whole weeks, so it includes a few days of the
// months either side.
function monthGrid(monthStart: Date, weekStartsOn: Day) {
    return {
        start: startOfWeek(monthStart, { weekStartsOn }),
        end: endOfWeek(endOfMonth(monthStart), { weekStartsOn }),
    };
}

const isInMonthGrid = (date: Date, monthKey: string, weekStartsOn: Day) =>
    isWithinInterval(date, monthGrid(parseISO(`${monthKey}-01`), weekStartsOn));

export default function Home({ weekStartsOn, month, day }: HomeProps) {
    // The URL is the source of truth for what's on screen (UX-07). A day
    // outside the month's grid (a hand-edited URL) shows its own month, so
    // its data is loaded.
    const selectedDay = useMemo(() => (day ? parseISO(day) : null), [day]);
    const requestedMonth = month ?? monthKeyOf(new Date());
    const monthKey =
        selectedDay && !isInMonthGrid(selectedDay, requestedMonth, weekStartsOn)
            ? monthKeyOf(selectedDay)
            : requestedMonth;
    const monthStart = useMemo(() => parseISO(`${monthKey}-01`), [monthKey]);

    // Pushes a history entry (or replaces the current one) without asking
    // the server for the page again.
    const navigate = (
        next: { month: string; day: string | null },
        mode: 'push' | 'replace' = 'push',
    ) =>
        router[mode]<HomeProps>({
            url: homeUrl(next),
            props: (props) => ({ ...props, ...next }),
            preserveState: true,
            preserveScroll: true,
        });

    const showMonth = (date: Date) =>
        navigate({ month: monthKeyOf(date), day: null });

    const openDay = (date: Date, inMonth: string = monthKey) => {
        const next = { month: inMonth, day: dayKey(date) };

        rememberDayOpenedFromMonth(homeUrl(next));
        navigate(next);
    };

    // Like the browser's back button when the month view is the previous
    // entry. After a deep link to a day there's nothing to go back to in
    // the app, so the day's entry becomes its month instead.
    const backToMonth = () => {
        if (isDayOpenedFromMonth()) {
            window.history.back();
        } else {
            navigate({ month: monthKey, day: null }, 'replace');
        }
    };

    const {
        calendar,
        isLoading,
        getDayData,
        updateDayData,
        unfinishedTasks,
        isCarryOverOpen,
        setIsCarryOverOpen,
        carryOverTasks,
        isCarryingOver,
    } = useCalendar({
        currentDate: monthStart,
        isMonthView: selectedDay === null,
    });

    const calendarDays = useMemo(
        () => eachDayOfInterval(monthGrid(monthStart, weekStartsOn)),
        [monthStart, weekStartsOn],
    );

    return (
        <AppLayout fillViewport>
            <UnfinishedTasksDialog
                open={isCarryOverOpen}
                onOpenChange={setIsCarryOverOpen}
                unfinishedTasks={unfinishedTasks}
                carryOverTasks={carryOverTasks}
                isCarryingOver={isCarryingOver}
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
                                currentDate={monthStart}
                                onPrevMonth={() =>
                                    showMonth(subMonths(monthStart, 1))
                                }
                                onNextMonth={() =>
                                    showMonth(addMonths(monthStart, 1))
                                }
                                onToday={() => {
                                    const today = new Date();

                                    openDay(today, monthKeyOf(today));
                                }}
                                onMonthSelect={(m) =>
                                    showMonth(setMonth(monthStart, m))
                                }
                                onYearSelect={(year) =>
                                    showMonth(setYear(monthStart, year))
                                }
                            />

                            <MonthGrid
                                days={calendarDays}
                                monthStart={monthStart}
                                calendar={calendar}
                                onSelectDay={(date) => openDay(date)}
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
                        onBack={backToMonth}
                    />
                )}
            </AnimatePresence>
        </AppLayout>
    );
}

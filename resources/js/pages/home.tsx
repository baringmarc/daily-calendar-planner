import { router } from '@inertiajs/react';
import {
    addDays,
    addMonths,
    addWeeks,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    isWithinInterval,
    parseISO,
    setMonth,
    setYear,
    startOfWeek,
    subMonths,
    subWeeks,
} from 'date-fns';
import type { Day } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import { AgendaView } from '@/components/agenda-view';
import { CalendarHeader } from '@/components/calendar-header';
import { DayView } from '@/components/day-view';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { MonthGrid } from '@/components/month-grid';
import { Spinner } from '@/components/ui/spinner';
import { UnfinishedTasksDialog } from '@/components/unfinished-tasks-dialog';
import { WeekView } from '@/components/week-view';
import { dayKey, useCalendar } from '@/hooks/use-calendar';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import type { ShortcutHandlers } from '@/hooks/use-keyboard-shortcuts';
import { useMoveTask } from '@/hooks/use-move-task';
import { useToggleFinished } from '@/hooks/use-toggle-finished';
import AppLayout from '@/layouts/app-layout';
import { today } from '@/lib/clock';
import { home } from '@/routes';
import type { CalendarView } from '@/types';

type HomeProps = {
    weekStartsOn: Day;
    // From ?month=yyyy-MM, ?day=yyyy-MM-dd, ?view= and ?week=yyyy-MM-dd,
    // already validated by HomeController. Null when absent (view defaults
    // to month).
    month: string | null;
    day: string | null;
    view: CalendarView;
    week: string | null;
};

// What the URL says is on screen.
type Location = Pick<HomeProps, 'month' | 'day' | 'view' | 'week'>;

// The URL of the last day view opened from a calendar view in this tab, so
// its back button knows the calendar is the history entry behind it. In
// sessionStorage because Inertia remounts the page on back/forward, and a
// reload keeps the browser history.
const DAY_FROM_CALENDAR_KEY = 'calendaily:day-opened-from-month';

function rememberDayOpenedFromCalendar(url: string) {
    try {
        window.sessionStorage.setItem(DAY_FROM_CALENDAR_KEY, url);
    } catch {
        // Without storage the back button falls back to replacing the entry.
    }
}

function isDayOpenedFromCalendar(): boolean {
    try {
        return (
            window.sessionStorage.getItem(DAY_FROM_CALENDAR_KEY) ===
            homeUrl(Object.fromEntries(new URLSearchParams(location.search)))
        );
    } catch {
        return false;
    }
}

const monthKeyOf = (date: Date) => format(date, 'yyyy-MM');

// The page's URL, with the parameters in the alphabetical order Laravel
// normalises them to. Inertia pushes an extra history entry on reload when
// the server's URL doesn't match the browser's. The month view is the
// default, so it has no `view`.
const homeUrl = ({
    day,
    month,
    view,
    week,
}: {
    day?: string | null;
    month?: string | null;
    view?: string | null;
    week?: string | null;
}) =>
    home.url({
        query: {
            day,
            month,
            view: view === 'month' ? null : view,
            week,
        },
    });

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

export default function Home({
    weekStartsOn,
    month,
    day,
    view,
    week,
}: HomeProps) {
    // The URL is the source of truth for what's on screen (UX-07). A day
    // outside the month's grid (a hand-edited URL) shows its own month, so
    // its data is loaded.
    const selectedDay = useMemo(() => (day ? parseISO(day) : null), [day]);
    const weekStart = useMemo(
        () => startOfWeek(week ? parseISO(week) : today(), { weekStartsOn }),
        [week, weekStartsOn],
    );
    const weekKey = dayKey(weekStart);
    // Every week is inside the grid of the month it starts in, so the week
    // view reads that month's data.
    const requestedMonth =
        view === 'week'
            ? monthKeyOf(weekStart)
            : (month ?? monthKeyOf(today()));
    const monthKey =
        selectedDay && !isInMonthGrid(selectedDay, requestedMonth, weekStartsOn)
            ? monthKeyOf(selectedDay)
            : requestedMonth;
    const monthStart = useMemo(() => parseISO(`${monthKey}-01`), [monthKey]);

    // The calendar view behind the day view (or on screen).
    const here: Location =
        view === 'week'
            ? { month: null, day: null, view, week: weekKey }
            : { month: monthKey, day: null, view, week: null };

    // Pushes a history entry (or replaces the current one) without asking
    // the server for the page again.
    const navigate = (
        to: Partial<Location>,
        mode: 'push' | 'replace' = 'push',
    ) => {
        const next: Location = {
            month: null,
            day: null,
            view: 'month',
            week: null,
            ...to,
        };

        return router[mode]<HomeProps>({
            url: homeUrl(next),
            props: (props) => ({ ...props, ...next }),
            preserveState: true,
            preserveScroll: true,
        });
    };

    const showMonth = (date: Date, inView: CalendarView = view) =>
        navigate({
            month: monthKeyOf(date),
            view: inView === 'week' ? 'month' : inView,
        });

    const showWeek = (date: Date) =>
        navigate({
            view: 'week',
            week: dayKey(startOfWeek(date, { weekStartsOn })),
        });

    const openDay = (date: Date, from: Location = here) => {
        const next = { ...from, day: dayKey(date) };

        rememberDayOpenedFromCalendar(homeUrl(next));
        navigate(next);
    };

    // Like the browser's back button when the calendar is the previous
    // entry. After a deep link to a day there's nothing to go back to in
    // the app, so the day's entry becomes its calendar view instead.
    const backToCalendar = () => {
        if (isDayOpenedFromCalendar()) {
            window.history.back();
        } else {
            navigate(here, 'replace');
        }
    };

    // Pages the day view to another day (FEAT-07). It replaces the history
    // entry, so back still returns to the calendar view behind it.
    const showDayInDayView = (date: Date) => {
        const next: Location = { month, day: dayKey(date), view, week };

        if (isDayOpenedFromCalendar()) {
            rememberDayOpenedFromCalendar(homeUrl(next));
        }

        navigate(next, 'replace');
    };

    const switchView = (next: CalendarView) => {
        if (next === view) {
            return;
        }

        if (next === 'week') {
            // The week with today in it when it's this month, else the
            // month's first week.
            const now = today();

            showWeek(isSameMonth(now, monthStart) ? now : monthStart);
        } else {
            // A week can span two months: show the one most of it is in.
            showMonth(
                view === 'week' ? addDays(weekStart, 3) : monthStart,
                next,
            );
        }
    };

    const openToday = () => {
        const now = today();

        openDay(
            now,
            view === 'week'
                ? {
                      ...here,
                      week: dayKey(startOfWeek(now, { weekStartsOn })),
                  }
                : { ...here, month: monthKeyOf(now) },
        );
    };

    const showPrev = () =>
        view === 'week'
            ? showWeek(subWeeks(weekStart, 1))
            : showMonth(subMonths(monthStart, 1));
    const showNext = () =>
        view === 'week'
            ? showWeek(addWeeks(weekStart, 1))
            : showMonth(addMonths(monthStart, 1));

    // Keyboard shortcuts (FEAT-07). `n` asks the day view to open its Add
    // Task dialog, after opening today when a calendar view is on screen.
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
    const [addTaskRequested, setAddTaskRequested] = useState(false);
    const showShortcuts = () => setIsShortcutsOpen(true);

    const shortcuts: ShortcutHandlers = selectedDay
        ? {
              n: () => setAddTaskRequested(true),
              t: () => showDayInDayView(today()),
              ArrowLeft: () => showDayInDayView(addDays(selectedDay, -1)),
              ArrowRight: () => showDayInDayView(addDays(selectedDay, 1)),
              Escape: backToCalendar,
              '?': showShortcuts,
          }
        : {
              n: () => {
                  setAddTaskRequested(true);
                  openToday();
              },
              t: openToday,
              ArrowLeft: showPrev,
              ArrowRight: showNext,
              m: () => switchView('month'),
              w: () => switchView('week'),
              a: () => switchView('agenda'),
              '?': showShortcuts,
          };

    useKeyboardShortcuts(shortcuts);

    const toggleFinished = useToggleFinished();
    const moveTask = useMoveTask();

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
        // The prompt shows over any calendar view, not over a day.
        isMonthView: selectedDay === null,
    });

    const calendarDays = useMemo(
        () => eachDayOfInterval(monthGrid(monthStart, weekStartsOn)),
        [monthStart, weekStartsOn],
    );
    const weekDays = useMemo(
        () =>
            eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }),
        [weekStart],
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
            <KeyboardShortcutsDialog
                open={isShortcutsOpen}
                onOpenChange={setIsShortcutsOpen}
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
                                view={view}
                                onViewChange={switchView}
                                currentDate={monthStart}
                                weekStart={weekStart}
                                onPrev={showPrev}
                                onNext={showNext}
                                onToday={openToday}
                                onShowShortcuts={showShortcuts}
                                onMonthSelect={(m) =>
                                    showMonth(setMonth(monthStart, m))
                                }
                                onYearSelect={(year) =>
                                    showMonth(setYear(monthStart, year))
                                }
                            />

                            {view === 'week' ? (
                                <WeekView
                                    days={weekDays}
                                    calendar={calendar}
                                    onSelectDay={(date) => openDay(date)}
                                    onToggleFinished={toggleFinished}
                                    onMoveTask={moveTask}
                                />
                            ) : view === 'agenda' ? (
                                <AgendaView
                                    monthStart={monthStart}
                                    calendar={calendar}
                                    onSelectDay={(date) => openDay(date)}
                                    onToggleFinished={toggleFinished}
                                />
                            ) : (
                                <MonthGrid
                                    days={calendarDays}
                                    monthStart={monthStart}
                                    calendar={calendar}
                                    onSelectDay={(date) => openDay(date)}
                                />
                            )}
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
                        onBack={backToCalendar}
                        addTaskRequested={addTaskRequested}
                        onAddTaskRequestHandled={() =>
                            setAddTaskRequested(false)
                        }
                    />
                )}
            </AnimatePresence>
        </AppLayout>
    );
}

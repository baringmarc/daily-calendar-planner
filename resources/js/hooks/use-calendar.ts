import { usePage } from '@inertiajs/react';
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    carryOverTasks,
    fetchCalendarMonth,
    fetchUnfinishedTasks,
    queryKeys,
} from '@/lib/calendar-api';
import { today as todayInUserZone } from '@/lib/clock';
import type { CalendarData, DayData, UnfinishedTasks } from '@/types';

// Shared by every day without saved data, so it keeps the same identity
// across renders.
export const EMPTY_DAY_DATA: DayData = {
    calendar_day: {
        id: null,
        note: '',
    },
    tasks: [],
};

const EMPTY_CALENDAR: CalendarData = {};
const NO_UNFINISHED_TASKS: UnfinishedTasks = {};

export const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');

// The date (yyyy-MM-dd) the carry-over prompt was last dismissed on. Storage
// can be unavailable (private mode, SSR), in which case it isn't remembered.
const dismissedKey = (userId: number) =>
    `calendaily:carry-over-dismissed:${userId}`;

function readDismissedOn(userId: number): string | null {
    try {
        return window.localStorage.getItem(dismissedKey(userId));
    } catch {
        return null;
    }
}

function writeDismissedOn(userId: number, date: string) {
    try {
        window.localStorage.setItem(dismissedKey(userId), date);
    } catch {
        // Only remembered until the page is reloaded.
    }
}

/**
 * The calendar data for the visible month, and the carry-over prompt.
 *
 * Each month is its own query (`['calendar', 'yyyy-MM']`), so months you've
 * visited are cached and refetched in the background when shown again or
 * when the window regains focus. The unfinished tasks from earlier days are
 * fetched whenever the month view is shown (tasks may have been finished in
 * the day view), and a non-empty result opens the carry-over dialog, unless
 * it was dismissed earlier today.
 */
export function useCalendar({
    currentDate,
    isMonthView,
}: {
    currentDate: Date;
    isMonthView: boolean;
}) {
    const queryClient = useQueryClient();
    const monthKey = format(currentDate, 'yyyy-MM');

    const monthQuery = useQuery({
        queryKey: queryKeys.calendarMonth(monthKey),
        queryFn: () => fetchCalendarMonth(monthKey),
        // Keep showing the previous month (under the spinner) while the next
        // one loads, rather than an empty grid.
        placeholderData: keepPreviousData,
        meta: { errorMessage: "Couldn't load the calendar" },
    });

    // "Not now" (or carrying tasks over) hides the prompt for the rest of
    // the day, in this browser (UX-08).
    const userId = usePage().props.auth.user.id;
    const today = dayKey(todayInUserZone());
    const [dismissedOn, setDismissedOn] = useState(() =>
        readDismissedOn(userId),
    );
    const isDismissedToday = dismissedOn === today;

    const dismissForToday = () => {
        setDismissedOn(today);
        writeDismissedOn(userId, today);
    };

    const unfinishedQuery = useQuery({
        queryKey: queryKeys.unfinishedTasks,
        queryFn: fetchUnfinishedTasks,
        // Fetched again on every return to the month view, since tasks may
        // have been finished in the day view.
        enabled: isMonthView && !isDismissedToday,
        refetchOnWindowFocus: false,
        meta: { errorMessage: "Couldn't check for unfinished tasks" },
    });

    const unfinishedTasks = unfinishedQuery.data ?? NO_UNFINISHED_TASKS;
    const isCarryOverOpen =
        isMonthView &&
        !isDismissedToday &&
        Object.keys(unfinishedTasks).length > 0;

    const setIsCarryOverOpen = (open: boolean) => {
        if (!open) {
            dismissForToday();
        }
    };

    const carryOver = useMutation({
        mutationFn: carryOverTasks,
        onSuccess: (moved) => {
            // The rest were left behind on purpose, so don't ask again today.
            dismissForToday();
            toast.success(
                moved.length === 1
                    ? 'Moved 1 task to today'
                    : `Moved ${moved.length} tasks to today`,
            );

            // The tasks left their old days for today, which may be in any
            // cached month.
            return queryClient.invalidateQueries({
                queryKey: queryKeys.calendar,
            });
        },
        meta: { errorMessage: "Couldn't carry the tasks over" },
    });

    const calendar = monthQuery.data ?? EMPTY_CALENDAR;

    const getDayData = (date: Date): DayData =>
        calendar[dayKey(date)] ?? EMPTY_DAY_DATA;

    // Patches one day in the visible month's cached data after a mutation.
    // Other cached months are refetched when they're next shown.
    const updateDayData = (date: Date, updater: (prev: DayData) => DayData) => {
        const key = dayKey(date);

        queryClient.setQueryData<CalendarData>(
            queryKeys.calendarMonth(monthKey),
            (prev = EMPTY_CALENDAR) => ({
                ...prev,
                [key]: updater(prev[key] ?? EMPTY_DAY_DATA),
            }),
        );
    };

    return {
        calendar,
        // Only the first load of a month, not background refetches.
        isLoading: monthQuery.isPending || monthQuery.isPlaceholderData,
        getDayData,
        updateDayData,
        unfinishedTasks,
        isCarryOverOpen,
        setIsCarryOverOpen,
        carryOverTasks: (ids: number[]) => carryOver.mutate(ids),
        isCarryingOver: carryOver.isPending,
    };
}

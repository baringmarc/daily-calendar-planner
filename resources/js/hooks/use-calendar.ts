import axios from 'axios';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import HomeController from '@/actions/App/Http/Controllers/HomeController';
import TaskController from '@/actions/App/Http/Controllers/TaskController';
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

export const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');

/**
 * The calendar data for the visible month, and the carry-over prompt.
 *
 * Fetches the month whenever `currentDate` moves to another month, and the
 * unfinished tasks from earlier days whenever the month view is shown
 * (tasks may have been finished in the day view). A non-empty result opens
 * the carry-over dialog.
 */
export function useCalendar({
    currentDate,
    isMonthView,
}: {
    currentDate: Date;
    isMonthView: boolean;
}) {
    const [calendar, setCalendar] = useState<CalendarData>({});
    const [isLoading, setIsLoading] = useState(false);
    const [unfinishedTasks, setUnfinishedTasks] = useState<UnfinishedTasks>({});
    const [isCarryOverOpen, setIsCarryOverOpen] = useState(false);

    const monthKey = format(currentDate, 'yyyy-MM');

    const fetchCalendar = useCallback(async (month: string) => {
        setIsLoading(true);

        try {
            const res = await axios.get(
                HomeController.calendar.url({ query: { month } }),
            );

            setCalendar(res.data.calendarData || {});
        } catch (error) {
            console.log('Error fetching calendar data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCalendar(monthKey);
    }, [monthKey, fetchCalendar]);

    useEffect(() => {
        if (!isMonthView) {
            return;
        }

        axios
            .get(TaskController.unfinished.url())
            .then((res) => {
                const tasks: UnfinishedTasks = res.data.unfinishedTasks || {};

                setUnfinishedTasks(tasks);

                if (Object.keys(tasks).length > 0) {
                    setIsCarryOverOpen(true);
                }
            })
            .catch((error) => {
                console.log('Error fetching unfinished tasks:', error);
            });
    }, [isMonthView]);

    const carryOverTasks = async (tasks: UnfinishedTasks) => {
        try {
            await axios.post(TaskController.carryOverTasks.url(), {
                task_ids: Object.values(tasks)
                    .flat()
                    .map((task) => task.id),
            });

            setIsCarryOverOpen(false);
            setUnfinishedTasks({});
            fetchCalendar(monthKey);
        } catch (error) {
            console.log('Error carrying over tasks:', error);
        }
    };

    const getDayData = (date: Date): DayData =>
        calendar[dayKey(date)] ?? EMPTY_DAY_DATA;

    // Patches one day in local state, for the optimistic updates in
    // useTaskActions.
    const updateDayData = (date: Date, updater: (prev: DayData) => DayData) => {
        const key = dayKey(date);

        setCalendar((prev) => ({
            ...prev,
            [key]: updater(prev[key] ?? EMPTY_DAY_DATA),
        }));
    };

    return {
        calendar,
        isLoading,
        getDayData,
        updateDayData,
        unfinishedTasks,
        isCarryOverOpen,
        setIsCarryOverOpen,
        carryOverTasks,
    };
}

export type Task = {
    id: string;
    description: string;
    is_finished: boolean;
};

export type CalendarDay = {
    id: string;
    note: string;
};

export type DayData = {
    calendar_day: CalendarDay;
    tasks: Task[];
};

export type CalendarData = Record<
    string,
    {
        calendar_day: CalendarDay;
        tasks: Task[];
    }
>;

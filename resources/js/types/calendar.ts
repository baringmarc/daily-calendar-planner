export type Task = {
    id: string;
    description: string;
    is_finished: boolean;
};

export type DayData = {
    notes: string;
    tasks: Task[];
};

export type Note = {
    id: string;
    date: string;
    text: string;
};

export type CalendarData = Record<
    string,
    {
        notes: string;
        tasks: Task[];
    }
>;

export type Store = Record<string, DayData>;

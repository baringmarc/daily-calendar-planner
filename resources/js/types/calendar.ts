export type Task = {
    id: string;
    description: string;
    is_finished: boolean;
    calendar_day_id: string;
    priority: number;
    order: number;
};

export type CalendarDay = {
    id: string | null;
    note: string;
};

export type DayData = {
    calendar_day: CalendarDay;
    tasks: Task[];
};

export type UnfinishedTasks = Record<string, Task[]>;

export type CalendarData = Record<
    string,
    {
        calendar_day: CalendarDay;
        tasks: Task[];
    }
>;

export type TaskActions = {
    // state
    newTask: string;
    setNewTask: (value: string) => void;
    isAddingTask: boolean;
    setIsAddingTask: (value: boolean) => void;
    currentEditTaskID: string | null;
    currentEditTask: string;
    setCurrentEditTask: (value: string) => void;
    setCurrentEditTaskID: (value: string | null) => void;

    // actions
    updateNotes: (note: string) => Promise<void>;
    handleAddTask: (e: React.FormEvent) => Promise<void>;
    handleDeleteTask: (id: string) => Promise<void>;
    toggleFinishTask: (id: string, is_finished: boolean) => Promise<void>;
    toggleEditTask: (id: string, description: string) => void;
    handleEditTask: (e: React.FormEvent) => Promise<void>;
};

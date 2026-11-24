// The Stats page's props (FEAT-14). Mirrors StatsService::stats().

export type Counts = {
    total: number;
    finished: number;
};

// A week or month, from its first day (yyyy-MM-dd).
export type PeriodCounts = Counts & {
    start: string;
};

export type Stats = {
    // The user's today, yyyy-MM-dd. Nothing after it is counted.
    today: string;
    streak: { current: number; longest: number };
    totals: { today: Counts; week: Counts; month: Counts };
    // The last 12, oldest first, ending with this one.
    weeks: PeriodCounts[];
    months: PeriodCounts[];
    // Days with tasks from `start` (a week start) to today.
    heatmap: { start: string; days: Record<string, Counts> };
};

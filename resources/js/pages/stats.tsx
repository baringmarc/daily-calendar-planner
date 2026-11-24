import { Head, Link } from '@inertiajs/react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { CalendarCheck, Flame, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Heading from '@/components/heading';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { home, stats as statsRoute } from '@/routes';
import type { BreadcrumbItem, Counts, PeriodCounts, Stats } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Stats', href: statsRoute() }];

const percent = ({ total, finished }: Counts) =>
    total === 0 ? 0 : Math.round((finished / total) * 100);

const plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? '' : 's'}`;

// The heatmap's shades, lightest first. Each one is also named in the
// legend and in every cell's label, so colour isn't the only cue.
const LEVELS = [
    { label: 'No tasks', className: 'bg-muted' },
    // Outlined, so it can't be mistaken for an empty day.
    {
        label: 'None done',
        className: 'bg-card ring-1 ring-primary/60 ring-inset',
    },
    { label: 'Under half', className: 'bg-primary/40' },
    { label: 'Half or more', className: 'bg-primary/70' },
    { label: 'All done', className: 'bg-primary' },
] as const;

function level(counts: Counts | undefined): number {
    if (!counts || counts.total === 0) {
        return 0;
    }

    if (counts.finished === 0) {
        return 1;
    }

    if (counts.finished === counts.total) {
        return 4;
    }

    return counts.finished * 2 < counts.total ? 2 : 3;
}

// The day view's URL, with the query in the order Laravel normalises it to.
const dayUrl = (date: string) =>
    home.url({ query: { day: date, month: date.slice(0, 7) } });

/**
 * Completion, streaks and a heatmap of the last year (FEAT-14). The props
 * come from StatsService and only count days up to the user's today.
 */
export default function StatsPage({ stats }: { stats: Stats }) {
    const { streak, totals } = stats;
    const finishedToday = totals.today.finished > 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Stats" />

            <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
                <Heading
                    title="Stats"
                    description="How much of what you plan gets done."
                />

                <section
                    aria-label="Summary"
                    className="grid grid-cols-2 gap-3 lg:grid-cols-5"
                >
                    <StreakCard
                        icon={Flame}
                        label="Current streak"
                        days={streak.current}
                        hint={
                            streak.current === 0
                                ? 'Finish a task to start one.'
                                : finishedToday
                                  ? 'Including today.'
                                  : 'Finish a task today to keep it going.'
                        }
                    />
                    <StreakCard
                        icon={Trophy}
                        label="Longest streak"
                        days={streak.longest}
                        hint="Days in a row with a task done."
                    />
                    <CompletionCard label="Today" counts={totals.today} />
                    <CompletionCard label="This week" counts={totals.week} />
                    <CompletionCard
                        label="This month"
                        counts={totals.month}
                        // Fills the row it's alone on, in two columns.
                        className="col-span-2 lg:col-span-1"
                    />
                </section>

                <CompletionChart weeks={stats.weeks} months={stats.months} />

                <Heatmap
                    start={stats.heatmap.start}
                    today={stats.today}
                    days={stats.heatmap.days}
                />
            </div>
        </AppLayout>
    );
}

function StreakCard({
    icon: Icon,
    label,
    days,
    hint,
}: {
    icon: LucideIcon;
    label: string;
    days: number;
    hint: string;
}) {
    return (
        <Card className="gap-2 py-4">
            <CardHeader className="px-4">
                <CardDescription className="flex items-center gap-1.5">
                    <Icon aria-hidden className="h-4 w-4" />
                    {label}
                </CardDescription>
            </CardHeader>
            <CardContent className="px-4">
                <p className="text-2xl font-semibold tabular-nums">
                    {plural(days, 'day')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </CardContent>
        </Card>
    );
}

function CompletionCard({
    label,
    counts,
    className,
}: {
    label: string;
    counts: Counts;
    className?: string;
}) {
    return (
        <Card className={cn('gap-2 py-4', className)}>
            <CardHeader className="px-4">
                <CardDescription className="flex items-center gap-1.5">
                    <CalendarCheck aria-hidden className="h-4 w-4" />
                    {label}
                </CardDescription>
            </CardHeader>
            <CardContent className="px-4">
                {counts.total === 0 ? (
                    <>
                        <p className="text-2xl font-semibold">–</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Nothing planned.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-2xl font-semibold tabular-nums">
                            {percent(counts)}%
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                            {counts.finished} of {counts.total} done
                        </p>
                        <Progress
                            value={percent(counts)}
                            aria-label={`${label}: ${percent(counts)}% done`}
                            className="mt-2 h-1.5"
                        />
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function CompletionChart({
    weeks,
    months,
}: {
    weeks: PeriodCounts[];
    months: PeriodCounts[];
}) {
    const [unit, setUnit] = useState<'week' | 'month'>('week');
    const periods = unit === 'week' ? weeks : months;

    const label = (start: string) => {
        const date = parseISO(start);

        return unit === 'week'
            ? format(date, 'MMM d')
            : format(date, date.getMonth() === 0 ? 'MMM yyyy' : 'MMM');
    };

    const longLabel = (start: string) =>
        unit === 'week'
            ? `Week of ${format(parseISO(start), 'MMM d, yyyy')}`
            : format(parseISO(start), 'MMMM yyyy');

    return (
        <Card className="gap-4">
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                    <CardTitle>Completion rate</CardTitle>
                    <CardDescription>
                        The share of each {unit}’s tasks that got done.
                    </CardDescription>
                </div>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={unit}
                    onValueChange={(value) =>
                        value && setUnit(value as 'week' | 'month')
                    }
                    aria-label="Group by"
                >
                    <ToggleGroupItem
                        value="week"
                        className="h-9 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                        Weeks
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        value="month"
                        className="h-9 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                        Months
                    </ToggleGroupItem>
                </ToggleGroup>
            </CardHeader>
            <CardContent>
                <ol
                    aria-label={`Completion by ${unit}`}
                    className="flex h-48 items-stretch gap-1 sm:gap-2"
                >
                    {periods.map((period, index) => (
                        <li
                            key={period.start}
                            className="flex min-w-0 flex-1 flex-col items-center gap-1"
                        >
                            <span className="sr-only">
                                {longLabel(period.start)}:{' '}
                                {period.total === 0
                                    ? 'nothing planned'
                                    : `${period.finished} of ${period.total} done, ${percent(period)}%`}
                            </span>
                            <span
                                aria-hidden
                                className="text-[10px] text-muted-foreground tabular-nums sm:text-xs"
                            >
                                {period.total === 0
                                    ? '–'
                                    : `${percent(period)}%`}
                            </span>
                            <div
                                aria-hidden
                                className="flex w-full flex-1 items-end overflow-hidden rounded-sm bg-muted/60"
                            >
                                <div
                                    className="w-full rounded-sm bg-primary transition-[height]"
                                    style={{ height: `${percent(period)}%` }}
                                />
                            </div>
                            <span
                                aria-hidden
                                className={cn(
                                    'text-center text-[10px] whitespace-nowrap text-muted-foreground sm:text-xs',
                                    // Every third label on phones, counted
                                    // back from the latest, so they fit.
                                    (periods.length - 1 - index) % 3 !== 0 &&
                                        'max-sm:invisible',
                                )}
                            >
                                {label(period.start)}
                            </span>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}

// One cell's width plus the gap, for the month labels above the grid.
const CELL = 'size-3';
const COLUMN_WIDTH_CLASS = 'auto-cols-[0.75rem]';

function Heatmap({
    start,
    today,
    days,
}: {
    start: string;
    today: string;
    days: Record<string, Counts>;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Weeks as columns of seven dates; the last one stops at today.
    const weeks = useMemo(() => {
        const first = parseISO(start);
        const count = differenceInCalendarDays(parseISO(today), first) + 1;
        const columns: string[][] = [];

        for (let i = 0; i < count; i++) {
            if (i % 7 === 0) {
                columns.push([]);
            }

            columns[columns.length - 1].push(
                format(addDays(first, i), 'yyyy-MM-dd'),
            );
        }

        return columns;
    }, [start, today]);

    const activeDays = Object.values(days).filter((d) => d.finished > 0).length;

    // Phones show the end of the year first: the latest weeks.
    useEffect(() => {
        const el = scrollRef.current;

        if (el) {
            el.scrollLeft = el.scrollWidth;
        }
    }, [weeks]);

    const weekdayLabels = weeks[0].map((date) => format(parseISO(date), 'EEE'));

    return (
        <Card className="gap-4">
            <CardHeader>
                <CardTitle>Last year</CardTitle>
                <CardDescription>
                    {plural(activeDays, 'day')} with a task done. Choose a day
                    to open it.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div ref={scrollRef} className="overflow-x-auto pb-2">
                    <div className="flex w-max gap-2">
                        <div
                            aria-hidden
                            // Stays in view while the weeks scroll.
                            className="sticky left-0 z-10 grid grid-rows-[auto_repeat(7,0.75rem)] gap-[3px] bg-card text-[10px] leading-3 text-muted-foreground"
                        >
                            <span className="h-3" />
                            {weekdayLabels.map((label, row) => (
                                <span key={row} className="pr-1">
                                    {row % 2 === 1 ? label : ''}
                                </span>
                            ))}
                        </div>
                        <div className="grid gap-[3px]">
                            <div
                                aria-hidden
                                className={cn(
                                    'grid grid-flow-col gap-[3px] text-[10px] leading-3 text-muted-foreground',
                                    COLUMN_WIDTH_CLASS,
                                )}
                            >
                                {weeks.map((week, column) => {
                                    const month = week[0].slice(0, 7);
                                    // A month is named over its first
                                    // week, when the next week is in it
                                    // too, so names never run into each
                                    // other.
                                    const isNewMonth =
                                        (column === 0 ||
                                            weeks[column - 1][0].slice(0, 7) !==
                                                month) &&
                                        weeks[column + 1]?.[0].slice(0, 7) ===
                                            month;

                                    return (
                                        <span
                                            key={week[0]}
                                            className="overflow-visible whitespace-nowrap"
                                        >
                                            {isNewMonth
                                                ? format(
                                                      parseISO(week[0]),
                                                      'MMM',
                                                  )
                                                : ''}
                                        </span>
                                    );
                                })}
                            </div>
                            <div
                                className={cn(
                                    'grid grid-flow-col grid-rows-7 gap-[3px]',
                                    COLUMN_WIDTH_CLASS,
                                )}
                            >
                                {weeks.flat().map((date) => (
                                    <HeatmapCell
                                        key={date}
                                        date={date}
                                        counts={days[date]}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <ul
                    aria-label="Legend"
                    className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
                >
                    {LEVELS.map(({ label, className }) => (
                        <li key={label} className="flex items-center gap-1.5">
                            <span
                                aria-hidden
                                className={cn(CELL, 'rounded-[3px]', className)}
                            />
                            {label}
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

function HeatmapCell({
    date,
    counts,
}: {
    date: string;
    counts: Counts | undefined;
}) {
    const parsed = parseISO(date);
    const label = `${format(parsed, 'EEE, MMM d, yyyy')}: ${
        counts && counts.total > 0
            ? `${counts.finished} of ${counts.total} done`
            : 'nothing planned'
    }`;

    return (
        <Link
            href={dayUrl(date)}
            aria-label={label}
            title={label}
            className={cn(
                CELL,
                'rounded-[3px] outline-none hover:ring-2 hover:ring-ring/60 focus-visible:ring-2 focus-visible:ring-ring',
                LEVELS[level(counts)].className,
            )}
        />
    );
}

<?php

namespace App\Services;

use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Completion counts and streaks for the Stats page (FEAT-14).
 *
 * Only days up to the user's today count. A day's completion is its
 * finished tasks out of all its tasks, and a streak counts days in a row
 * with at least one finished task (spec decision D11).
 */
class StatsService
{
    /**
     * How many weeks and months the period chart shows, this one included.
     */
    public const PERIODS = 12;

    /**
     * The heatmap shows this many weeks before the current one.
     */
    public const HEATMAP_WEEKS = 52;

    /**
     * @param  int  $weekStartsOn  0 = Sunday ... 6 = Saturday
     * @return array{
     *     today: string,
     *     streak: array{current: int, longest: int},
     *     totals: array{today: array{total: int, finished: int}, week: array{total: int, finished: int}, month: array{total: int, finished: int}},
     *     weeks: list<array{start: string, total: int, finished: int}>,
     *     months: list<array{start: string, total: int, finished: int}>,
     *     heatmap: array{start: string, days: array<string, array{total: int, finished: int}>},
     * }
     */
    public function stats(User $user, CarbonImmutable $today, int $weekStartsOn): array
    {
        $days = $this->countsByDay($user, $today->toDateString());

        $weeks = $this->periods(
            $days,
            fn (int $ago) => $today->startOfWeek($weekStartsOn)->subWeeks($ago),
            fn (CarbonImmutable $start) => $start->addWeek(),
        );

        $months = $this->periods(
            $days,
            fn (int $ago) => $today->startOfMonth()->subMonthsNoOverflow($ago),
            fn (CarbonImmutable $start) => $start->addMonthNoOverflow(),
        );

        $heatmapStart = $today->startOfWeek($weekStartsOn)->subWeeks(self::HEATMAP_WEEKS)->toDateString();

        return [
            'today' => $today->toDateString(),
            'streak' => $this->streaks($days, $today),
            'totals' => [
                'today' => $days[$today->toDateString()] ?? ['total' => 0, 'finished' => 0],
                'week' => self::counts(end($weeks)),
                'month' => self::counts(end($months)),
            ],
            'weeks' => $weeks,
            'months' => $months,
            'heatmap' => [
                'start' => $heatmapStart,
                'days' => array_filter($days, fn (string $date) => $date >= $heatmapStart, ARRAY_FILTER_USE_KEY),
            ],
        ];
    }

    /**
     * Task counts for each of the user's days up to $today that has tasks,
     * oldest first.
     *
     * @return array<string, array{total: int, finished: int}>
     */
    private function countsByDay(User $user, string $today): array
    {
        return Task::query()
            ->join('calendar_days', 'calendar_days.id', '=', 'tasks.calendar_day_id')
            ->where('calendar_days.user_id', $user->id)
            ->where('calendar_days.date', '<=', $today)
            ->groupBy('calendar_days.date')
            ->orderBy('calendar_days.date')
            ->selectRaw('calendar_days.date as date, count(*) as total, sum(case when tasks.is_finished then 1 else 0 end) as finished')
            ->toBase()
            ->get()
            ->mapWithKeys(fn (object $row) => [
                substr((string) $row->date, 0, 10) => ['total' => (int) $row->total, 'finished' => (int) $row->finished],
            ])
            ->all();
    }

    /**
     * The last PERIODS periods, oldest first, each summing its days ($days
     * already stops at today).
     *
     * @param  array<string, array{total: int, finished: int}>  $days
     * @param  callable(int): CarbonImmutable  $startOf  the start of the period $ago periods back
     * @param  callable(CarbonImmutable): CarbonImmutable  $next  the start of the period after
     * @return list<array{start: string, total: int, finished: int}>
     */
    private function periods(array $days, callable $startOf, callable $next): array
    {
        $periods = [];

        foreach (range(self::PERIODS - 1, 0) as $ago) {
            $start = $startOf($ago)->toDateString();
            $end = $next($startOf($ago))->toDateString();
            $period = ['start' => $start, 'total' => 0, 'finished' => 0];

            foreach ($days as $date => $counts) {
                if ($date >= $start && $date < $end) {
                    $period['total'] += $counts['total'];
                    $period['finished'] += $counts['finished'];
                }
            }

            $periods[] = $period;
        }

        return $periods;
    }

    /**
     * The current streak runs back from today, or from yesterday while
     * today has nothing finished yet. The longest is the longest run ever.
     *
     * @param  array<string, array{total: int, finished: int}>  $days  oldest first
     * @return array{current: int, longest: int}
     */
    private function streaks(array $days, CarbonImmutable $today): array
    {
        $active = array_keys(array_filter($days, fn (array $counts) => $counts['finished'] > 0));
        $isActive = array_flip($active);

        $day = isset($isActive[$today->toDateString()]) ? $today : $today->subDay();
        $current = 0;

        while (isset($isActive[$day->toDateString()])) {
            $current++;
            $day = $day->subDay();
        }

        $longest = 0;
        $run = 0;
        $previous = null;

        foreach ($active as $date) {
            $run = $previous !== null && CarbonImmutable::parse($previous)->addDay()->toDateString() === $date ? $run + 1 : 1;
            $longest = max($longest, $run);
            $previous = $date;
        }

        return ['current' => $current, 'longest' => $longest];
    }

    /**
     * @param  array{start: string, total: int, finished: int}|false  $period
     * @return array{total: int, finished: int}
     */
    private static function counts(array|false $period): array
    {
        return ['total' => $period['total'] ?? 0, 'finished' => $period['finished'] ?? 0];
    }
}

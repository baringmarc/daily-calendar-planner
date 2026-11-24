<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use App\Services\StatsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * The Stats page (FEAT-14). Today is Wednesday, Nov 25, 2026, and weeks
 * start on Monday unless a test says otherwise.
 */
class StatsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-11-25 10:00:00');
        $this->user = User::factory()->create(['timezone' => 'UTC', 'week_starts_on' => 1]);
    }

    public function test_it_renders_the_stats_page(): void
    {
        $this->actingAs($this->user)->get(route('stats'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('stats')
                ->where('stats.today', '2026-11-25')
                ->where('stats.streak', ['current' => 0, 'longest' => 0])
                ->where('stats.totals.today', ['total' => 0, 'finished' => 0])
                ->has('stats.weeks', StatsService::PERIODS)
                ->has('stats.months', StatsService::PERIODS)
                ->where('stats.heatmap.days', [])
            );
    }

    public function test_it_counts_today_this_week_and_this_month(): void
    {
        $this->tasks('2026-11-25', finished: 1, unfinished: 2);
        $this->tasks('2026-11-23', finished: 2, unfinished: 0);
        // Last week, still this month.
        $this->tasks('2026-11-20', finished: 1, unfinished: 1);
        // Last month.
        $this->tasks('2026-10-31', finished: 3, unfinished: 0);

        $this->assertStats(fn (Assert $page) => $page
            ->where('stats.totals.today', ['total' => 3, 'finished' => 1])
            ->where('stats.totals.week', ['total' => 5, 'finished' => 3])
            ->where('stats.totals.month', ['total' => 7, 'finished' => 4])
        );
    }

    public function test_weeks_and_months_list_the_last_twelve_oldest_first(): void
    {
        $this->tasks('2026-11-24', finished: 1, unfinished: 0);
        $this->tasks('2026-09-02', finished: 0, unfinished: 2);

        $this->assertStats(fn (Assert $page) => $page
            ->where('stats.weeks.0', ['start' => '2026-09-07', 'total' => 0, 'finished' => 0])
            ->where('stats.weeks.11', ['start' => '2026-11-23', 'total' => 1, 'finished' => 1])
            ->where('stats.months.0', ['start' => '2025-12-01', 'total' => 0, 'finished' => 0])
            ->where('stats.months.9', ['start' => '2026-09-01', 'total' => 2, 'finished' => 0])
            ->where('stats.months.11', ['start' => '2026-11-01', 'total' => 1, 'finished' => 1])
        );
    }

    public function test_future_days_are_not_counted(): void
    {
        $this->tasks('2026-11-26', finished: 1, unfinished: 1);
        $this->tasks('2026-11-29', finished: 1, unfinished: 0);

        $this->assertStats(fn (Assert $page) => $page
            ->where('stats.totals.week', ['total' => 0, 'finished' => 0])
            ->where('stats.totals.month', ['total' => 0, 'finished' => 0])
            ->where('stats.streak', ['current' => 0, 'longest' => 0])
            ->where('stats.heatmap.days', [])
        );
    }

    public function test_the_streak_runs_back_from_today(): void
    {
        foreach (['2026-11-23', '2026-11-24', '2026-11-25'] as $date) {
            $this->tasks($date, finished: 1, unfinished: 1);
        }

        $this->assertStats(fn (Assert $page) => $page->where('stats.streak', ['current' => 3, 'longest' => 3]));
    }

    public function test_an_unfinished_today_does_not_end_the_streak(): void
    {
        $this->tasks('2026-11-23', finished: 1, unfinished: 0);
        $this->tasks('2026-11-24', finished: 1, unfinished: 0);
        $this->tasks('2026-11-25', finished: 0, unfinished: 2);

        $this->assertStats(fn (Assert $page) => $page->where('stats.streak.current', 2));
    }

    public function test_a_day_without_a_finished_task_ends_the_streak(): void
    {
        $this->tasks('2026-11-20', finished: 1, unfinished: 0);
        $this->tasks('2026-11-21', finished: 1, unfinished: 0);
        $this->tasks('2026-11-22', finished: 1, unfinished: 0);
        // Planned but nothing done.
        $this->tasks('2026-11-23', finished: 0, unfinished: 1);
        // Nov 24 has nothing planned at all.
        $this->tasks('2026-11-25', finished: 1, unfinished: 0);

        $this->assertStats(fn (Assert $page) => $page->where('stats.streak', ['current' => 1, 'longest' => 3]));
    }

    public function test_the_streak_is_over_after_a_missed_yesterday(): void
    {
        $this->tasks('2026-11-22', finished: 1, unfinished: 0);
        $this->tasks('2026-11-23', finished: 1, unfinished: 0);

        $this->assertStats(fn (Assert $page) => $page->where('stats.streak', ['current' => 0, 'longest' => 2]));
    }

    public function test_the_longest_streak_spans_months_and_years(): void
    {
        foreach (['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'] as $date) {
            $this->tasks($date, finished: 1, unfinished: 0);
        }

        $this->assertStats(fn (Assert $page) => $page->where('stats.streak.longest', 4));
    }

    public function test_the_heatmap_covers_the_last_year_from_the_week_start(): void
    {
        $this->tasks('2026-11-25', finished: 1, unfinished: 1);
        $this->tasks('2025-11-24', finished: 1, unfinished: 0);
        // Before the heatmap starts.
        $this->tasks('2025-11-23', finished: 1, unfinished: 0);

        $this->assertStats(fn (Assert $page) => $page
            ->where('stats.heatmap.start', '2025-11-24')
            ->where('stats.heatmap.days', [
                '2025-11-24' => ['total' => 1, 'finished' => 1],
                '2026-11-25' => ['total' => 2, 'finished' => 1],
            ])
        );
    }

    public function test_weeks_follow_the_users_week_start(): void
    {
        $this->user->update(['week_starts_on' => 0]);
        // A Sunday: this week when weeks start on Sunday.
        $this->tasks('2026-11-22', finished: 1, unfinished: 0);

        $this->assertStats(fn (Assert $page) => $page
            ->where('stats.weeks.11.start', '2026-11-22')
            ->where('stats.totals.week', ['total' => 1, 'finished' => 1])
            ->where('stats.heatmap.start', '2025-11-23')
        );
    }

    public function test_today_is_the_users_today(): void
    {
        // 12:00 UTC is already Nov 26 in Auckland.
        $this->travelTo('2026-11-25 12:00:00');
        $this->user->update(['timezone' => 'Pacific/Auckland']);
        $this->tasks('2026-11-26', finished: 1, unfinished: 0);

        $this->assertStats(fn (Assert $page) => $page
            ->where('stats.today', '2026-11-26')
            ->where('stats.totals.today', ['total' => 1, 'finished' => 1])
            ->where('stats.streak.current', 1)
        );
    }

    public function test_other_users_tasks_are_not_counted(): void
    {
        $other = CalendarDay::factory()->onDate('2026-11-25')->create();
        Task::factory()->for($other)->finished()->create();

        $this->assertStats(fn (Assert $page) => $page
            ->where('stats.totals.today', ['total' => 0, 'finished' => 0])
            ->where('stats.streak.current', 0)
        );
    }

    public function test_guests_are_redirected_to_log_in(): void
    {
        $this->get(route('stats'))->assertRedirect(route('login'));
    }

    /**
     * @param  callable(Assert): Assert  $assertions
     */
    private function assertStats(callable $assertions): void
    {
        $this->actingAs($this->user)->get(route('stats'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $assertions($page->component('stats')));
    }

    private function tasks(string $date, int $finished, int $unfinished): void
    {
        $day = CalendarDay::factory()->for($this->user)->onDate($date)->create();

        Task::factory()->count($finished)->finished()->for($day)->create();
        Task::factory()->count($unfinished)->for($day)->create();
    }
}

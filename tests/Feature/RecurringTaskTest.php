<?php

namespace Tests\Feature;

use App\Enums\Priority;
use App\Enums\RepeatFrequency;
use App\Models\CalendarDay;
use App\Models\RecurringTask;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Recurring tasks (FEAT-09, spec decisions D6 and D7). "Today" is Saturday
 * 2026-11-21, and the November grid runs Mon Oct 26 to Sun Dec 6.
 */
class RecurringTaskTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-11-21 09:00:00');
        $this->user = User::factory()->create();
    }

    public function test_adding_a_repeating_task_creates_the_rule_and_its_first_occurrence(): void
    {
        $response = $this->addTask('2026-11-21', ['frequency' => 'daily']);

        $response->assertCreated()
            ->assertJsonPath('recurrence', [
                'frequency' => 'daily',
                'interval' => 1,
                'weekdays' => null,
                'ends_on' => null,
            ]);

        $rule = RecurringTask::sole();
        $this->assertSame($this->user->id, $rule->user_id);
        $this->assertSame('Water plants', $rule->description);
        $this->assertSame('2026-11-21', $rule->starts_on->toDateString());
        $this->assertSame('2026-11-21', $rule->generated_through->toDateString());
        $this->assertSame($rule->id, Task::sole()->recurring_task_id);
    }

    public function test_rule_dates_are_stored_as_plain_dates(): void
    {
        $this->addTask('2026-11-21', ['frequency' => 'daily', 'ends_on' => '2026-12-31']);
        $this->calendar('2026-11');

        $row = (array) DB::table('recurring_tasks')->sole();
        $this->assertSame(
            ['2026-11-21', '2026-12-31', '2026-12-06'],
            [$row['starts_on'], $row['ends_on'], $row['generated_through']],
        );
    }

    public function test_reading_the_calendar_creates_occurrences_up_to_the_end_of_the_range(): void
    {
        $this->addTask('2026-11-21', ['frequency' => 'daily']);

        $response = $this->calendar('2026-11');

        $response->assertOk()
            ->assertJsonPath('calendarData.2026-11-22.tasks.0.description', 'Water plants')
            ->assertJsonPath('calendarData.2026-11-22.tasks.0.recurrence.frequency', 'daily');
        $this->assertSame($this->datesFrom('2026-11-21', '2026-12-06'), $this->occurrenceDates());

        // Reading again creates nothing new.
        $this->calendar('2026-11');
        $this->assertSame(16, Task::count());
    }

    public function test_occurrences_go_after_the_tasks_already_on_that_day(): void
    {
        $day = CalendarDay::factory()->onDate('2026-11-22')->create(['user_id' => $this->user->id]);
        Task::factory()->for($day)->create(['order' => 1]);
        $this->addTask('2026-11-21', ['frequency' => 'daily']);

        $this->calendar('2026-11')
            ->assertJsonPath('calendarData.2026-11-22.tasks.1.description', 'Water plants')
            ->assertJsonPath('calendarData.2026-11-22.tasks.1.order', 2);
    }

    public function test_a_weekly_rule_must_include_the_tasks_day(): void
    {
        // The 21st is a Saturday (6).
        $this->addTask('2026-11-21', ['frequency' => 'weekly', 'weekdays' => [1, 3]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('recurrence.weekdays');

        $this->addTask('2026-11-21', ['frequency' => 'weekly'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('recurrence.weekdays');

        $this->assertSame(0, Task::count());
        $this->assertSame(0, RecurringTask::count());
    }

    public function test_invalid_rules_are_rejected(): void
    {
        foreach ([
            ['frequency' => 'yearly'],
            ['frequency' => 'daily', 'interval' => 0],
            ['frequency' => 'daily', 'interval' => 100],
            ['frequency' => 'weekly', 'weekdays' => [7]],
            ['frequency' => 'weekly', 'weekdays' => [6, 6]],
            ['frequency' => 'daily', 'ends_on' => 'soon'],
            ['frequency' => 'daily', 'ends_on' => '2026-11-20'],
        ] as $recurrence) {
            $this->addTask('2026-11-21', $recurrence)->assertUnprocessable();
        }

        $this->assertSame(0, Task::count());
    }

    public function test_rules_know_which_days_they_occur_on(): void
    {
        $monday = CarbonImmutable::MONDAY;
        $on = fn (RecurringTask $rule, string $date) => $rule->occursOn(CarbonImmutable::parse($date), $monday);

        $everyThirdDay = RecurringTask::factory()->make(['starts_on' => '2026-11-21', 'interval' => 3]);
        $this->assertTrue($on($everyThirdDay, '2026-11-24'));
        $this->assertFalse($on($everyThirdDay, '2026-11-23'));
        $this->assertFalse($on($everyThirdDay, '2026-11-18'));

        // Mondays and Wednesdays, every other week, from Mon Nov 23.
        $fortnightly = RecurringTask::factory()->weekly([1, 3], 2)->make(['starts_on' => '2026-11-23']);
        $this->assertTrue($on($fortnightly, '2026-11-23'));
        $this->assertTrue($on($fortnightly, '2026-11-25'));
        $this->assertFalse($on($fortnightly, '2026-11-30'));
        $this->assertTrue($on($fortnightly, '2026-12-07'));
        $this->assertFalse($on($fortnightly, '2026-12-08'));

        // The 31st skips months without one.
        $monthly = RecurringTask::factory()->monthly()->make(['starts_on' => '2026-01-31']);
        $this->assertFalse($on($monthly, '2026-02-28'));
        $this->assertTrue($on($monthly, '2026-03-31'));
        $this->assertFalse($on($monthly, '2026-04-30'));

        $bimonthly = RecurringTask::factory()->monthly(2)->make(['starts_on' => '2026-11-21']);
        $this->assertFalse($on($bimonthly, '2026-12-21'));
        $this->assertTrue($on($bimonthly, '2027-01-21'));

        $ending = RecurringTask::factory()->make(['starts_on' => '2026-11-21', 'ends_on' => '2026-11-30']);
        $this->assertTrue($on($ending, '2026-11-30'));
        $this->assertFalse($on($ending, '2026-12-01'));
    }

    public function test_past_days_are_never_backfilled(): void
    {
        RecurringTask::factory()->startingOn('2026-11-01')->create(['user_id' => $this->user->id]);

        $this->calendar('2026-11');

        $this->assertSame($this->datesFrom('2026-11-21', '2026-12-06'), $this->occurrenceDates());
    }

    public function test_occurrences_are_created_at_most_a_year_ahead(): void
    {
        $rule = RecurringTask::factory()->create(['user_id' => $this->user->id]);

        $this->calendar('2028-01')->assertExactJson(['calendarData' => []]);

        $dates = $this->occurrenceDates();
        $this->assertCount(366, $dates);
        $this->assertSame('2027-11-21', end($dates));
        $this->assertSame('2027-11-21', $rule->fresh()->generated_through->toDateString());
    }

    public function test_an_ended_rule_stops_creating_occurrences(): void
    {
        RecurringTask::factory()->create(['user_id' => $this->user->id, 'ends_on' => '2026-11-24']);

        $this->calendar('2026-11');

        $this->assertSame($this->datesFrom('2026-11-21', '2026-11-24'), $this->occurrenceDates());
    }

    public function test_a_deleted_or_moved_occurrence_is_not_created_again(): void
    {
        $this->addTask('2026-11-21', ['frequency' => 'daily']);
        $this->calendar('2026-11');

        $this->actingAs($this->user)->deleteJson(route('tasks.destroy', $this->occurrenceOn('2026-11-25')))->assertOk();
        $this->actingAs($this->user)->putJson(route('tasks.move', $this->occurrenceOn('2026-11-26')), [
            'date' => '2026-11-28',
        ])->assertOk();

        $this->calendar('2026-11');

        $dates = $this->occurrenceDates();
        $this->assertNotContains('2026-11-25', $dates);
        $this->assertNotContains('2026-11-26', $dates);
        $this->assertSame(2, array_count_values($dates)['2026-11-28']);
    }

    public function test_an_occurrence_can_be_edited_on_its_own(): void
    {
        $this->addTask('2026-11-21', ['frequency' => 'daily']);
        $this->calendar('2026-11');

        $this->actingAs($this->user)->putJson(route('tasks.update', $this->occurrenceOn('2026-11-23')), [
            'description' => 'Just this once',
        ])->assertOk()->assertJsonPath('recurrence.frequency', 'daily');

        $this->assertSame('Water plants', $this->occurrenceOn('2026-11-24')->description);
        $this->assertSame('Water plants', RecurringTask::sole()->description);
    }

    public function test_editing_a_task_and_the_following_ones_skips_earlier_and_finished_occurrences(): void
    {
        $this->addTask('2026-11-21', ['frequency' => 'daily']);
        $this->calendar('2026-11');
        $this->occurrenceOn('2026-11-24')->update(['is_finished' => true]);

        $this->updateSeries($this->occurrenceOn('2026-11-23'), ['frequency' => 'daily'], 'Water the cactus')
            ->assertOk()
            ->assertJsonPath('description', 'Water the cactus')
            ->assertJsonPath('priority', Priority::Urgent->value);

        $this->assertSame('Water plants', $this->occurrenceOn('2026-11-22')->description);
        $this->assertSame('Water the cactus', $this->occurrenceOn('2026-11-23')->description);
        $this->assertSame('Water plants', $this->occurrenceOn('2026-11-24')->description);
        $this->assertSame('Water the cactus', $this->occurrenceOn('2026-11-25')->description);
        $this->assertSame(Priority::Urgent, $this->occurrenceOn('2026-11-25')->priority);

        // New occurrences use the new description.
        $this->calendar('2026-12');
        $this->assertSame('Water the cactus', $this->occurrenceOn('2026-12-20')->description);
    }

    public function test_changing_the_schedule_replaces_the_later_unfinished_occurrences(): void
    {
        $this->addTask('2026-11-21', ['frequency' => 'daily']);
        $this->calendar('2026-11');
        $this->occurrenceOn('2026-11-27')->update(['is_finished' => true]);

        // Mon Nov 23: from now on, Mondays only.
        $this->updateSeries($this->occurrenceOn('2026-11-23'), ['frequency' => 'weekly', 'weekdays' => [1]])
            ->assertOk()
            ->assertJsonPath('recurrence.weekdays', [1]);

        $this->calendar('2026-11');

        $this->assertSame(
            ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-27', '2026-11-30'],
            $this->occurrenceDates(),
        );
        $this->assertSame('2026-11-23', RecurringTask::sole()->starts_on->toDateString());
    }

    public function test_a_new_schedule_must_include_the_tasks_day(): void
    {
        $this->addTask('2026-11-21', ['frequency' => 'daily']);
        $this->calendar('2026-11');

        $this->updateSeries($this->occurrenceOn('2026-11-23'), ['frequency' => 'weekly', 'weekdays' => [2]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('recurrence.weekdays');

        $this->assertSame(RepeatFrequency::Daily, RecurringTask::sole()->frequency);
        $this->assertSame(16, Task::count());
    }

    public function test_choosing_does_not_repeat_stops_the_series_after_the_task(): void
    {
        $this->addTask('2026-11-21', ['frequency' => 'daily']);
        $this->calendar('2026-11');
        $anchor = $this->occurrenceOn('2026-11-23');

        $this->updateSeries($anchor, null, 'Water plants')
            ->assertOk()
            ->assertJsonPath('recurrence', null);

        $this->assertSame(0, RecurringTask::count());
        $this->calendar('2026-11');
        $this->assertSame(
            ['2026-11-21', '2026-11-22', '2026-11-23'],
            Task::query()->join('calendar_days', 'calendar_days.id', '=', 'tasks.calendar_day_id')
                ->orderBy('calendar_days.date')->pluck('calendar_days.date')->all(),
        );
        $this->assertSame(0, Task::whereNotNull('recurring_task_id')->count());
    }

    public function test_a_one_off_task_can_be_made_to_repeat(): void
    {
        $task = Task::factory()
            ->for(CalendarDay::factory()->onDate('2026-11-21')->create(['user_id' => $this->user->id]))
            ->create(['description' => 'Water plants']);

        $this->updateSeries($task, ['frequency' => 'weekly', 'weekdays' => [6]], 'Water plants')
            ->assertOk()
            ->assertJsonPath('recurrence.frequency', 'weekly');

        $this->calendar('2026-11');

        $this->assertSame(['2026-11-21', '2026-11-28', '2026-12-05'], $this->occurrenceDates());
    }

    public function test_saving_a_series_requires_the_recurrence_field(): void
    {
        $task = Task::factory()
            ->for(CalendarDay::factory()->onDate('2026-11-21')->create(['user_id' => $this->user->id]))
            ->create();

        $this->actingAs($this->user)->putJson(route('tasks.series', $task), [
            'description' => 'Water plants',
            'priority' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('recurrence');
    }

    public function test_occurrences_are_never_offered_for_carry_over(): void
    {
        $rule = RecurringTask::factory()->startingOn('2026-11-10')->create(['user_id' => $this->user->id]);
        $day = CalendarDay::factory()->onDate('2026-11-15')->create(['user_id' => $this->user->id]);
        $occurrence = Task::factory()->for($day)->create(['recurring_task_id' => $rule->id, 'order' => 1]);
        $oneOff = Task::factory()->for($day)->create(['order' => 2]);

        $response = $this->actingAs($this->user)->getJson(route('tasks.unfinished'));

        $this->assertSame([$oneOff->id], array_column($response->json('unfinishedTasks.2026-11-15'), 'id'));

        $this->actingAs($this->user)->postJson(route('tasks.carry-over'), [
            'task_ids' => [$occurrence->id],
        ])->assertUnprocessable();
        $this->assertSame($day->id, $occurrence->fresh()->calendar_day_id);
    }

    public function test_users_cannot_change_another_users_series(): void
    {
        $this->addTask('2026-11-21', ['frequency' => 'daily']);
        $intruder = User::factory()->create();

        $this->actingAs($intruder)->putJson(route('tasks.series', Task::sole()), [
            'description' => 'Hacked',
            'priority' => 3,
            'recurrence' => null,
        ])->assertForbidden();

        $this->assertSame(1, RecurringTask::count());
        $this->assertSame('Water plants', Task::sole()->description);
    }

    public function test_reading_the_calendar_only_creates_the_users_own_occurrences(): void
    {
        $this->addTask('2026-11-21', ['frequency' => 'daily']);

        $this->actingAs(User::factory()->create())->getJson(route('api.calendar', ['month' => '2026-11']))
            ->assertExactJson(['calendarData' => []]);

        $this->assertSame(1, Task::count());
        $this->assertSame('2026-11-21', RecurringTask::sole()->generated_through->toDateString());
    }

    public function test_the_frontend_constants_match_the_enum(): void
    {
        $source = file_get_contents(resource_path('js/constants/recurrence.ts'));

        preg_match('/REPEAT_FREQUENCIES\s*=\s*\[([^\]]*)\]/', $source, $match);
        preg_match_all("/'([a-z]+)'/", $match[1] ?? '', $values);

        $this->assertSame(
            array_map(fn (RepeatFrequency $frequency) => $frequency->value, RepeatFrequency::cases()),
            $values[1],
            'resources/js/constants/recurrence.ts is out of sync with App\Enums\RepeatFrequency.',
        );
    }

    /**
     * @param  array<string, mixed>|null  $recurrence
     */
    private function addTask(string $date, ?array $recurrence)
    {
        return $this->actingAs($this->user)->postJson(route('tasks.store'), [
            'description' => 'Water plants',
            'date' => $date,
            'recurrence' => $recurrence,
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $recurrence
     */
    private function updateSeries(Task $task, ?array $recurrence, string $description = 'Water plants')
    {
        return $this->actingAs($this->user)->putJson(route('tasks.series', $task), [
            'description' => $description,
            'priority' => Priority::Urgent->value,
            'recurrence' => $recurrence,
        ]);
    }

    private function calendar(string $month)
    {
        return $this->actingAs($this->user)->getJson(route('api.calendar', ['month' => $month]));
    }

    /**
     * The dates of every recurring occurrence, oldest first.
     *
     * @return list<string>
     */
    private function occurrenceDates(): array
    {
        return Task::query()
            ->join('calendar_days', 'calendar_days.id', '=', 'tasks.calendar_day_id')
            ->whereNotNull('tasks.recurring_task_id')
            ->orderBy('calendar_days.date')
            ->pluck('calendar_days.date')
            ->all();
    }

    private function occurrenceOn(string $date): Task
    {
        return Task::query()
            ->select('tasks.*')
            ->join('calendar_days', 'calendar_days.id', '=', 'tasks.calendar_day_id')
            ->whereNotNull('tasks.recurring_task_id')
            ->where('calendar_days.date', $date)
            ->sole();
    }

    /**
     * @return list<string>
     */
    private function datesFrom(string $from, string $to): array
    {
        return collect(CarbonImmutable::parse($from)->daysUntil($to))
            ->map(fn ($date) => $date->toDateString())
            ->all();
    }
}

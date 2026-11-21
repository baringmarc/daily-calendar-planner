<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Carry-over rules from spec §3.5: only unfinished tasks from days strictly
 * before today, from any month, appended after today's tasks.
 */
class CarryOverTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-11-21 09:00:00');
        $this->user = User::factory()->create();
    }

    public function test_unfinished_lists_only_unfinished_tasks_from_before_today(): void
    {
        $lastYear = $this->day('2025-12-31');
        $yesterday = $this->day('2026-11-20');
        $today = $this->day('2026-11-21');
        $tomorrow = $this->day('2026-11-22');

        $old = $this->task($lastYear, ['order' => 1]);
        $second = $this->task($yesterday, ['order' => 2]);
        $first = $this->task($yesterday, ['order' => 1]);
        $this->task($yesterday, ['is_finished' => true]);
        $this->task($today);
        $this->task($tomorrow);

        $response = $this->actingAs($this->user)->getJson(route('tasks.unfinished'));

        $response->assertOk();
        $this->assertSame(['2025-12-31', '2026-11-20'], array_keys($response->json('unfinishedTasks')));
        $this->assertSame([$old->id], array_column($response->json('unfinishedTasks.2025-12-31'), 'id'));
        $this->assertSame([$first->id, $second->id], array_column($response->json('unfinishedTasks.2026-11-20'), 'id'));
        $response->assertJsonStructure(['unfinishedTasks' => ['2026-11-20' => [
            ['id', 'description', 'is_finished', 'calendar_day_id', 'priority', 'order'],
        ]]]);
    }

    public function test_unfinished_is_an_empty_object_when_there_is_nothing_to_carry_over(): void
    {
        $this->task($this->day('2026-11-21'));

        $response = $this->actingAs($this->user)->getJson(route('tasks.unfinished'));

        $response->assertOk();
        $this->assertSame('{"unfinishedTasks":{}}', $response->getContent());
    }

    public function test_unfinished_does_not_include_other_users_tasks(): void
    {
        $other = User::factory()->create();
        $this->task(CalendarDay::factory()->create(['user_id' => $other->id, 'date' => '2026-11-20']));

        $this->actingAs($this->user)->getJson(route('tasks.unfinished'))
            ->assertOk()
            ->assertExactJson(['unfinishedTasks' => []]);
    }

    public function test_carry_over_appends_tasks_after_todays_existing_tasks(): void
    {
        $today = $this->day('2026-11-21');
        $this->task($today, ['order' => 1]);
        $this->task($today, ['order' => 2]);

        $older = $this->task($this->day('2026-10-02'), ['order' => 1]);
        $newer = $this->task($this->day('2026-11-20'), ['order' => 1]);

        $response = $this->actingAs($this->user)->postJson(route('tasks.carry-over'), [
            'task_ids' => [$newer->id, $older->id],
        ]);

        $response->assertOk()->assertJsonCount(2);

        // Oldest day first, after today's two tasks.
        $this->assertSame([$today->id, 3], [(int) $older->fresh()->calendar_day_id, (int) $older->fresh()->order]);
        $this->assertSame([$today->id, 4], [(int) $newer->fresh()->calendar_day_id, (int) $newer->fresh()->order]);
    }

    public function test_carry_over_creates_todays_day_when_it_does_not_exist(): void
    {
        $task = $this->task($this->day('2026-11-20'));

        $this->actingAs($this->user)->postJson(route('tasks.carry-over'), ['task_ids' => [$task->id]])
            ->assertOk();

        $today = $this->user->calendarDays()->where('date', '2026-11-21')->firstOrFail();
        $this->assertSame([$today->id, 1], [(int) $task->fresh()->calendar_day_id, (int) $task->fresh()->order]);
    }

    public function test_carry_over_rejects_future_tasks(): void
    {
        $past = $this->task($this->day('2026-11-20'));
        $future = $this->task($this->day('2026-11-25'));

        $this->actingAs($this->user)->postJson(route('tasks.carry-over'), ['task_ids' => [$past->id, $future->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('task_ids');

        $this->assertSame('2026-11-20', $past->fresh()->calendarDay->date);
        $this->assertSame('2026-11-25', $future->fresh()->calendarDay->date);
    }

    public function test_carry_over_rejects_tasks_already_on_today(): void
    {
        $task = $this->task($this->day('2026-11-21'));

        $this->actingAs($this->user)->postJson(route('tasks.carry-over'), ['task_ids' => [$task->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('task_ids');
    }

    public function test_carry_over_rejects_finished_tasks(): void
    {
        $task = $this->task($this->day('2026-11-20'), ['is_finished' => true]);

        $this->actingAs($this->user)->postJson(route('tasks.carry-over'), ['task_ids' => [$task->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('task_ids');

        $this->assertSame('2026-11-20', $task->fresh()->calendarDay->date);
        $this->assertSame(1, $this->user->calendarDays()->count());
    }

    public function test_carry_over_requires_a_non_empty_list_of_task_ids(): void
    {
        $this->actingAs($this->user)->postJson(route('tasks.carry-over'), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('task_ids');

        $this->actingAs($this->user)->postJson(route('tasks.carry-over'), ['task_ids' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('task_ids');

        $this->actingAs($this->user)->postJson(route('tasks.carry-over'), ['task_ids' => ['abc']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('task_ids.0');
    }

    private function day(string $date): CalendarDay
    {
        return CalendarDay::factory()->create(['user_id' => $this->user->id, 'date' => $date]);
    }

    private function task(CalendarDay $day, array $attributes = []): Task
    {
        return Task::factory()->create(['calendar_day_id' => $day->id, ...$attributes]);
    }
}

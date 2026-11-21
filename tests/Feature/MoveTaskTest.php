<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Moving a task to another date (FEAT-02).
 */
class MoveTaskTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
    }

    public function test_a_task_moves_to_the_end_of_the_target_day(): void
    {
        $from = $this->day('2026-11-21');
        $to = $this->day('2026-11-24');
        $task = Task::factory()->for($from)->create(['order' => 1]);
        $left = Task::factory()->for($from)->create(['order' => 2]);
        Task::factory()->for($to)->create(['order' => 1]);
        Task::factory()->for($to)->create(['order' => 2]);

        $response = $this->actingAs($this->user)->putJson(route('tasks.move', $task), [
            'date' => '2026-11-24',
        ]);

        $response->assertOk()
            ->assertJsonPath('id', $task->id)
            ->assertJsonPath('calendar_day_id', $to->id)
            ->assertJsonPath('order', 3);
        $this->assertSame([$left->id], $from->tasks()->pluck('id')->all());
        $this->assertSame(3, $to->tasks()->count());
    }

    public function test_moving_to_a_date_without_a_day_creates_it(): void
    {
        $task = Task::factory()->for($this->day('2026-11-21'))->create();

        $this->actingAs($this->user)->putJson(route('tasks.move', $task), [
            'date' => '2027-01-05',
        ])->assertOk()->assertJsonPath('order', 1);

        $day = $this->user->calendarDays()->where('date', '2027-01-05')->sole();
        $this->assertSame($day->id, $task->fresh()->calendar_day_id);
    }

    public function test_moving_a_finished_task_keeps_it_finished(): void
    {
        $task = Task::factory()->finished()->for($this->day('2026-11-21'))->create();

        $this->actingAs($this->user)->putJson(route('tasks.move', $task), [
            'date' => '2026-11-22',
        ])->assertOk()->assertJsonPath('is_finished', true);
    }

    public function test_moving_a_task_to_its_own_day_changes_nothing(): void
    {
        $day = $this->day('2026-11-21');
        $task = Task::factory()->for($day)->create(['order' => 1]);
        Task::factory()->for($day)->create(['order' => 2]);

        $this->actingAs($this->user)->putJson(route('tasks.move', $task), [
            'date' => '2026-11-21',
        ])->assertOk()->assertJsonPath('order', 1);

        $this->assertSame(1, $task->fresh()->order);
    }

    public function test_the_date_must_be_a_real_date(): void
    {
        $task = Task::factory()->for($this->day('2026-11-21'))->create();

        foreach ([null, 'tomorrow', '2026-02-30', '2026-11'] as $date) {
            $this->actingAs($this->user)->putJson(route('tasks.move', $task), [
                'date' => $date,
            ])->assertUnprocessable()->assertJsonValidationErrors('date');
        }

        $this->assertSame(1, $this->user->calendarDays()->count());
    }

    private function day(string $date): CalendarDay
    {
        return CalendarDay::factory()->onDate($date)->create(['user_id' => $this->user->id]);
    }
}

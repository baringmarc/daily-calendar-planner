<?php

namespace Tests\Feature;

use App\Enums\Priority;
use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskUpdateTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $day = CalendarDay::factory()->create(['user_id' => $this->user->id, 'date' => '2026-11-21']);
        $this->task = Task::factory()->create([
            'calendar_day_id' => $day->id,
            'description' => 'Original',
            'priority' => 1,
            'order' => 1,
        ]);
    }

    public function test_description_and_priority_can_be_updated(): void
    {
        $this->actingAs($this->user)
            ->putJson(route('tasks.update', $this->task), ['description' => 'Edited', 'priority' => 3])
            ->assertOk()
            ->assertJsonPath('description', 'Edited');

        $task = $this->task->fresh();
        $this->assertSame('Edited', $task->description);
        $this->assertSame(Priority::Urgent, $task->priority);
    }

    /**
     * The client used to send the whole task back, including a `date` that
     * no longer exists as a column, which made the update query fail.
     */
    public function test_date_and_order_are_ignored_instead_of_failing(): void
    {
        $this->actingAs($this->user)
            ->putJson(route('tasks.update', $this->task), [
                'description' => 'Edited',
                'date' => '2026-11-25',
                'order' => 9,
            ])
            ->assertOk();

        $task = $this->task->fresh();
        $this->assertSame('Edited', $task->description);
        $this->assertSame(1, (int) $task->order);
        $this->assertSame('2026-11-21', $task->calendarDay->date);
    }
}

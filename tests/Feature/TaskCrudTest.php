<?php

namespace Tests\Feature;

use App\Enums\Priority;
use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Adding, checking off and deleting tasks (spec §3.2, §5).
 */
class TaskCrudTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
    }

    public function test_adding_a_task_creates_the_day_when_it_does_not_exist(): void
    {
        $response = $this->actingAs($this->user)->postJson(route('tasks.store'), [
            'description' => 'Buy milk',
            'date' => '2026-11-21',
            'priority' => 2,
        ]);

        $response->assertCreated()
            ->assertJsonPath('description', 'Buy milk')
            ->assertJsonPath('order', 1);

        $day = $this->user->calendarDays()->where('date', '2026-11-21')->sole();
        $task = Task::sole();
        $this->assertSame($day->id, (int) $task->calendar_day_id);
        $this->assertSame(Priority::High, $task->priority);
        $this->assertFalse((bool) $task->is_finished);
    }

    public function test_adding_a_task_appends_it_to_the_existing_day(): void
    {
        $day = CalendarDay::factory()->onDate('2026-11-21')->create(['user_id' => $this->user->id]);
        Task::factory()->for($day)->create(['order' => 1]);
        Task::factory()->for($day)->create(['order' => 2]);

        $this->actingAs($this->user)->postJson(route('tasks.store'), [
            'description' => 'Third',
            'date' => '2026-11-21',
        ])->assertCreated()->assertJsonPath('order', 3);

        $this->assertSame(1, $this->user->calendarDays()->count());
        $this->assertSame(3, $day->tasks()->count());
    }

    public function test_adding_a_task_requires_a_description_of_at_most_255_characters(): void
    {
        $this->actingAs($this->user)->postJson(route('tasks.store'), [
            'date' => '2026-11-21',
        ])->assertUnprocessable()->assertJsonValidationErrors('description');

        $this->actingAs($this->user)->postJson(route('tasks.store'), [
            'description' => str_repeat('a', 256),
            'date' => '2026-11-21',
        ])->assertUnprocessable()->assertJsonValidationErrors('description');

        $this->assertSame(0, Task::count());
    }

    public function test_a_task_can_be_checked_off_and_back(): void
    {
        $task = Task::factory()
            ->for(CalendarDay::factory()->create(['user_id' => $this->user->id]))
            ->create();

        $this->actingAs($this->user)
            ->putJson(route('tasks.update', $task), ['is_finished' => true])
            ->assertOk();
        $this->assertTrue((bool) $task->fresh()->is_finished);

        $this->actingAs($this->user)
            ->putJson(route('tasks.update', $task), ['is_finished' => false])
            ->assertOk();
        $this->assertFalse((bool) $task->fresh()->is_finished);
    }

    public function test_a_task_can_be_deleted(): void
    {
        $day = CalendarDay::factory()->create(['user_id' => $this->user->id]);
        $task = Task::factory()->for($day)->create();
        $other = Task::factory()->for($day)->create(['order' => 2]);

        $this->actingAs($this->user)
            ->deleteJson(route('tasks.destroy', $task))
            ->assertOk();

        $this->assertModelMissing($task);
        $this->assertModelExists($other);
        $this->assertModelExists($day);
    }

    public function test_deleting_a_missing_task_is_a_404(): void
    {
        $this->actingAs($this->user)
            ->deleteJson(route('tasks.destroy', 999))
            ->assertNotFound();
    }
}

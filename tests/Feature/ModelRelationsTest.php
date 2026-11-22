<?php

namespace Tests\Feature;

use App\Enums\Priority;
use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModelRelationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_calendar_day_belongs_to_its_user(): void
    {
        $user = User::factory()->create();
        $day = CalendarDay::factory()->for($user)->create();

        $this->assertTrue($day->user->is($user));
    }

    public function test_a_user_has_tasks_through_their_calendar_days(): void
    {
        $user = User::factory()->create();
        $mine = Task::factory()->count(2)->for(CalendarDay::factory()->for($user))->create();
        $alsoMine = Task::factory()->for(CalendarDay::factory()->for($user))->create();
        Task::factory()->create();

        $this->assertEqualsCanonicalizing(
            [...$mine->modelKeys(), $alsoMine->id],
            $user->tasks()->pluck('tasks.id')->all(),
        );
    }

    public function test_task_attributes_are_cast(): void
    {
        $task = Task::factory()->finished()->priority(Priority::High)->create()->fresh();

        $this->assertTrue($task->is_finished);
        $this->assertSame(Priority::High, $task->priority);
        $this->assertIsInt($task->order);
        $this->assertIsInt($task->calendar_day_id);
    }
}

<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Drag-to-reorder within a day (spec §3.2, PUT /api/tasks/reorder).
 */
class ReorderTest extends TestCase
{
    use RefreshDatabase;

    public function test_reorder_rewrites_order_as_one_to_n(): void
    {
        $user = User::factory()->create();
        $day = CalendarDay::factory()->onDate('2026-11-21')->create(['user_id' => $user->id]);
        // Gaps and duplicates in the stored order are normalised.
        $a = Task::factory()->for($day)->create(['order' => 1]);
        $b = Task::factory()->for($day)->create(['order' => 5]);
        $c = Task::factory()->for($day)->create(['order' => 5]);

        $this->actingAs($user)->putJson(route('tasks.reorder'), [
            'tasks' => [['id' => $c->id], ['id' => $a->id], ['id' => $b->id]],
        ])->assertOk();

        $this->assertSame(1, (int) $c->fresh()->order);
        $this->assertSame(2, (int) $a->fresh()->order);
        $this->assertSame(3, (int) $b->fresh()->order);
    }

    public function test_the_calendar_returns_tasks_in_the_new_order(): void
    {
        $user = User::factory()->create();
        $day = CalendarDay::factory()->onDate('2026-11-21')->create(['user_id' => $user->id]);
        $a = Task::factory()->for($day)->create(['order' => 1]);
        $b = Task::factory()->for($day)->create(['order' => 2]);

        $this->actingAs($user)->putJson(route('tasks.reorder'), [
            'tasks' => [['id' => $b->id], ['id' => $a->id]],
        ])->assertOk();

        $response = $this->actingAs($user)->getJson(route('api.calendar', ['month' => '2026-11']));

        $this->assertSame(
            [$b->id, $a->id],
            array_column($response->json('calendarData.2026-11-21.tasks'), 'id'),
        );
    }
}

<?php

namespace Tests\Feature;

use App\Enums\Priority;
use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A user can only read or modify their own calendar days and tasks (spec §6.1).
 */
class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $intruder;

    private CalendarDay $ownerDay;

    private Task $ownerTask;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->intruder = User::factory()->create();

        $this->ownerDay = CalendarDay::factory()->create(['user_id' => $this->owner->id,
            'date' => '2026-11-10',
            'note' => 'Owner note',
        ]);
        $this->ownerTask = Task::factory()->for($this->ownerDay)->create([
            'description' => 'Owner task',
            'priority' => 1,
            'order' => 1,
        ]);
    }

    public function test_calendar_only_returns_the_users_own_days(): void
    {
        $intruderDay = CalendarDay::factory()->create(['user_id' => $this->intruder->id, 'date' => '2026-11-11']);
        Task::factory()->for($intruderDay)->create();

        $response = $this->actingAs($this->intruder)->getJson(route('api.calendar', ['month' => '2026-11']));

        $response->assertOk()
            ->assertJsonMissingPath('calendarData.2026-11-10')
            ->assertJsonPath('calendarData.2026-11-11.calendar_day.id', $intruderDay->id);
    }

    public function test_user_can_update_their_own_task(): void
    {
        $response = $this->actingAs($this->owner)->putJson(route('tasks.update', $this->ownerTask), [
            'description' => 'Renamed',
        ]);

        $response->assertOk();
        $this->assertSame('Renamed', $this->ownerTask->fresh()->description);
    }

    public function test_user_cannot_update_another_users_task(): void
    {
        $response = $this->actingAs($this->intruder)->putJson(route('tasks.update', $this->ownerTask), [
            'description' => 'Hacked',
            'is_finished' => true,
            'priority' => 3,
        ]);

        $response->assertForbidden();

        $task = $this->ownerTask->fresh();
        $this->assertSame('Owner task', $task->description);
        $this->assertFalse((bool) $task->is_finished);
        $this->assertSame(Priority::Medium, $task->priority);
    }

    public function test_user_can_delete_their_own_task(): void
    {
        $response = $this->actingAs($this->owner)->deleteJson(route('tasks.destroy', $this->ownerTask));

        $response->assertOk();
        $this->assertModelMissing($this->ownerTask);
    }

    public function test_user_cannot_delete_another_users_task(): void
    {
        $response = $this->actingAs($this->intruder)->deleteJson(route('tasks.destroy', $this->ownerTask));

        $response->assertForbidden();
        $this->assertModelExists($this->ownerTask);
    }

    public function test_user_can_update_their_own_calendar_day(): void
    {
        $response = $this->actingAs($this->owner)->putJson(route('calendar-days.update', $this->ownerDay), [
            'note' => 'Updated note',
        ]);

        $response->assertOk();
        $this->assertSame('Updated note', $this->ownerDay->fresh()->note);
    }

    public function test_user_cannot_update_another_users_calendar_day(): void
    {
        $response = $this->actingAs($this->intruder)->putJson(route('calendar-days.update', $this->ownerDay), [
            'note' => 'Hacked',
        ]);

        $response->assertForbidden();
        $this->assertSame('Owner note', $this->ownerDay->fresh()->note);
    }

    public function test_creating_a_calendar_day_ignores_a_foreign_user_id(): void
    {
        $response = $this->actingAs($this->intruder)->postJson(route('calendar-days.store'), [
            'user_id' => $this->owner->id,
            'date' => '2026-11-12',
            'note' => 'Mine',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('calendar_days', ['date' => '2026-11-12', 'user_id' => $this->intruder->id]);
        $this->assertDatabaseMissing('calendar_days', ['date' => '2026-11-12', 'user_id' => $this->owner->id]);
    }

    public function test_creating_a_task_on_a_date_another_user_has_uses_the_users_own_day(): void
    {
        $response = $this->actingAs($this->intruder)->postJson(route('tasks.store'), [
            'description' => 'Intruder task',
            'date' => '2026-11-10',
            'priority' => 1,
        ]);

        $response->assertCreated();

        $task = Task::findOrFail($response->json('id'));
        $this->assertNotSame($this->ownerDay->id, (int) $task->calendar_day_id);
        $this->assertSame($this->intruder->id, (int) $task->calendarDay->user_id);
        $this->assertSame(1, $this->ownerDay->tasks()->count());
    }

    public function test_user_can_reorder_their_own_tasks(): void
    {
        $second = Task::factory()->for($this->ownerDay)->create(['order' => 2]);

        $response = $this->actingAs($this->owner)->putJson(route('tasks.reorder'), [
            'tasks' => [['id' => $second->id], ['id' => $this->ownerTask->id]],
        ]);

        $response->assertOk();
        $this->assertSame(1, (int) $second->fresh()->order);
        $this->assertSame(2, (int) $this->ownerTask->fresh()->order);
    }

    public function test_user_cannot_reorder_another_users_tasks(): void
    {
        $response = $this->actingAs($this->intruder)->putJson(route('tasks.reorder'), [
            'tasks' => [['id' => $this->ownerTask->id]],
        ]);

        $response->assertForbidden();
        $this->assertSame(1, (int) $this->ownerTask->fresh()->order);
    }

    public function test_reorder_with_a_mix_of_owned_and_foreign_ids_changes_nothing(): void
    {
        $intruderDay = CalendarDay::factory()->create(['user_id' => $this->intruder->id, 'date' => '2026-11-10']);
        $intruderTask = Task::factory()->for($intruderDay)->create(['order' => 1]);

        $response = $this->actingAs($this->intruder)->putJson(route('tasks.reorder'), [
            'tasks' => [['id' => $this->ownerTask->id], ['id' => $intruderTask->id]],
        ]);

        $response->assertForbidden();
        $this->assertSame(1, (int) $this->ownerTask->fresh()->order);
        $this->assertSame(1, (int) $intruderTask->fresh()->order);
    }

    public function test_user_can_carry_over_their_own_tasks_to_today(): void
    {
        $this->travelTo('2026-11-21 09:00:00');

        $response = $this->actingAs($this->owner)->postJson(route('tasks.carry-over'), [
            'task_ids' => [$this->ownerTask->id],
        ]);

        $response->assertOk();

        $today = $this->owner->calendarDays()->where('date', '2026-11-21')->firstOrFail();
        $this->assertSame($today->id, (int) $this->ownerTask->fresh()->calendar_day_id);
    }

    public function test_user_cannot_carry_over_another_users_tasks(): void
    {
        $response = $this->actingAs($this->intruder)->postJson(route('tasks.carry-over'), [
            'task_ids' => [$this->ownerTask->id],
        ]);

        $response->assertForbidden();
        $this->assertSame($this->ownerDay->id, (int) $this->ownerTask->fresh()->calendar_day_id);
        $this->assertSame(0, $this->intruder->calendarDays()->count());
    }

    public function test_carry_over_with_a_mix_of_owned_and_foreign_ids_moves_nothing(): void
    {
        $intruderDay = CalendarDay::factory()->create(['user_id' => $this->intruder->id, 'date' => '2026-11-09']);
        $intruderTask = Task::factory()->for($intruderDay)->create();

        $response = $this->actingAs($this->intruder)->postJson(route('tasks.carry-over'), [
            'task_ids' => [$intruderTask->id, $this->ownerTask->id],
        ]);

        $response->assertForbidden();
        $this->assertSame($this->ownerDay->id, (int) $this->ownerTask->fresh()->calendar_day_id);
        $this->assertSame($intruderDay->id, (int) $intruderTask->fresh()->calendar_day_id);
    }

    public function test_carry_over_cannot_target_another_users_calendar_day(): void
    {
        $this->travelTo('2026-11-21 09:00:00');

        $intruderDay = CalendarDay::factory()->create(['user_id' => $this->intruder->id, 'date' => '2026-11-09']);
        $intruderTask = Task::factory()->for($intruderDay)->create();

        $response = $this->actingAs($this->intruder)->postJson(route('tasks.carry-over'), [
            'task_ids' => [$intruderTask->id],
            'calendar_day_id' => $this->ownerDay->id,
        ]);

        $response->assertOk();

        $this->assertSame(1, $this->ownerDay->tasks()->count());

        $today = $this->intruder->calendarDays()->where('date', '2026-11-21')->firstOrFail();
        $this->assertSame($today->id, (int) $intruderTask->fresh()->calendar_day_id);
    }
}

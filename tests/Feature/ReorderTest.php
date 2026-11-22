<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
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

    public function test_reorder_writes_the_new_order_in_a_single_update(): void
    {
        $user = User::factory()->create();
        $day = CalendarDay::factory()->create(['user_id' => $user->id]);
        $tasks = Task::factory()->for($day)->count(5)->sequence(fn ($sequence) => ['order' => $sequence->index + 1])->create();

        DB::enableQueryLog();

        $this->actingAs($user)->putJson(route('tasks.reorder'), [
            'tasks' => $tasks->reverse()->map(fn (Task $task) => ['id' => $task->id])->values()->all(),
        ])->assertOk();

        $updates = collect(DB::getQueryLog())->filter(fn (array $query) => Str::startsWith(strtolower($query['query']), 'update'));
        $this->assertCount(1, $updates);
        $this->assertSame([5, 4, 3, 2, 1], $tasks->map(fn (Task $task) => (int) $task->fresh()->order)->all());
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidPayloads(): array
    {
        return [
            'missing tasks' => [[], 'tasks'],
            'empty tasks' => [['tasks' => []], 'tasks'],
            'tasks is not an array' => [['tasks' => 'nope'], 'tasks'],
            'missing id' => [['tasks' => [['order' => 1]]], 'tasks.0.id'],
            'unknown id' => [['tasks' => [['id' => 999]]], 'tasks.0.id'],
        ];
    }

    #[DataProvider('invalidPayloads')]
    public function test_reorder_rejects_an_invalid_payload(array $payload, string $errorKey): void
    {
        $this->actingAs(User::factory()->create())
            ->putJson(route('tasks.reorder'), $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors($errorKey);
    }

    public function test_reorder_rejects_duplicate_ids(): void
    {
        $user = User::factory()->create();
        $task = Task::factory()->for(CalendarDay::factory()->create(['user_id' => $user->id]))->create();

        $this->actingAs($user)
            ->putJson(route('tasks.reorder'), ['tasks' => [['id' => $task->id], ['id' => $task->id]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('tasks.0.id');
    }

    public function test_reorder_rejects_tasks_from_different_days_and_changes_nothing(): void
    {
        $user = User::factory()->create();
        $monday = CalendarDay::factory()->onDate('2026-11-16')->create(['user_id' => $user->id]);
        $tuesday = CalendarDay::factory()->onDate('2026-11-17')->create(['user_id' => $user->id]);
        $a = Task::factory()->for($monday)->create(['order' => 1]);
        $b = Task::factory()->for($tuesday)->create(['order' => 1]);

        $this->actingAs($user)
            ->putJson(route('tasks.reorder'), ['tasks' => [['id' => $b->id], ['id' => $a->id]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('tasks');

        $this->assertSame(1, (int) $a->fresh()->order);
        $this->assertSame(1, (int) $b->fresh()->order);
    }
}

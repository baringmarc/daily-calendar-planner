<?php

namespace Tests\Feature;

use App\Enums\Priority;
use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Invalid input returns a 422, never a 500 (spec §6.1).
 */
class ValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
    }

    /**
     * @return array<string, array{string}>
     */
    public static function invalidMonths(): array
    {
        return [
            'garbage' => ['garbage'],
            'month out of range' => ['2026-13'],
            'full date' => ['2026-11-21'],
        ];
    }

    #[DataProvider('invalidMonths')]
    public function test_calendar_rejects_an_invalid_month(string $month): void
    {
        $this->actingAs($this->user)
            ->getJson(route('api.calendar', ['month' => $month]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('month');
    }

    public function test_creating_a_task_without_a_priority_defaults_to_medium(): void
    {
        $response = $this->actingAs($this->user)->postJson(route('tasks.store'), [
            'description' => 'No priority',
            'date' => '2026-11-21',
        ]);

        $response->assertCreated();
        $this->assertSame(Priority::Medium, Task::findOrFail($response->json('id'))->priority);
    }

    /**
     * @return array<string, array{mixed}>
     */
    public static function invalidPriorities(): array
    {
        return [
            'too high' => [7],
            'negative' => [-1],
            'not a number' => ['urgent'],
        ];
    }

    #[DataProvider('invalidPriorities')]
    public function test_creating_a_task_rejects_an_invalid_priority(mixed $priority): void
    {
        $this->actingAs($this->user)
            ->postJson(route('tasks.store'), [
                'description' => 'Bad priority',
                'date' => '2026-11-21',
                'priority' => $priority,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('priority');

        $this->assertSame(0, Task::count());
    }

    #[DataProvider('invalidPriorities')]
    public function test_updating_a_task_rejects_an_invalid_priority(mixed $priority): void
    {
        $day = CalendarDay::factory()->create(['user_id' => $this->user->id]);
        $task = Task::factory()->create(['calendar_day_id' => $day->id, 'priority' => 2]);

        $this->actingAs($this->user)
            ->putJson(route('tasks.update', $task), ['priority' => $priority])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('priority');

        $this->assertSame(Priority::High, $task->fresh()->priority);
    }

    public function test_creating_a_task_rejects_a_date_that_is_not_y_m_d(): void
    {
        $this->actingAs($this->user)
            ->postJson(route('tasks.store'), [
                'description' => 'Fuzzy date',
                'date' => 'tomorrow',
                'priority' => 1,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date');
    }
}

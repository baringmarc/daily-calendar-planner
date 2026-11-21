<?php

namespace Database\Factories;

use App\Models\CalendarDay;
use App\Models\Task;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'calendar_day_id' => CalendarDay::factory(),
            'description' => fake()->sentence(4),
            'is_finished' => false,
            // Medium, matching the column default (spec decision D3)
            'priority' => 1,
            'order' => 1,
        ];
    }

    public function finished(): static
    {
        return $this->state(fn () => ['is_finished' => true]);
    }

    /**
     * 0 = Low, 1 = Medium, 2 = High, 3 = Urgent.
     */
    public function priority(int $priority): static
    {
        return $this->state(fn () => ['priority' => $priority]);
    }
}

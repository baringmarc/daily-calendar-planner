<?php

namespace Database\Factories;

use App\Enums\Priority;
use App\Enums\RepeatFrequency;
use App\Models\RecurringTask;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RecurringTask>
 */
class RecurringTaskFactory extends Factory
{
    /**
     * A daily rule starting today, with no occurrences created yet.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'description' => fake()->sentence(3),
            'priority' => Priority::DEFAULT,
            'frequency' => RepeatFrequency::Daily,
            'interval' => 1,
            'weekdays' => null,
            'starts_on' => now()->toDateString(),
            'ends_on' => null,
            'generated_through' => null,
        ];
    }

    /**
     * Every `interval` weeks on the given days (0 = Sunday ... 6 = Saturday).
     *
     * @param  list<int>  $weekdays
     */
    public function weekly(array $weekdays, int $interval = 1): static
    {
        return $this->state(fn () => [
            'frequency' => RepeatFrequency::Weekly,
            'weekdays' => $weekdays,
            'interval' => $interval,
        ]);
    }

    public function monthly(int $interval = 1): static
    {
        return $this->state(fn () => [
            'frequency' => RepeatFrequency::Monthly,
            'interval' => $interval,
        ]);
    }

    public function startingOn(string $date): static
    {
        return $this->state(fn () => ['starts_on' => $date]);
    }
}

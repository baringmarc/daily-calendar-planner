<?php

namespace Database\Factories;

use App\Models\CalendarDay;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CalendarDay>
 */
class CalendarDayFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'date' => fake()->unique()->dateTimeBetween('-1 month', '+1 month')->format('Y-m-d'),
            'note' => null,
        ];
    }

    /**
     * A day on the given date (Y-m-d).
     */
    public function onDate(string $date): static
    {
        return $this->state(fn () => ['date' => $date]);
    }

    /**
     * A day strictly before today, in the app time zone.
     */
    public function past(): static
    {
        return $this->state(fn () => [
            'date' => fake()->unique()->dateTimeBetween('-1 month', '-1 day')->format('Y-m-d'),
        ]);
    }

    /**
     * A day strictly after today, in the app time zone.
     */
    public function future(): static
    {
        return $this->state(fn () => [
            'date' => fake()->unique()->dateTimeBetween('+1 day', '+1 month')->format('Y-m-d'),
        ]);
    }

    public function withNote(?string $note = null): static
    {
        return $this->state(fn () => ['note' => $note ?? fake()->paragraph()]);
    }
}

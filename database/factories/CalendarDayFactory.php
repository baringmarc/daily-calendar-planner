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
            'date' => self::uniqueDate(-30, 30),
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
            'date' => self::uniqueDate(-30, -1),
        ]);
    }

    /**
     * A day strictly after today, in the app time zone.
     */
    public function future(): static
    {
        return $this->state(fn () => [
            'date' => self::uniqueDate(1, 30),
        ]);
    }

    /**
     * A date between $fromDays and $toDays days from today that no other day
     * in this test has used. The offset is what's unique: making a random
     * DateTime unique doesn't stop two of them falling on the same date,
     * which breaks the (user_id, date) unique index.
     */
    private static function uniqueDate(int $fromDays, int $toDays): string
    {
        return now()->addDays(fake()->unique()->numberBetween($fromDays, $toDays))->toDateString();
    }

    public function withNote(?string $note = null): static
    {
        return $this->state(fn () => ['note' => $note ?? fake()->paragraph()]);
    }
}

<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CalendarDayNoteTest extends TestCase
{
    use RefreshDatabase;

    public function test_note_column_is_text_so_it_fits_the_validation_limit(): void
    {
        $this->assertSame('text', Schema::getColumnType('calendar_days', 'note'));
    }

    public function test_a_500_character_note_is_saved_in_full(): void
    {
        $user = User::factory()->create();
        $day = CalendarDay::factory()->create(['user_id' => $user->id]);
        $note = str_repeat('a', 500);

        $this->actingAs($user)
            ->putJson(route('calendar-days.update', $day), ['note' => $note])
            ->assertOk();

        $this->assertSame($note, $day->fresh()->note);
    }

    public function test_a_note_over_500_characters_is_rejected(): void
    {
        $user = User::factory()->create();
        $day = CalendarDay::factory()->create(['user_id' => $user->id, 'note' => 'Keep me']);

        $this->actingAs($user)
            ->putJson(route('calendar-days.update', $day), ['note' => str_repeat('a', 501)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('note');

        $this->assertSame('Keep me', $day->fresh()->note);
    }

    public function test_saving_a_note_on_a_day_without_one_creates_the_day(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson(route('calendar-days.store'), ['date' => '2026-11-21', 'note' => 'First note'])
            ->assertCreated()
            ->assertJsonPath('note', 'First note');

        $this->assertSame('First note', $user->calendarDays()->where('date', '2026-11-21')->sole()->note);
    }

    public function test_a_user_cannot_create_the_same_day_twice(): void
    {
        $user = User::factory()->create();
        CalendarDay::factory()->onDate('2026-11-21')->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->postJson(route('calendar-days.store'), ['date' => '2026-11-21', 'note' => 'Again'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date');

        $this->assertSame(1, $user->calendarDays()->count());
    }

    public function test_two_users_can_each_have_a_day_on_the_same_date(): void
    {
        CalendarDay::factory()->onDate('2026-11-21')->create();
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson(route('calendar-days.store'), ['date' => '2026-11-21', 'note' => 'Mine'])
            ->assertCreated();
    }

    public function test_a_note_can_be_cleared(): void
    {
        $user = User::factory()->create();
        $day = CalendarDay::factory()->withNote('Old')->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->putJson(route('calendar-days.update', $day), ['note' => ''])
            ->assertOk();

        $this->assertEmpty($day->fresh()->note);
    }
}

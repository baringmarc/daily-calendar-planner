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
}

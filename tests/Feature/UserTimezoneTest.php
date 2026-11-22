<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Without a stored time zone, "today" is worked out in the zone the browser
 * sends in X-Timezone. A stored one wins (see Settings\CalendarSettingsTest).
 */
class UserTimezoneTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Task $task;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $day = CalendarDay::factory()->create(['user_id' => $this->user->id, 'date' => '2026-11-10']);
        $this->task = Task::factory()->create(['calendar_day_id' => $day->id]);
    }

    public function test_carry_over_uses_the_browsers_time_zone_for_today(): void
    {
        // 20:00 UTC on Nov 21 is already 05:00 on Nov 22 in Tokyo.
        $this->travelTo('2026-11-21 20:00:00');

        $this->carryOver(['X-Timezone' => 'Asia/Tokyo'])->assertOk();

        $this->assertSame('2026-11-22', $this->task->fresh()->calendarDay->date);
    }

    public function test_carry_over_falls_back_to_the_app_time_zone_without_a_header(): void
    {
        $this->travelTo('2026-11-21 20:00:00');

        $this->carryOver()->assertOk();

        $this->assertSame('2026-11-21', $this->task->fresh()->calendarDay->date);
    }

    public function test_carry_over_ignores_an_invalid_time_zone(): void
    {
        $this->travelTo('2026-11-21 20:00:00');

        $this->carryOver(['X-Timezone' => 'Mars/Olympus_Mons'])->assertOk();

        $this->assertSame('2026-11-21', $this->task->fresh()->calendarDay->date);
    }

    public function test_calendar_defaults_to_the_current_month_in_the_browsers_time_zone(): void
    {
        // 20:00 UTC on Nov 30 is already December in Tokyo.
        $this->travelTo('2026-11-30 20:00:00');
        CalendarDay::factory()->create(['user_id' => $this->user->id, 'date' => '2026-12-15']);

        $response = $this->actingAs($this->user)
            ->withHeaders(['X-Timezone' => 'Asia/Tokyo'])
            ->getJson(route('api.calendar'));

        $response->assertOk();
        $this->assertArrayHasKey('2026-12-15', $response->json('calendarData'));
    }

    private function carryOver(array $headers = [])
    {
        return $this->actingAs($this->user)
            ->withHeaders($headers)
            ->postJson(route('tasks.carry-over'), [
                'task_ids' => [$this->task->id],
            ]);
    }
}

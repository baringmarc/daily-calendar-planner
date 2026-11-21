<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CalendarApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_page_receives_monday_as_the_week_start(): void
    {
        $this->actingAs(User::factory()->create())
            ->get(route('home'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('home')
                ->where('weekStartsOn', 1)
            );
    }

    /**
     * July 2026 starts on a Wednesday and ends on a Friday, so a Monday-start
     * grid runs from Mon Jun 29 to Sun Aug 2.
     */
    public function test_calendar_range_matches_a_monday_start_grid(): void
    {
        $user = User::factory()->create();

        foreach (['2026-06-28', '2026-06-29', '2026-07-15', '2026-08-02', '2026-08-03'] as $date) {
            CalendarDay::factory()->create(['user_id' => $user->id, 'date' => $date]);
        }

        $response = $this->actingAs($user)->getJson(route('api.calendar', ['month' => '2026-07']));

        $response->assertOk();
        $this->assertSame(
            ['2026-06-29', '2026-07-15', '2026-08-02'],
            collect($response->json('calendarData'))->keys()->sort()->values()->all(),
        );
    }
}

<?php

namespace Tests\Feature;

use App\Enums\Priority;
use App\Models\CalendarDay;
use App\Models\Task;
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

    public function test_calendar_returns_each_day_with_its_note_and_ordered_tasks(): void
    {
        $user = User::factory()->create();
        $day = CalendarDay::factory()->onDate('2026-11-21')->withNote('Gym at 6')->create(['user_id' => $user->id]);
        $second = Task::factory()->for($day)->finished()->priority(Priority::Urgent)->create(['description' => 'Second', 'order' => 2]);
        $first = Task::factory()->for($day)->priority(Priority::Low)->create(['description' => 'First', 'order' => 1]);

        $response = $this->actingAs($user)->getJson(route('api.calendar', ['month' => '2026-11']));

        // Exact, so ids are numbers and is_finished is a boolean (DEBT-04).
        $response->assertOk()
            ->assertExactJson(['calendarData' => [
                '2026-11-21' => [
                    'calendar_day' => ['id' => $day->id, 'note' => 'Gym at 6'],
                    'tasks' => [
                        [
                            'id' => $first->id,
                            'description' => 'First',
                            'is_finished' => false,
                            'calendar_day_id' => $day->id,
                            'priority' => 0,
                            'order' => 1,
                            'recurrence' => null,
                        ],
                        [
                            'id' => $second->id,
                            'description' => 'Second',
                            'is_finished' => true,
                            'calendar_day_id' => $day->id,
                            'priority' => 3,
                            'order' => 2,
                            'recurrence' => null,
                        ],
                    ],
                ],
            ]]);
    }

    public function test_calendar_includes_days_with_a_note_and_no_tasks(): void
    {
        $user = User::factory()->create();
        CalendarDay::factory()->onDate('2026-11-03')->withNote('Just a note')->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->getJson(route('api.calendar', ['month' => '2026-11']))
            ->assertOk()
            ->assertJsonPath('calendarData.2026-11-03.calendar_day.note', 'Just a note')
            ->assertJsonPath('calendarData.2026-11-03.tasks', []);
    }

    public function test_calendar_data_is_an_empty_object_for_a_month_with_nothing_in_it(): void
    {
        $response = $this->actingAs(User::factory()->create())
            ->getJson(route('api.calendar', ['month' => '2026-11']));

        $response->assertOk();
        $this->assertSame('{"calendarData":{}}', $response->getContent());
    }
}

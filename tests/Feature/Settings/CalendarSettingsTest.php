<?php

namespace Tests\Feature\Settings;

use App\Models\CalendarDay;
use App\Models\RecurringTask;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * The time zone and week-start settings (FEAT-01, spec decision D8).
 */
class CalendarSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_page_shows_the_current_settings_and_every_zone(): void
    {
        $user = User::factory()->create(['timezone' => 'Asia/Tokyo', 'week_starts_on' => 0]);

        $this->actingAs($user)
            ->get(route('calendar-settings.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('settings/calendar')
                ->where('timezone', 'Asia/Tokyo')
                ->where('weekStartsOn', 0)
                ->where('timezones', fn ($zones) => collect($zones)->contains('Europe/London')
                    && collect($zones)->contains('America/New_York'))
            );
    }

    public function test_the_page_defaults_to_the_app_zone_and_monday(): void
    {
        $this->actingAs(User::factory()->create())
            ->get(route('calendar-settings.edit'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('timezone', 'UTC')
                ->where('weekStartsOn', 1)
            );
    }

    public function test_an_old_style_stored_zone_stays_in_the_list(): void
    {
        $user = User::factory()->create(['timezone' => 'Asia/Calcutta']);

        $this->actingAs($user)
            ->get(route('calendar-settings.edit'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('timezone', 'Asia/Calcutta')
                ->where('timezones', fn ($zones) => collect($zones)->contains('Asia/Calcutta'))
            );
    }

    public function test_the_settings_can_be_saved(): void
    {
        $user = User::factory()->create(['timezone' => 'UTC']);

        $this->actingAs($user)
            ->patch(route('calendar-settings.update'), [
                'timezone' => 'America/New_York',
                'week_starts_on' => 0,
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('calendar-settings.edit'));

        $user->refresh();
        $this->assertSame('America/New_York', $user->timezone);
        $this->assertSame(0, $user->week_starts_on);
    }

    public function test_invalid_settings_are_rejected(): void
    {
        $user = User::factory()->create(['timezone' => 'UTC']);

        $this->actingAs($user)
            ->patch(route('calendar-settings.update'), [
                'timezone' => 'Mars/Olympus_Mons',
                'week_starts_on' => 7,
            ])
            ->assertSessionHasErrors(['timezone', 'week_starts_on']);

        $this->actingAs($user)
            ->patch(route('calendar-settings.update'), [])
            ->assertSessionHasErrors(['timezone', 'week_starts_on']);

        $this->assertSame('UTC', $user->fresh()->timezone);
    }

    public function test_guests_cannot_see_or_change_the_settings(): void
    {
        $this->get(route('calendar-settings.edit'))->assertRedirect(route('login'));
        $this->patch(route('calendar-settings.update'), [
            'timezone' => 'UTC',
            'week_starts_on' => 1,
        ])->assertRedirect(route('login'));
    }

    public function test_the_first_request_with_a_time_zone_header_stores_it(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withHeaders(['X-Timezone' => 'Asia/Tokyo'])
            ->getJson(route('api.calendar'))
            ->assertOk();

        $this->assertSame('Asia/Tokyo', $user->fresh()->timezone);
    }

    public function test_signing_in_stores_the_browsers_time_zone(): void
    {
        $user = User::factory()->create();

        $this->withHeaders(['X-Timezone' => 'Europe/Paris'])
            ->post(route('login.store'), [
                'email' => $user->email,
                'password' => 'password',
            ])
            ->assertRedirect(route('home'));

        $this->assertSame('Europe/Paris', $user->fresh()->timezone);
    }

    public function test_a_stored_time_zone_is_never_replaced_by_the_header(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/London']);

        $this->actingAs($user)
            ->withHeaders(['X-Timezone' => 'Asia/Tokyo'])
            ->getJson(route('api.calendar'))
            ->assertOk();

        $this->assertSame('Europe/London', $user->fresh()->timezone);
    }

    public function test_an_invalid_header_is_not_stored(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withHeaders(['X-Timezone' => 'Mars/Olympus_Mons'])
            ->getJson(route('api.calendar'))
            ->assertOk();

        $this->assertNull($user->fresh()->timezone);
    }

    public function test_the_stored_time_zone_decides_today_over_the_header(): void
    {
        // 20:00 UTC on Nov 21 is already Nov 22 in Tokyo, but still Nov 21
        // in London.
        $this->travelTo('2026-11-21 20:00:00');
        $user = User::factory()->create(['timezone' => 'Asia/Tokyo']);
        $day = CalendarDay::factory()->create(['user_id' => $user->id, 'date' => '2026-11-10']);
        $task = Task::factory()->create(['calendar_day_id' => $day->id]);

        $this->actingAs($user)
            ->withHeaders(['X-Timezone' => 'Europe/London'])
            ->postJson(route('tasks.carry-over'), ['task_ids' => [$task->id]])
            ->assertOk();

        $this->assertSame('2026-11-22', $task->fresh()->calendarDay->date);
    }

    public function test_the_home_page_gets_the_users_week_start(): void
    {
        $user = User::factory()->create(['week_starts_on' => 0]);

        $this->actingAs($user)
            ->get(route('home'))
            ->assertInertia(fn (Assert $page) => $page->where('weekStartsOn', 0));
    }

    /**
     * July 2026 starts on a Wednesday and ends on a Friday, so a Sunday-start
     * grid runs from Sun Jun 28 to Sat Aug 1.
     */
    public function test_the_calendar_range_follows_the_users_week_start(): void
    {
        $user = User::factory()->create(['week_starts_on' => 0]);

        foreach (['2026-06-27', '2026-06-28', '2026-07-15', '2026-08-01', '2026-08-02'] as $date) {
            CalendarDay::factory()->create(['user_id' => $user->id, 'date' => $date]);
        }

        $response = $this->actingAs($user)->getJson(route('api.calendar', ['month' => '2026-07']));

        $response->assertOk();
        $this->assertSame(
            ['2026-06-28', '2026-07-15', '2026-08-01'],
            collect($response->json('calendarData'))->keys()->sort()->values()->all(),
        );
    }

    /**
     * Every other week on Sunday and Monday, from Monday Nov 23. With
     * Monday-start weeks, Sunday the 29th is in the first week. With
     * Sunday-start weeks it starts the second week, which is skipped.
     */
    public function test_every_n_weeks_rules_count_weeks_from_the_users_week_start(): void
    {
        $this->travelTo('2026-11-23 09:00:00');

        foreach ([1 => ['2026-11-23', '2026-11-29'], 0 => ['2026-11-23']] as $weekStartsOn => $expected) {
            $user = User::factory()->create(['week_starts_on' => $weekStartsOn]);
            RecurringTask::factory()->for($user)->weekly([0, 1], 2)->startingOn('2026-11-23')->create();

            $this->actingAs($user)->getJson(route('api.calendar', ['month' => '2026-11']))->assertOk();

            $this->assertSame($expected, $user->tasks()
                ->orderBy('calendar_days.date')
                ->pluck('calendar_days.date')
                ->all());
        }
    }
}

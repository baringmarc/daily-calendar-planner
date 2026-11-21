<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class HomeTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_see_the_welcome_page(): void
    {
        $response = $this->get(route('home'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('welcome')
            ->where('canRegister', true)
        );
    }

    public function test_authenticated_users_see_the_calendar(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get(route('home'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page->component('home'));
    }

    public function test_the_calendar_opens_on_the_current_month_without_a_query(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('home'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('home')
                ->where('month', null)
                ->where('day', null)
            );
    }

    /**
     * The visible month and open day come from the URL (UX-07).
     */
    public function test_the_month_and_day_are_read_from_the_query(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('home', ['month' => '2026-08', 'day' => '2026-07-31']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('month', '2026-08')
                ->where('day', '2026-07-31')
            );
    }

    public function test_a_day_without_a_month_opens_that_days_month(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('home', ['day' => '2026-11-21']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('month', '2026-11')
                ->where('day', '2026-11-21')
            );
    }

    /**
     * @return array<string, array{array<string, mixed>}>
     */
    public static function invalidDateQueries(): array
    {
        return [
            'garbage' => [['month' => 'garbage', 'day' => 'nope']],
            'out of range' => [['month' => '2026-13', 'day' => '2026-02-30']],
            'wrong format' => [['month' => '2026-1', 'day' => '21-11-2026']],
            'arrays' => [['month' => ['2026-11'], 'day' => ['2026-11-21']]],
        ];
    }

    /**
     * @param  array<string, mixed>  $query
     */
    #[DataProvider('invalidDateQueries')]
    public function test_invalid_month_and_day_queries_are_ignored(array $query): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('home', $query))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('home')
                ->where('month', null)
                ->where('day', null)
            );
    }

    /**
     * The calendar view and the week it shows come from the URL (FEAT-10).
     */
    public function test_the_view_and_week_are_read_from_the_query(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('home'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('view', 'month')
                ->where('week', null)
            );

        $this->actingAs($user)->get(route('home', ['view' => 'week', 'week' => '2026-11-16']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('view', 'week')
                ->where('week', '2026-11-16')
            );

        $this->actingAs($user)->get(route('home', ['month' => '2026-11', 'view' => 'agenda']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('view', 'agenda')
                ->where('month', '2026-11')
            );
    }

    public function test_an_unknown_view_or_invalid_week_falls_back_to_the_month(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('home', ['view' => 'year', 'week' => '2026-02-30']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('view', 'month')
                ->where('week', null)
            );

        $this->actingAs($user)->get(route('home', ['view' => ['week']]))
            ->assertInertia(fn (Assert $page) => $page->where('view', 'month'));
    }

    public function test_guests_cannot_fetch_calendar_data(): void
    {
        $response = $this->get(route('api.calendar'));

        $response->assertRedirect(route('login'));
    }

    /**
     * Only the routes the app calls are registered (DEBT-02).
     */
    public function test_unused_resource_routes_are_not_registered(): void
    {
        $user = User::factory()->create();
        $day = CalendarDay::factory()->create(['user_id' => $user->id]);
        $task = Task::factory()->for($day)->create();

        $this->actingAs($user)->getJson('/tasks')->assertMethodNotAllowed();
        $this->actingAs($user)->getJson("/tasks/{$task->id}")->assertMethodNotAllowed();
        $this->actingAs($user)->getJson('/calendar-days')->assertMethodNotAllowed();
        $this->actingAs($user)->getJson("/calendar-days/{$day->id}")->assertMethodNotAllowed();
        $this->actingAs($user)->deleteJson("/calendar-days/{$day->id}")->assertMethodNotAllowed();
        $this->assertModelExists($day);
    }
}

<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
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

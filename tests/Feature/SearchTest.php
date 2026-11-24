<?php

namespace Tests\Feature;

use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use App\Services\SearchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Searching tasks and notes (FEAT-06). Today is Nov 25, 2026.
 */
class SearchTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-11-25 10:00:00');
        $this->user = User::factory()->create(['timezone' => 'UTC']);
    }

    public function test_it_finds_matching_tasks_with_their_day(): void
    {
        $day = $this->day('2026-11-20');
        $match = Task::factory()->for($day)->create(['description' => 'Call the dentist', 'order' => 2]);
        Task::factory()->for($day)->create(['description' => 'Buy milk', 'order' => 1]);
        Task::factory()->for($this->day('2026-11-21'))->create(['description' => 'Walk the dog']);

        $this->search('dentist')->assertOk()->assertExactJson([
            'upcoming' => ['days' => [], 'has_more' => false],
            'earlier' => [
                'days' => [[
                    'date' => '2026-11-20',
                    'note' => null,
                    'tasks' => [[
                        'id' => $match->id,
                        'description' => 'Call the dentist',
                        'is_finished' => false,
                        'calendar_day_id' => $day->id,
                        'priority' => 1,
                        'order' => 2,
                        'recurrence' => null,
                    ]],
                ]],
                'has_more' => false,
            ],
        ]);
    }

    public function test_it_finds_matching_notes(): void
    {
        $this->day('2026-11-20', 'Remember the dentist on Friday');
        $this->day('2026-11-21', 'Nothing to see');

        $this->search('DENTIST')->assertOk()
            ->assertJsonCount(1, 'earlier.days')
            ->assertJsonPath('earlier.days.0.date', '2026-11-20')
            ->assertJsonPath('earlier.days.0.note', 'Remember the dentist on Friday')
            ->assertJsonPath('earlier.days.0.tasks', []);
    }

    public function test_a_note_that_does_not_match_is_left_out(): void
    {
        $day = $this->day('2026-11-20', 'Private thoughts');
        Task::factory()->for($day)->create(['description' => 'Dentist']);

        $this->search('dentist')->assertOk()
            ->assertJsonPath('earlier.days.0.note', null)
            ->assertJsonCount(1, 'earlier.days.0.tasks');
    }

    public function test_case_does_not_matter(): void
    {
        Task::factory()->for($this->day('2026-11-20'))->create(['description' => 'Call the DENTIST']);

        $this->search('Dentist')->assertOk()->assertJsonCount(1, 'earlier.days');
    }

    public function test_wildcards_match_themselves(): void
    {
        Task::factory()->for($this->day('2026-11-20'))->create(['description' => 'Grow sales 50% this year']);
        Task::factory()->for($this->day('2026-11-21'))->create(['description' => 'Grow sales 500 units']);
        Task::factory()->for($this->day('2026-11-22'))->create(['description' => 'snake_case names']);
        Task::factory()->for($this->day('2026-11-23'))->create(['description' => 'snakeXcase names']);
        Task::factory()->for($this->day('2026-11-24'))->create(['description' => 'Wow! Great']);

        $this->search('50%')->assertOk()
            ->assertJsonCount(1, 'earlier.days')
            ->assertJsonPath('earlier.days.0.date', '2026-11-20');

        $this->search('e_c')->assertOk()
            ->assertJsonCount(1, 'earlier.days')
            ->assertJsonPath('earlier.days.0.date', '2026-11-22');

        $this->search('w!')->assertOk()
            ->assertJsonCount(1, 'earlier.days')
            ->assertJsonPath('earlier.days.0.date', '2026-11-24');
    }

    public function test_upcoming_days_come_soonest_first_and_earlier_days_most_recent_first(): void
    {
        foreach (['2026-11-20', '2026-11-27', '2026-11-25', '2026-11-24', '2026-12-10', '2026-10-01'] as $date) {
            Task::factory()->for($this->day($date))->create(['description' => 'Gym']);
        }

        $response = $this->search('gym')->assertOk();

        $this->assertSame(['2026-11-25', '2026-11-27', '2026-12-10'], array_column($response->json('upcoming.days'), 'date'));
        $this->assertSame(['2026-11-24', '2026-11-20', '2026-10-01'], array_column($response->json('earlier.days'), 'date'));
    }

    public function test_today_is_the_users_today(): void
    {
        // 12:00 UTC is already Nov 26 in Auckland.
        $this->travelTo('2026-11-25 12:00:00');
        $this->user->update(['timezone' => 'Pacific/Auckland']);
        Task::factory()->for($this->day('2026-11-25'))->create(['description' => 'Gym']);

        $this->search('gym')->assertOk()
            ->assertJsonCount(0, 'upcoming.days')
            ->assertJsonCount(1, 'earlier.days');
    }

    public function test_each_group_is_limited(): void
    {
        $limit = SearchService::DAYS_PER_GROUP;

        foreach (range(1, $limit + 1) as $offset) {
            Task::factory()->for($this->day(now()->addDays($offset)->toDateString()))->create(['description' => 'Gym']);
        }

        foreach (range(1, $limit) as $offset) {
            Task::factory()->for($this->day(now()->subDays($offset)->toDateString()))->create(['description' => 'Gym']);
        }

        $response = $this->search('gym')->assertOk()
            ->assertJsonCount($limit, 'upcoming.days')
            ->assertJsonPath('upcoming.has_more', true)
            ->assertJsonCount($limit, 'earlier.days')
            ->assertJsonPath('earlier.has_more', false);

        $this->assertSame('2026-11-26', $response->json('upcoming.days.0.date'));
    }

    public function test_repeating_tasks_show_their_rule(): void
    {
        $this->actingAs($this->user)->postJson(route('tasks.store'), [
            'description' => 'Gym',
            'date' => '2026-11-25',
            'recurrence' => ['frequency' => 'daily'],
        ])->assertCreated();

        $this->search('gym')->assertOk()
            ->assertJsonPath('upcoming.days.0.tasks.0.recurrence.frequency', 'daily');
    }

    public function test_other_users_tasks_and_notes_are_not_searched(): void
    {
        $other = CalendarDay::factory()->onDate('2026-11-20')->withNote('Gym day')->create();
        Task::factory()->for($other)->create(['description' => 'Gym']);

        $this->search('gym')->assertOk()->assertExactJson([
            'upcoming' => ['days' => [], 'has_more' => false],
            'earlier' => ['days' => [], 'has_more' => false],
        ]);
    }

    public function test_the_term_is_validated(): void
    {
        $this->actingAs($this->user)->getJson(route('api.search'))
            ->assertUnprocessable()->assertJsonValidationErrors('q');
        $this->search('a')->assertUnprocessable()->assertJsonValidationErrors('q');
        $this->search('  a  ')->assertUnprocessable()->assertJsonValidationErrors('q');
        $this->search(str_repeat('a', 101))->assertUnprocessable()->assertJsonValidationErrors('q');
    }

    public function test_guests_cannot_search(): void
    {
        $this->getJson(route('api.search', ['q' => 'gym']))->assertUnauthorized();
    }

    private function search(string $term): TestResponse
    {
        return $this->actingAs($this->user)->getJson(route('api.search', ['q' => $term]));
    }

    private function day(string $date, ?string $note = null): CalendarDay
    {
        return CalendarDay::factory()->for($this->user)->onDate($date)->create(['note' => $note]);
    }
}

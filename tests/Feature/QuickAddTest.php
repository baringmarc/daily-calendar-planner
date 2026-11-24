<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Parsing a quick-add line (FEAT-03). Today is Wednesday, Nov 25, 2026.
 */
class QuickAddTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-11-25 10:00:00');
        $this->user = User::factory()->create(['timezone' => 'UTC', 'week_starts_on' => 1]);
    }

    /**
     * @return array<string, array{string, string, string}>
     */
    public static function datePhrases(): array
    {
        return [
            'today' => ['Call Bob today', 'Call Bob', '2026-11-25'],
            'tomorrow' => ['Call Bob tomorrow', 'Call Bob', '2026-11-26'],
            'tmr' => ['Call Bob tmr', 'Call Bob', '2026-11-26'],
            'tmrw' => ['Call Bob tmrw', 'Call Bob', '2026-11-26'],
            'a later weekday' => ['Call Bob friday', 'Call Bob', '2026-11-27'],
            'an earlier weekday' => ['Call Bob monday', 'Call Bob', '2026-11-30'],
            'today\'s weekday is a week away' => ['Call Bob wednesday', 'Call Bob', '2026-12-02'],
            'on a weekday' => ['Call Bob on Friday', 'Call Bob', '2026-11-27'],
            'next week' => ['Plan next week', 'Plan', '2026-11-30'],
            'next month' => ['Pay rent next month', 'Pay rent', '2026-12-01'],
            'in N days' => ['Water plants in 3 days', 'Water plants', '2026-11-28'],
            'in a day' => ['Water plants in a day', 'Water plants', '2026-11-26'],
            'in a week' => ['Review in a week', 'Review', '2026-12-02'],
            'in N weeks' => ['Review in 2 weeks', 'Review', '2026-12-09'],
            'in N months' => ['Renew in 3 months', 'Renew', '2027-02-25'],
            'ISO date' => ['Dentist 2026-12-03', 'Dentist', '2026-12-03'],
            'on an ISO date' => ['Dentist on 2027-01-04', 'Dentist', '2027-01-04'],
            'month and day' => ['Dentist Dec 3', 'Dentist', '2026-12-03'],
            'full month and ordinal' => ['Dentist December 3rd', 'Dentist', '2026-12-03'],
            'month, day and year' => ['Dentist Dec 3, 2027', 'Dentist', '2027-12-03'],
            'day and month' => ['Dentist 3 Dec', 'Dentist', '2026-12-03'],
            'day of month' => ['Dentist on the 3rd of December', 'Dentist', '2026-12-03'],
            'passed date is next year' => ['Taxes March 1', 'Taxes', '2027-03-01'],
            'today\'s date is this year' => ['Party Nov 25', 'Party', '2026-11-25'],
            'case' => ['Call Bob TOMORROW', 'Call Bob', '2026-11-26'],
            'in the middle' => ['Call tomorrow about the car', 'Call about the car', '2026-11-26'],
        ];
    }

    #[DataProvider('datePhrases')]
    public function test_it_reads_a_date(string $text, string $description, string $date): void
    {
        $this->parse($text)->assertOk()->assertExactJson([
            'description' => $description,
            'date' => $date,
            'priority' => null,
        ]);
    }

    /**
     * @return array<string, array{string, int}>
     */
    public static function priorityPhrases(): array
    {
        return [
            'low' => ['!low', 0],
            'med' => ['!med', 1],
            'medium' => ['!medium', 1],
            'high' => ['!high', 2],
            'urgent' => ['!URGENT', 3],
        ];
    }

    #[DataProvider('priorityPhrases')]
    public function test_it_reads_a_priority(string $word, int $priority): void
    {
        $this->parse("Call Bob {$word}")->assertOk()->assertExactJson([
            'description' => 'Call Bob',
            'date' => null,
            'priority' => $priority,
        ]);
    }

    public function test_it_reads_a_date_and_a_priority_together(): void
    {
        $this->parse('Call Bob tomorrow !high')->assertOk()->assertExactJson([
            'description' => 'Call Bob',
            'date' => '2026-11-26',
            'priority' => 2,
        ]);
    }

    public function test_text_without_phrases_is_left_alone(): void
    {
        $this->parse('  Buy  milk  ')->assertOk()->assertExactJson([
            'description' => 'Buy milk',
            'date' => null,
            'priority' => null,
        ]);
    }

    public function test_the_last_date_and_priority_win(): void
    {
        $this->parse('Plan Monday meeting tomorrow !low !urgent')->assertOk()->assertExactJson([
            'description' => 'Plan Monday meeting !low',
            'date' => '2026-11-26',
            'priority' => 3,
        ]);
    }

    public function test_quoted_text_is_not_parsed(): void
    {
        $this->parse('"Monday" standup "!high"')->assertOk()->assertExactJson([
            'description' => '"Monday" standup "!high"',
            'date' => null,
            'priority' => null,
        ]);
    }

    public function test_words_inside_other_words_are_not_parsed(): void
    {
        $this->parse('Todays mayday follow-up-tomorrow wow!high')->assertOk()->assertExactJson([
            'description' => 'Todays mayday follow-up-tomorrow wow!high',
            'date' => null,
            'priority' => null,
        ]);
    }

    public function test_a_date_that_does_not_exist_is_left_as_text(): void
    {
        $this->parse('Party Feb 30')->assertOk()
            ->assertJsonPath('description', 'Party Feb 30')
            ->assertJsonPath('date', null);

        $this->parse('Party 2026-13-01')->assertOk()
            ->assertJsonPath('description', 'Party 2026-13-01')
            ->assertJsonPath('date', null);
    }

    public function test_in_months_stays_in_a_short_month(): void
    {
        $this->travelTo('2027-01-31 10:00:00');

        $this->parse('Renew in a month')->assertOk()->assertJsonPath('date', '2027-02-28');
    }

    public function test_text_of_only_phrases_leaves_an_empty_description(): void
    {
        $this->parse('tomorrow !high')->assertOk()->assertExactJson([
            'description' => '',
            'date' => '2026-11-26',
            'priority' => 2,
        ]);
    }

    public function test_today_is_in_the_users_time_zone(): void
    {
        // 10:00 UTC is 23:00 on Nov 25 in Auckland: 12:00 UTC is Nov 26 there.
        $this->travelTo('2026-11-25 12:00:00');
        $this->user->update(['timezone' => 'Pacific/Auckland']);

        $this->parse('Call Bob today')->assertOk()->assertJsonPath('date', '2026-11-26');
        $this->parse('Call Bob tomorrow')->assertOk()->assertJsonPath('date', '2026-11-27');
    }

    public function test_next_week_follows_the_users_week_start(): void
    {
        $this->user->update(['week_starts_on' => 0]);

        $this->parse('Plan next week')->assertOk()->assertJsonPath('date', '2026-11-29');
    }

    public function test_the_text_is_validated(): void
    {
        $this->actingAs($this->user)->getJson(route('tasks.parse'))
            ->assertUnprocessable()->assertJsonValidationErrors('text');

        $this->parse(str_repeat('a', 501))
            ->assertUnprocessable()->assertJsonValidationErrors('text');
    }

    public function test_guests_cannot_parse(): void
    {
        $this->getJson(route('tasks.parse', ['text' => 'Call Bob']))->assertUnauthorized();
    }

    private function parse(string $text): TestResponse
    {
        return $this->actingAs($this->user)->getJson(route('tasks.parse', ['text' => $text]));
    }
}

<?php

namespace App\Support;

use App\Enums\Priority;
use Carbon\CarbonImmutable;

/**
 * Reads a date and a priority out of a quick-add line (FEAT-03, spec
 * decision D9), e.g. "Call Bob tomorrow !high".
 *
 * The phrases it knows are listed in spec §3.7. The last date phrase and
 * the last priority win, and are removed from the description; anything
 * earlier stays as text, as does text in double quotes and a date that
 * doesn't exist.
 */
class QuickAddParser
{
    /**
     * Word boundaries that also treat `-` as part of a word, so "2026-12-03"
     * and "follow-up" aren't split.
     */
    private const START = '(?<![\p{L}\p{N}_-])';

    private const END = '(?![\p{L}\p{N}_-])';

    private const PRIORITIES = [
        'low' => Priority::Low,
        'med' => Priority::Medium,
        'medium' => Priority::Medium,
        'high' => Priority::High,
        'urgent' => Priority::Urgent,
    ];

    /**
     * 0 = Sunday ... 6 = Saturday, like Carbon's dayOfWeek.
     */
    private const WEEKDAYS = [
        'sunday' => 0,
        'monday' => 1,
        'tuesday' => 2,
        'wednesday' => 3,
        'thursday' => 4,
        'friday' => 5,
        'saturday' => 6,
    ];

    private const MONTHS = [
        'january' => 1, 'jan' => 1,
        'february' => 2, 'feb' => 2,
        'march' => 3, 'mar' => 3,
        'april' => 4, 'apr' => 4,
        'may' => 5,
        'june' => 6, 'jun' => 6,
        'july' => 7, 'jul' => 7,
        'august' => 8, 'aug' => 8,
        'september' => 9, 'sept' => 9, 'sep' => 9,
        'october' => 10, 'oct' => 10,
        'november' => 11, 'nov' => 11,
        'december' => 12, 'dec' => 12,
    ];

    /**
     * @param  CarbonImmutable  $today  the user's today (UserClock::today())
     * @param  int  $weekStartsOn  0 = Sunday ... 6 = Saturday, for "next week"
     * @return array{description: string, date: string|null, priority: Priority|null}
     */
    public function parse(string $text, CarbonImmutable $today, int $weekStartsOn): array
    {
        $quoted = $this->quotedSpans($text);

        $priority = $this->lastMatch($text, $quoted, [
            '/(?<!\S)!('.implode('|', array_keys(self::PRIORITIES)).')(?!\S)/iu' => fn (array $m) => self::PRIORITIES[mb_strtolower($m[1])],
        ]);

        $date = $this->lastMatch($text, $quoted, $this->datePatterns($today, $weekStartsOn));

        // Cut out the later match first, so the other's offset still holds.
        $matches = array_filter([$priority, $date]);
        usort($matches, fn (array $a, array $b) => $b['offset'] <=> $a['offset']);

        $description = $text;

        foreach ($matches as $match) {
            $description = substr_replace($description, ' ', $match['offset'], $match['length']);
        }

        return [
            'description' => trim(preg_replace('/\s+/u', ' ', $description)),
            'date' => $date['value'] ?? null,
            'priority' => $priority['value'] ?? null,
        ];
    }

    /**
     * Each date pattern, with how it turns its match into a Y-m-d date (or
     * null when the date doesn't exist).
     *
     * @return array<string, callable(array<int, string>): (string|null)>
     */
    private function datePatterns(CarbonImmutable $today, int $weekStartsOn): array
    {
        $on = '(?:on\s+)?';
        $weekday = '('.implode('|', array_keys(self::WEEKDAYS)).')';
        $month = '('.$this->alternation(array_keys(self::MONTHS)).')\.?';
        $day = '(\d{1,2})(?:st|nd|rd|th)?';
        $year = '(?:,?\s+(20\d{2}))?';

        return [
            '/'.self::START.'today'.self::END.'/iu' => fn () => $today->toDateString(),

            '/'.self::START.'(?:tomorrow|tmrw|tmr)'.self::END.'/iu' => fn () => $today->addDay()->toDateString(),

            // The next one after today: "friday" on a Friday is a week away.
            '/'.self::START.$on.$weekday.self::END.'/iu' => function (array $m) use ($today) {
                $daysAhead = (self::WEEKDAYS[mb_strtolower($m[1])] - $today->dayOfWeek + 7) % 7 ?: 7;

                return $today->addDays($daysAhead)->toDateString();
            },

            '/'.self::START.'next\s+week'.self::END.'/iu' => fn () => $today->startOfWeek($weekStartsOn)->addWeek()->toDateString(),

            '/'.self::START.'next\s+month'.self::END.'/iu' => fn () => $today->startOfMonth()->addMonth()->toDateString(),

            '/'.self::START.'in\s+(\d{1,3}|an?|one)\s+(days?|weeks?|months?)'.self::END.'/iu' => function (array $m) use ($today) {
                $count = ctype_digit($m[1]) ? (int) $m[1] : 1;

                $date = match (rtrim(mb_strtolower($m[2]), 's')) {
                    'day' => $today->addDays($count),
                    'week' => $today->addWeeks($count),
                    'month' => $today->addMonthsNoOverflow($count),
                };

                return $date->toDateString();
            },

            '/'.self::START.$on.'(\d{4})-(\d{2})-(\d{2})'.self::END.'/u' => fn (array $m) => $this->date((int) $m[1], (int) $m[2], (int) $m[3]),

            // "Dec 3", "December 3rd", "Dec 3, 2027"
            '/'.self::START.$on.$month.'\s+'.$day.$year.self::END.'/iu' => fn (array $m) => $this->monthDay($today, $m[1], (int) $m[2], $m[3] ?? ''),

            // "3 Dec", "3rd of December", "3 Dec 2027"
            '/'.self::START.$on.'(?:the\s+)?'.$day.'\s+(?:of\s+)?'.$month.$year.self::END.'/iu' => fn (array $m) => $this->monthDay($today, $m[2], (int) $m[1], $m[3] ?? ''),
        ];
    }

    /**
     * The match that starts last among all the patterns (the longer one on
     * a tie), skipping quoted text and matches that resolve to null.
     *
     * @param  list<array{int, int}>  $quoted
     * @param  array<string, callable(array<int, string>): mixed>  $patterns
     * @return array{offset: int, length: int, value: mixed}|null
     */
    private function lastMatch(string $text, array $quoted, array $patterns): ?array
    {
        $best = null;

        foreach ($patterns as $pattern => $resolve) {
            preg_match_all($pattern, $text, $sets, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

            foreach ($sets as $set) {
                [$matched, $offset] = $set[0];
                $length = strlen($matched);

                if ($this->overlaps($offset, $length, $quoted)) {
                    continue;
                }

                if ($best !== null && ($offset < $best['offset'] || ($offset === $best['offset'] && $length <= $best['length']))) {
                    continue;
                }

                $value = $resolve(array_map(fn (array $group) => $group[0], $set));

                if ($value !== null) {
                    $best = ['offset' => $offset, 'length' => $length, 'value' => $value];
                }
            }
        }

        return $best;
    }

    /**
     * Byte ranges of the text in double quotes, quotes included.
     *
     * @return list<array{int, int}>
     */
    private function quotedSpans(string $text): array
    {
        preg_match_all('/"[^"]*"/u', $text, $matches, PREG_OFFSET_CAPTURE);

        return array_map(fn (array $match) => [$match[1], $match[1] + strlen($match[0])], $matches[0]);
    }

    /**
     * @param  list<array{int, int}>  $spans
     */
    private function overlaps(int $offset, int $length, array $spans): bool
    {
        foreach ($spans as [$start, $end]) {
            if ($offset < $end && $start < $offset + $length) {
                return true;
            }
        }

        return false;
    }

    /**
     * A month and day, in the given year, or else this year, or next year
     * once this year's has passed.
     */
    private function monthDay(CarbonImmutable $today, string $monthName, int $day, string $year): ?string
    {
        $month = self::MONTHS[mb_strtolower($monthName)];

        if ($year !== '') {
            return $this->date((int) $year, $month, $day);
        }

        $thisYear = $this->date($today->year, $month, $day);

        return $thisYear !== null && $thisYear >= $today->toDateString()
            ? $thisYear
            : $this->date($today->year + 1, $month, $day);
    }

    private function date(int $year, int $month, int $day): ?string
    {
        return checkdate($month, $day, $year) ? sprintf('%04d-%02d-%02d', $year, $month, $day) : null;
    }

    /**
     * A regex alternation that tries longer words first ("sept" before "sep").
     *
     * @param  list<string>  $words
     */
    private function alternation(array $words): string
    {
        usort($words, fn (string $a, string $b) => strlen($b) <=> strlen($a));

        return implode('|', $words);
    }
}

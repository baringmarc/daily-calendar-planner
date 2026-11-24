<?php

namespace App\Services;

use App\Models\CalendarDay;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Finds a user's days whose tasks or note contain a term (FEAT-06).
 */
class SearchService
{
    /**
     * Each group lists at most this many days.
     */
    public const DAYS_PER_GROUP = 25;

    /**
     * Today and later days, soonest first, then earlier days, most recent
     * first (spec decision D10). Each day comes with only its matching
     * tasks, and `note_matches` says whether its note matched.
     *
     * @param  string  $today  Y-m-d, the user's today
     * @return array{upcoming: array{days: Collection<int, CalendarDay>, has_more: bool}, earlier: array{days: Collection<int, CalendarDay>, has_more: bool}}
     */
    public function search(User $user, string $term, string $today): array
    {
        $pattern = self::likePattern($term);

        return [
            'upcoming' => $this->group(
                $this->matchingDays($user, $pattern)->where('date', '>=', $today)->orderBy('date'),
                $term,
            ),
            'earlier' => $this->group(
                $this->matchingDays($user, $pattern)->where('date', '<', $today)->orderByDesc('date'),
                $term,
            ),
        ];
    }

    /**
     * @return HasMany<CalendarDay, User>
     */
    private function matchingDays(User $user, string $pattern): HasMany
    {
        $tasksMatching = fn (Builder|HasMany $query) => self::whereContains($query, 'description', $pattern);

        return $user->calendarDays()
            ->where(fn (Builder $query) => self::whereContains($query, 'note', $pattern)->orWhereHas('tasks', $tasksMatching))
            ->with(['tasks' => fn (HasMany $query) => $tasksMatching($query)->with('recurringTask')]);
    }

    /**
     * @param  HasMany<CalendarDay, User>  $query
     * @return array{days: Collection<int, CalendarDay>, has_more: bool}
     */
    private function group(HasMany $query, string $term): array
    {
        $days = $query->limit(self::DAYS_PER_GROUP + 1)->get();

        $needle = mb_strtolower($term);
        $days->each(fn (CalendarDay $day) => $day->setAttribute(
            'note_matches',
            $day->note !== null && str_contains(mb_strtolower($day->note), $needle),
        ));

        return [
            'days' => $days->take(self::DAYS_PER_GROUP),
            'has_more' => $days->count() > self::DAYS_PER_GROUP,
        ];
    }

    /**
     * A case-insensitive "contains" that works the same on SQLite, MySQL and
     * PostgreSQL. `!` is the escape character, because a backslash needs
     * escaping differently in MySQL string literals.
     *
     * @template TQuery of Builder|HasMany
     *
     * @param  TQuery  $query
     * @return TQuery
     */
    private static function whereContains(Builder|HasMany $query, string $column, string $pattern): Builder|HasMany
    {
        return $query->whereRaw("lower({$column}) like ? escape '!'", [$pattern]);
    }

    /**
     * `%term%`, lower-cased, with LIKE's wildcards matching themselves.
     */
    private static function likePattern(string $term): string
    {
        return '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($term)).'%';
    }
}

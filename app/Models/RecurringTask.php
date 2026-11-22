<?php

namespace App\Models;

use App\Casts\DateOnly;
use App\Enums\Priority;
use App\Enums\RepeatFrequency;
use Carbon\CarbonImmutable;
use Database\Factories\RecurringTaskFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A repeat rule (FEAT-09, spec decision D6). Its occurrences are real tasks,
 * created by RecurringTaskService when the calendar is read.
 *
 * @property RepeatFrequency $frequency
 * @property int $interval
 * @property list<int>|null $weekdays
 * @property CarbonImmutable $starts_on
 * @property CarbonImmutable|null $ends_on
 * @property CarbonImmutable|null $generated_through
 */
class RecurringTask extends Model
{
    /** @use HasFactory<RecurringTaskFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'description',
        'priority',
        'frequency',
        'interval',
        'weekdays',
        'starts_on',
        'ends_on',
        'generated_through',
    ];

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'priority' => Priority::DEFAULT,
        'interval' => 1,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'priority' => Priority::class,
            'frequency' => RepeatFrequency::class,
            'interval' => 'integer',
            'weekdays' => 'array',
            'starts_on' => DateOnly::class,
            'ends_on' => DateOnly::class,
            'generated_through' => DateOnly::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    /**
     * Whether the rule has an occurrence on $date. Weeks are counted from
     * the week containing `starts_on`, starting on $weekStartsOn. A monthly
     * rule repeats on `starts_on`'s day of the month, and skips months
     * without that day (the 31st).
     */
    public function occursOn(CarbonImmutable $date, int $weekStartsOn): bool
    {
        $date = $date->startOfDay();
        $start = $this->starts_on->startOfDay();

        if ($date->lt($start) || ($this->ends_on !== null && $date->gt($this->ends_on))) {
            return false;
        }

        return match ($this->frequency) {
            RepeatFrequency::Daily => (int) round($start->diffInDays($date)) % $this->interval === 0,
            RepeatFrequency::Weekly => in_array($date->dayOfWeek, $this->weekdays ?? [], true)
                && (int) round($start->startOfWeek($weekStartsOn)->diffInWeeks($date->startOfWeek($weekStartsOn))) % $this->interval === 0,
            RepeatFrequency::Monthly => $date->day === $start->day
                && (($date->year - $start->year) * 12 + $date->month - $start->month) % $this->interval === 0,
        };
    }

    /**
     * The rule's schedule, in the shape the API takes and returns.
     *
     * @return array{frequency: string, interval: int, weekdays: list<int>|null, ends_on: string|null}
     */
    public function schedule(): array
    {
        return [
            'frequency' => $this->frequency->value,
            'interval' => $this->interval,
            'weekdays' => $this->weekdays,
            'ends_on' => $this->ends_on?->toDateString(),
        ];
    }
}

<?php

namespace App\Services;

use App\Enums\RepeatFrequency;
use App\Models\CalendarDay;
use App\Models\RecurringTask;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Recurring tasks (FEAT-09, spec decisions D6 and D7).
 *
 * A rule is stored once, and its occurrences are ordinary tasks linked to it
 * through `tasks.recurring_task_id`. They are created when the calendar is
 * read, from today up to the end of the range read (at most HORIZON_DAYS
 * ahead). Past days are never backfilled. Each rule remembers the last date
 * it was generated through, so an occurrence that was deleted or moved isn't
 * created again.
 */
class RecurringTaskService
{
    /**
     * How far ahead of today occurrences are created.
     */
    public const HORIZON_DAYS = 365;

    /**
     * Make $task the first occurrence of a new rule starting on its day.
     *
     * @param  array<string, mixed>  $schedule  validated `recurrence` input
     */
    public function start(User $user, Task $task, array $schedule): RecurringTask
    {
        $date = $this->dateOf($task);
        $schedule = $this->normalise($schedule);

        $rule = new RecurringTask([
            ...$schedule,
            'user_id' => $user->id,
            'description' => $task->description,
            'priority' => $task->priority,
            'starts_on' => $date->toDateString(),
            'generated_through' => $date->toDateString(),
        ]);

        $this->ensureOccursOn($rule, $date);

        $rule->save();
        $task->update(['recurring_task_id' => $rule->id]);

        return $rule;
    }

    /**
     * Create the user's missing occurrences from today up to $until (Y-m-d),
     * capped at HORIZON_DAYS after $today.
     */
    public function generate(User $user, string $until, string $today): void
    {
        $today = CarbonImmutable::parse($today);
        $limit = CarbonImmutable::parse($until)->min($today->addDays(self::HORIZON_DAYS));

        if ($limit->lt($today)) {
            return;
        }

        $rules = $user->recurringTasks()
            ->where(fn ($query) => $query
                ->whereNull('generated_through')
                ->orWhere('generated_through', '<', $limit->toDateString()))
            ->get();

        foreach ($rules as $rule) {
            DB::transaction(fn () => $this->generateRule($rule, $today, $limit));
        }
    }

    /**
     * Save changes to a recurring task, or make a one-off task repeat.
     *
     * The description and priority always change on $task. For a task in a
     * series they also change on its unfinished occurrences after it. A
     * changed schedule restarts the rule from $task and replaces those
     * occurrences, and a null schedule stops the series after $task: the
     * later unfinished occurrences are deleted and the earlier ones kept.
     * Occurrences on days before today are history and are never touched.
     *
     * @param  array{description: string, priority: mixed, recurrence: array<string, mixed>|null}  $data
     */
    public function updateSeries(User $user, Task $task, array $data, string $today): Task
    {
        return DB::transaction(function () use ($user, $task, $data, $today) {
            $task->update([
                'description' => $data['description'],
                'priority' => $data['priority'],
            ]);

            $rule = $task->recurringTask;
            $schedule = $data['recurrence'];

            if ($rule === null) {
                if ($schedule !== null) {
                    $this->start($user, $task, $schedule);
                }

                return $task->refresh();
            }

            $date = $this->dateOf($task);
            $today = CarbonImmutable::parse($today);
            // The first date "after this task" that may still change.
            $cutoff = $date->gte($today) ? $date->addDay() : $today;

            if ($schedule === null) {
                $this->laterOccurrences($rule, $task, $cutoff)->delete();
                $rule->delete();

                return $task->refresh();
            }

            $schedule = $this->normalise($schedule);
            $rule->fill([
                'description' => $data['description'],
                'priority' => $data['priority'],
            ]);

            if ($schedule !== $rule->schedule()) {
                $rule->fill([
                    ...$schedule,
                    'starts_on' => $date->toDateString(),
                    'generated_through' => $cutoff->subDay()->toDateString(),
                ]);
                $this->ensureOccursOn($rule, $date);
                $this->laterOccurrences($rule, $task, $cutoff)->delete();
            } else {
                $this->laterOccurrences($rule, $task, $cutoff)->update([
                    'description' => $data['description'],
                    'priority' => $data['priority'],
                ]);
            }

            $rule->save();

            return $task->refresh();
        });
    }

    private function generateRule(RecurringTask $rule, CarbonImmutable $today, CarbonImmutable $limit): void
    {
        $from = collect([
            $today,
            $rule->starts_on,
            $rule->generated_through?->addDay(),
        ])->filter()->max();
        $to = $rule->ends_on === null ? $limit : $limit->min($rule->ends_on);

        // Dates that already have an occurrence (kept from before a
        // schedule change, or finished).
        $taken = Task::query()
            ->join('calendar_days', 'calendar_days.id', '=', 'tasks.calendar_day_id')
            ->where('tasks.recurring_task_id', $rule->id)
            ->whereBetween('calendar_days.date', [$from->toDateString(), $to->toDateString()])
            ->pluck('calendar_days.date')
            ->flip();

        $weekStartsOn = (int) config('calendar.week_starts_on');

        for ($date = $from; $date->lte($to); $date = $date->addDay()) {
            if ($rule->occursOn($date, $weekStartsOn) && ! $taken->has($date->toDateString())) {
                $this->addOccurrence($rule, $date);
            }
        }

        $rule->update(['generated_through' => $limit->toDateString()]);
    }

    private function addOccurrence(RecurringTask $rule, CarbonImmutable $date): void
    {
        $day = CalendarDay::firstOrCreate([
            'user_id' => $rule->user_id,
            'date' => $date->toDateString(),
        ]);

        Task::create([
            'calendar_day_id' => $day->id,
            'recurring_task_id' => $rule->id,
            'description' => $rule->description,
            'priority' => $rule->priority,
            'is_finished' => false,
            'order' => (Task::where('calendar_day_id', $day->id)->max('order') ?? 0) + 1,
        ]);
    }

    /**
     * The rule's unfinished occurrences on or after $cutoff, other than $task.
     */
    private function laterOccurrences(RecurringTask $rule, Task $task, CarbonImmutable $cutoff): Builder
    {
        return Task::query()
            ->where('recurring_task_id', $rule->id)
            ->where('is_finished', false)
            ->whereKeyNot($task->id)
            ->whereIn('calendar_day_id', CalendarDay::query()
                ->select('id')
                ->where('user_id', $rule->user_id)
                ->where('date', '>=', $cutoff->toDateString()));
    }

    /**
     * The validated `recurrence` input in the shape RecurringTask::schedule()
     * returns, so the two can be compared.
     *
     * @param  array<string, mixed>  $schedule
     * @return array{frequency: string, interval: int, weekdays: list<int>|null, ends_on: string|null}
     */
    private function normalise(array $schedule): array
    {
        $frequency = RepeatFrequency::from($schedule['frequency']);
        $weekdays = null;

        if ($frequency === RepeatFrequency::Weekly) {
            $weekdays = array_values(array_unique(array_map('intval', $schedule['weekdays'] ?? [])));
            sort($weekdays);
        }

        return [
            'frequency' => $frequency->value,
            'interval' => (int) ($schedule['interval'] ?? 1),
            'weekdays' => $weekdays,
            'ends_on' => $schedule['ends_on'] ?? null,
        ];
    }

    /**
     * A rule starts on the task it was made from, so that day must be one
     * of its occurrences, and it can't end before it.
     *
     * @throws ValidationException
     */
    private function ensureOccursOn(RecurringTask $rule, CarbonImmutable $date): void
    {
        if ($rule->ends_on !== null && $rule->ends_on->lt($date)) {
            throw ValidationException::withMessages([
                'recurrence.ends_on' => 'The end date must be on or after the task\'s day.',
            ]);
        }

        if (! $rule->occursOn($date, (int) config('calendar.week_starts_on'))) {
            throw ValidationException::withMessages([
                'recurrence.weekdays' => 'The repeat days must include the task\'s day.',
            ]);
        }
    }

    private function dateOf(Task $task): CarbonImmutable
    {
        return CarbonImmutable::parse($task->calendarDay()->value('date'));
    }
}

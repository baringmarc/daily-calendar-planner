<?php

namespace App\Http\Requests\Concerns;

use App\Enums\RepeatFrequency;
use Illuminate\Validation\Rule;

/**
 * The optional `recurrence` object a task can be saved with (FEAT-09):
 * `{ frequency, interval?, weekdays?, ends_on? }`, or null for none.
 * Whether the rule includes the task's own day is checked in
 * RecurringTaskService, which knows the day.
 */
trait ValidatesRecurrence
{
    /**
     * @return array<string, mixed>
     */
    protected function recurrenceRules(): array
    {
        return [
            'recurrence' => ['nullable', 'array'],
            'recurrence.frequency' => ['required_with:recurrence', Rule::enum(RepeatFrequency::class)],
            'recurrence.interval' => ['sometimes', 'integer', 'min:1', 'max:99'],
            'recurrence.weekdays' => ['nullable', 'array', 'min:1', 'required_if:recurrence.frequency,weekly'],
            'recurrence.weekdays.*' => ['integer', 'between:0,6', 'distinct'],
            'recurrence.ends_on' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}

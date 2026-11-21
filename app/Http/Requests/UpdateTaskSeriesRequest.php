<?php

namespace App\Http\Requests;

use App\Enums\Priority;
use App\Http\Requests\Concerns\ValidatesRecurrence;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTaskSeriesRequest extends FormRequest
{
    use ValidatesRecurrence;

    /**
     * Ownership of the task is checked with TaskPolicy in the controller.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'description' => ['required', 'string', 'max:255'],
            'priority' => ['required', 'integer', Rule::enum(Priority::class)],
            // Null stops the series after this task. It must be sent, so a
            // forgotten field never stops a series by accident.
            'recurrence' => ['present', 'nullable', 'array'],
            ...collect($this->recurrenceRules())->except('recurrence')->all(),
        ];
    }
}

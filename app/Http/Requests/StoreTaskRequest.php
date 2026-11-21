<?php

namespace App\Http\Requests;

use App\Enums\Priority;
use App\Http\Requests\Concerns\ValidatesRecurrence;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    use ValidatesRecurrence;

    public function authorize(): bool
    {
        return Auth::check();
    }

    public function rules(): array
    {
        return [
            'description' => 'required|string|max:255',
            'date' => 'required|date_format:Y-m-d',
            'is_finished' => 'boolean',
            'priority' => ['sometimes', 'integer', Rule::enum(Priority::class)],
            ...$this->recurrenceRules(),
        ];
    }
}

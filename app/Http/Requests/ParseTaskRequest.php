<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ParseTaskRequest extends FormRequest
{
    /**
     * Parsing reads nothing but the user's clock and week start.
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
            // Longer than a description (255), to leave room for the date
            // and priority words. The description is checked when the task
            // is added.
            'text' => ['required', 'string', 'max:500'],
        ];
    }
}

<?php

namespace App\Http\Requests\Settings;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class CalendarSettingsUpdateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // The same zones UserClock accepts, old names included.
            'timezone' => ['required', 'string', 'timezone:all_with_bc'],
            'week_starts_on' => ['required', 'integer', 'between:0,6'],
        ];
    }
}

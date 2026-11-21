<?php

namespace App\Http\Requests;

use App\Enums\Priority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
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
        ];
    }
}

<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ReorderTasksRequest extends FormRequest
{
    /**
     * Ownership is checked for every task in TaskService::reorderTasks().
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
            'tasks' => ['required', 'array', 'min:1'],
            'tasks.*.id' => ['required', 'integer', 'distinct', 'exists:tasks,id'],
        ];
    }

    /**
     * The task ids in their new order.
     *
     * @return list<int>
     */
    public function taskIds(): array
    {
        return array_map(
            fn (array $task) => (int) $task['id'],
            array_values($this->validated('tasks')),
        );
    }
}

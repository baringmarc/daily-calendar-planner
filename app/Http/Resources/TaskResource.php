<?php

namespace App\Http\Resources;

use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The task shape the frontend's `Task` type expects (resources/js/types/calendar.ts).
 *
 * @mixin Task
 */
class TaskResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'description' => $this->description,
            'is_finished' => $this->is_finished,
            'calendar_day_id' => $this->calendar_day_id,
            'priority' => $this->priority,
            'order' => $this->order,
            // The repeat rule's schedule, or null for a one-off task (FEAT-09).
            'recurrence' => $this->recurring_task_id === null ? null : $this->recurringTask?->schedule(),
        ];
    }
}

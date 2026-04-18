<?php

namespace App\Services;

use App\Models\CalendarDay;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class TaskService
{
    public function create(array $data)
    {
        return DB::transaction(function () use ($data) {
            // -- find or create the Day
            $day = CalendarDay::firstOrCreate([
                'user_id' => $data['user_id'],
                'date' => $data['date'],
            ]);

            if (empty($day)) {
                throw new \Exception('Failed to create or find the calendar day.');
            }

            // -- create the Task
            $currentHighestOrder = Task::where('calendar_day_id', $day->id)->max('order') ?? 0;
            return Task::create([
                'calendar_day_id' => $day->id,
                'user_id' => $data['user_id'],
                'description' => $data['description'],
                'is_finished' => 0,
                'priority' => $data['priority'],
                'order' => $currentHighestOrder + 1
            ]);
        });
    }

    public function carryOverTasks(array $taskIds, $targetCalendarDayId)
    {
        return DB::transaction(function () use ($taskIds, $targetCalendarDayId) {
            if (!$targetCalendarDayId) {
                // If no target day is provided, create/find today's calendar day
                $today = Carbon::now('Asia/Manila')->format('Y-m-d');
                $targetDay = CalendarDay::firstOrCreate([
                    'user_id' => auth()->id(),
                    'date' => $today,
                ]);

                $targetCalendarDayId = $targetDay->id;
            }

            return Task::whereIn('id', $taskIds)
                ->update(['calendar_day_id' => $targetCalendarDayId]);
        });
    }

    public function reorderTasks($tasks) {
        if (empty($tasks)) {
            return [];
        }

        $orderedTasks = [];
        foreach($tasks as $index => $task) {
            $orderedTasks[] = [
                'id' => $task['id'],
                'order' => $index + 1
            ];
        }

        return $this->bulkUpdate($orderedTasks);
    }

    public function bulkUpdate(array $tasks)
    {
        return DB::transaction(function () use ($tasks) {
            foreach ($tasks as $taskData) {
                $task = Task::find($taskData['id']);

                if ($task) {
                    $task->update($taskData);
                }
            }
        });
    }
}
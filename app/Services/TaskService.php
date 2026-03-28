<?php

namespace App\Services;

use App\Models\CalendarDay;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

class TaskService
{
    public function create(array $data)
    {
        return DB::transaction(function () use ($data) {
            // 1. Find or create the Day
            $day = CalendarDay::firstOrCreate([
                'user_id' => $data['user_id'],
                'date' => $data['date'],
            ]);

            if (empty($day)) {
                throw new \Exception('Failed to create or find the calendar day.');
            }

            // 2. Create the Task
            return Task::create([
                'calendar_day_id' => $day->id,
                'user_id' => $data['user_id'],
                'description' => $data['description'],
                'is_finished' => 0
            ]);
        });
    }
}
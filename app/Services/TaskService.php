<?php

namespace App\Services;

use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
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
                'order' => $currentHighestOrder + 1,
            ]);
        });
    }

    /**
     * Move the given tasks to the user's calendar day for today.
     *
     * The target day is always resolved on the server. The whole request is
     * rejected if any of the ids doesn't belong to the user.
     */
    public function carryOverTasks(User $user, array $taskIds)
    {
        return DB::transaction(function () use ($user, $taskIds) {
            $this->ensureUserOwnsTasks($user, $taskIds);

            $today = Carbon::now('Asia/Manila')->format('Y-m-d');
            $targetDay = CalendarDay::firstOrCreate([
                'user_id' => $user->id,
                'date' => $today,
            ]);

            return $this->tasksOwnedBy($user)
                ->whereIn('id', $taskIds)
                ->update(['calendar_day_id' => $targetDay->id]);
        });
    }

    /**
     * Rewrite `order` as 1..n following the given task order.
     *
     * The whole request is rejected if any of the ids doesn't belong to the user.
     */
    public function reorderTasks(User $user, array $tasks)
    {
        if (empty($tasks)) {
            return [];
        }

        $taskIds = array_map(fn ($task) => $task['id'], $tasks);

        return DB::transaction(function () use ($user, $taskIds) {
            $this->ensureUserOwnsTasks($user, $taskIds);

            foreach ($taskIds as $index => $taskId) {
                $this->tasksOwnedBy($user)
                    ->whereKey($taskId)
                    ->update(['order' => $index + 1]);
            }
        });
    }

    /**
     * @throws AuthorizationException when any of the ids isn't one of the user's tasks
     */
    private function ensureUserOwnsTasks(User $user, array $taskIds): void
    {
        $taskIds = array_unique($taskIds);

        $ownedCount = $this->tasksOwnedBy($user)->whereIn('id', $taskIds)->count();

        if ($ownedCount !== count($taskIds)) {
            throw new AuthorizationException('This action is unauthorized.');
        }
    }

    private function tasksOwnedBy(User $user): Builder
    {
        return Task::query()->whereHas(
            'calendarDay',
            fn (Builder $query) => $query->where('user_id', $user->id),
        );
    }
}

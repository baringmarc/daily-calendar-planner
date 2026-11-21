<?php

namespace App\Services;

use App\Enums\Priority;
use App\Models\CalendarDay;
use App\Models\Task;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

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
                'priority' => $data['priority'] ?? Priority::DEFAULT,
                'order' => $currentHighestOrder + 1,
            ]);
        });
    }

    /**
     * Move one of the user's tasks to their day for $date (Y-m-d), creating
     * the day if needed, and append it after the tasks already there. A
     * task already on that day stays where it is.
     */
    public function moveTask(User $user, Task $task, string $date): Task
    {
        return DB::transaction(function () use ($user, $task, $date) {
            $targetDay = CalendarDay::firstOrCreate([
                'user_id' => $user->id,
                'date' => $date,
            ]);

            if ($task->calendar_day_id === $targetDay->id) {
                return $task;
            }

            $order = Task::where('calendar_day_id', $targetDay->id)->max('order') ?? 0;

            $task->update([
                'calendar_day_id' => $targetDay->id,
                'order' => $order + 1,
            ]);

            return $task;
        });
    }

    /**
     * The user's unfinished tasks on days strictly before $today (Y-m-d),
     * oldest day first, each with its day's `date`.
     *
     * @return Collection<int, Task>
     */
    public function unfinishedTasksBefore(User $user, string $today): Collection
    {
        return $this->unfinishedPastTasksQuery($user, $today)->get();
    }

    /**
     * Move the given tasks to the user's calendar day for today (Y-m-d),
     * appended after the tasks already there.
     *
     * The target day is always resolved on the server. The whole request is
     * rejected with a 403 if any id isn't the user's, and with a 422 if any
     * task is finished or isn't from a day before today.
     *
     * @return Collection<int, Task> the moved tasks
     */
    public function carryOverTasks(User $user, array $taskIds, string $today): Collection
    {
        return DB::transaction(function () use ($user, $taskIds, $today) {
            $this->ensureUserOwnsTasks($user, $taskIds);

            $tasks = $this->unfinishedPastTasksQuery($user, $today)
                ->whereIn('tasks.id', $taskIds)
                ->get();

            if ($tasks->count() !== count(array_unique($taskIds))) {
                throw ValidationException::withMessages([
                    'task_ids' => 'Only unfinished tasks from days before today can be carried over.',
                ]);
            }

            $targetDay = CalendarDay::firstOrCreate([
                'user_id' => $user->id,
                'date' => $today,
            ]);

            $order = Task::where('calendar_day_id', $targetDay->id)->max('order') ?? 0;

            foreach ($tasks as $task) {
                $task->update([
                    'calendar_day_id' => $targetDay->id,
                    'order' => ++$order,
                ]);
            }

            return $tasks->each(fn (Task $task) => $task->offsetUnset('date'));
        });
    }

    /**
     * Rewrite `order` as 1..n following the given task ids, in one query.
     *
     * The whole request is rejected with a 403 if any id isn't the user's,
     * and with a 422 if the tasks aren't all on the same day.
     *
     * @param  list<int>  $taskIds
     */
    public function reorderTasks(User $user, array $taskIds): void
    {
        if ($taskIds === []) {
            return;
        }

        DB::transaction(function () use ($user, $taskIds) {
            $this->ensureUserOwnsTasks($user, $taskIds);

            $dayCount = Task::whereIn('id', $taskIds)->distinct()->count('calendar_day_id');

            if ($dayCount !== 1) {
                throw ValidationException::withMessages([
                    'tasks' => 'Only tasks from the same day can be reordered together.',
                ]);
            }

            // The ids are validated integers, so they are safe to inline.
            $cases = collect($taskIds)
                ->map(fn (int $id, int $index) => sprintf('WHEN %d THEN %d', $id, $index + 1))
                ->implode(' ');

            Task::whereIn('id', $taskIds)->update([
                'order' => DB::raw("CASE id {$cases} END"),
            ]);
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

    private function unfinishedPastTasksQuery(User $user, string $today): Builder
    {
        return Task::query()
            ->select('tasks.*', 'calendar_days.date')
            ->join('calendar_days', 'calendar_days.id', '=', 'tasks.calendar_day_id')
            ->where('calendar_days.user_id', $user->id)
            ->where('tasks.is_finished', false)
            ->where('calendar_days.date', '<', $today)
            ->orderBy('calendar_days.date')
            ->orderBy('tasks.order');
    }

    private function tasksOwnedBy(User $user): Builder
    {
        return Task::query()->whereHas(
            'calendarDay',
            fn (Builder $query) => $query->where('user_id', $user->id),
        );
    }
}

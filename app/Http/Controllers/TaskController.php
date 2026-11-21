<?php

namespace App\Http\Controllers;

use App\Http\Requests\CarryOverTasksRequest;
use App\Http\Requests\ReorderTasksRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Services\TaskService;
use App\Support\UserClock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    public function __construct(private TaskService $taskService) {}

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreTaskRequest $request)
    {
        $data = $request->validated();
        $data['user_id'] = $request->user()->id;

        $task = $this->taskService->create($data);

        return (new TaskResource($task))->response()->setStatusCode(201);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateTaskRequest $request, Task $task)
    {
        Gate::authorize('update', $task);

        $task->update($request->validated());

        return new TaskResource($task);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Task $task)
    {
        Gate::authorize('delete', $task);

        $task->delete();

        return response()->json(['message' => 'Task deleted successfully'], 200);
    }

    /**
     * Unfinished tasks from days before today, grouped by date (oldest first).
     */
    public function unfinished(Request $request)
    {
        $tasks = $this->taskService->unfinishedTasksBefore(
            $request->user(),
            UserClock::today($request)->toDateString(),
        );

        $grouped = $tasks->groupBy('date')->map(fn ($tasks) => TaskResource::collection($tasks->values()));

        return response()->json([
            'unfinishedTasks' => (object) $grouped->all(),
        ]);
    }

    /**
     * Move unfinished tasks from earlier days to today.
     */
    public function carryOverTasks(CarryOverTasksRequest $request)
    {
        $movedTasks = $this->taskService->carryOverTasks(
            $request->user(),
            $request->validated('task_ids'),
            UserClock::today($request)->toDateString(),
        );

        return TaskResource::collection($movedTasks);
    }

    /**
     * Rewrite the order of one day's tasks.
     */
    public function reorder(ReorderTasksRequest $request)
    {
        $this->taskService->reorderTasks($request->user(), $request->taskIds());

        return response()->json(['message' => 'Tasks reordered successfully'], 200);
    }
}

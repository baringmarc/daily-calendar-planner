<?php

namespace App\Http\Controllers;

use App\Http\Requests\CarryOverTasksRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Task;
use App\Services\TaskService;
use App\Support\UserClock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreTaskRequest $request)
    {
        $taskService = new TaskService;

        $data = $request->validated();
        $data['user_id'] = auth()->id();

        $task = $taskService->create($data);

        return response()->json($task, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Task $task)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Task $task)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateTaskRequest $request, Task $task)
    {
        Gate::authorize('update', $task);

        $task->update($request->validated());

        return response()->json($task, 200);
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
        $taskService = new TaskService;

        $tasks = $taskService->unfinishedTasksBefore(
            $request->user(),
            UserClock::today($request)->toDateString(),
        );

        $grouped = $tasks->groupBy('date')->map(fn ($tasks) => $tasks->map(fn (Task $task) => [
            'id' => $task->id,
            'description' => $task->description,
            'is_finished' => $task->is_finished,
            'calendar_day_id' => $task->calendar_day_id,
            'priority' => $task->priority,
            'order' => $task->order,
        ])->values());

        return response()->json([
            'unfinishedTasks' => (object) $grouped->all(),
        ]);
    }

    /**
     * Move unfinished tasks from earlier days to today.
     */
    public function carryOverTasks(CarryOverTasksRequest $request)
    {
        $taskService = new TaskService;

        $movedTasks = $taskService->carryOverTasks(
            $request->user(),
            $request->validated('task_ids'),
            UserClock::today($request)->toDateString(),
        );

        return response()->json($movedTasks, 200);
    }

    public function reorder(UpdateTaskRequest $request)
    {
        $taskService = new TaskService;

        if (! $request->has('tasks') || ! is_array($request->input('tasks'))) {
            return response()->json(['message' => 'Invalid tasks data'], 400);
        }

        $updatedTasks = $taskService->reorderTasks($request->user(), $request->input('tasks'));

        return response()->json($updatedTasks, 200);
    }
}

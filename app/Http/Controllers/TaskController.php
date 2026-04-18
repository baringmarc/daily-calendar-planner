<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Models\Task;
use App\Services\TaskService;

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
        $taskService = new TaskService();
        
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
        $task->update($request->validated());

        return response()->json($task, 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Task $task)
    {
        $task->delete();
        return response()->json(['message' => 'Task deleted successfully'], 200);
    }

    // - carry over tasks from previous days
    public function carryOverTasks(UpdateTaskRequest $request)
    {
        $taskService = new TaskService();
        
        if (!$request->has('tasks') || !is_array($request->input('tasks'))) {
            return response()->json(['message' => 'Invalid tasks data'], 400);
        }

        $tasks = $request->input('tasks');
        $updatedTasks = [];
        $todayCalendarDayId = $request->input('calendar_day_id') ?? null;

        foreach($tasks as $day) {
            foreach($day as $task) {
                $taskIds[] = $task['id'];
            }
        }

        $updatedTasks = $taskService->carryOverTasks($taskIds, $todayCalendarDayId);

        return response()->json($updatedTasks, 200);
    }

    public function reorder(UpdateTaskRequest $request) {
        $taskService = new TaskService();

        if (!$request->has('tasks') || !is_array($request->input('tasks'))) {
            return response()->json(['message' => 'Invalid tasks data'], 400);
        }

        $tasks = $request->input('tasks');
        $updatedTasks = $taskService->reorderTasks($tasks);

        return response()->json($updatedTasks, 200);
    }
}

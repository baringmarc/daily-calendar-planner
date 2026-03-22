<?php

namespace App\Http\Controllers;

use App\Models\Task;
use Inertia\Inertia;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        //
        $User = $request->user();
        $tasks = $User->tasks()->get();

        $calendarData = $tasks->groupBy('date')->map(function ($tasksForDate) {
            return [
                // 'Notes' => $notes->pluck('content','date')->toArray(),
                'tasks' => $tasksForDate->map(function ($task) {
                    return [
                        'id' => $task->id,
                        'description' => $task->description,
                        'is_finished' => $task->is_finished,
                    ];
                })->toArray(),
            ];
        })->toArray();

        return Inertia::render('home', compact('calendarData'));
    }

}

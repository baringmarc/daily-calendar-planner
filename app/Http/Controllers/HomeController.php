<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\CalendarDay;
use Inertia\Inertia;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        
        $startOfMonth = now()->startOfMonth()->toDateString();
        $endOfMonth = now()->endOfMonth()->toDateString();
        
        $User = $request->user();

        $calendarData = $User->calendarDays()
            ->whereBetween('date', [$startOfMonth, $endOfMonth])
            ->with('tasks')
            ->get()
            ->mapWithKeys(function ($day) {
                return [
                    $day->date => [
                        'tasks' => $day->tasks->map(function ($task) {
                            return [
                                'id' => $task->id,
                                'date' => $task->date,
                                'description' => $task->description,
                                'is_finished' => $task->is_finished,
                            ];
                        })->toArray(),
                        'calendar_day' => [
                            'id' => $day->id,
                            'note' => $day->note,
                        ],
                    ],
                ];
            })
            ->toArray();

        return Inertia::render('home', compact('calendarData', 'User'));
    }

}

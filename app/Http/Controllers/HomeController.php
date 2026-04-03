<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Inertia\Inertia;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return Inertia::render('home');
    }

    public function calendar(Request $request) {
        $month = $request->input('month') ?? Carbon::now()->format('Y-m');
        $baseDate = Carbon::parse($month);

        $startOfMonth = $baseDate->copy()->startOfMonth();
        $endOfMonth = $baseDate->copy()->endOfMonth();
        
        $startDate = $startOfMonth->copy()->startOfWeek();
        $endDate = $endOfMonth->copy()->endOfWeek();
        
        $User = $request->user();

        $calendarData = $User->calendarDays()
            ->whereBetween('date', [$startDate, $endDate])
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

        return response()->json($calendarData);
    }

}

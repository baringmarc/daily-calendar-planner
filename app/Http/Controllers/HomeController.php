<?php

namespace App\Http\Controllers;

use App\Support\UserClock;
use Carbon\Carbon;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;

class HomeController extends Controller
{
    /**
     * Show the welcome page to guests and the calendar to signed-in users.
     */
    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if ($user === null) {
            return Inertia::render('welcome', [
                'canRegister' => Features::enabled(Features::registration()),
            ]);
        }

        if ($user instanceof MustVerifyEmail && ! $user->hasVerifiedEmail()) {
            return redirect()->route('verification.notice');
        }

        return Inertia::render('home', [
            'weekStartsOn' => self::weekStartsOn(),
        ]);
    }

    public function calendar(Request $request)
    {
        $month = $request->input('month') ?? UserClock::today($request)->format('Y-m');
        $baseDate = Carbon::parse($month);

        $startOfMonth = $baseDate->copy()->startOfMonth();
        $endOfMonth = $baseDate->copy()->endOfMonth();

        $weekStartsOn = self::weekStartsOn();
        $startDate = $startOfMonth->copy()->startOfWeek($weekStartsOn)->toDateString();
        $endDate = $endOfMonth->copy()->endOfWeek(($weekStartsOn + 6) % 7)->toDateString();

        $User = $request->user();

        $calendarData = $User->calendarDays()
            ->whereBetween('date', [$startDate, $endDate])
            ->with('tasks')
            ->orderBy('date', 'desc')
            ->get();

        // - prepare calendar data
        $calendarData = $calendarData->mapWithKeys(function ($day) {
            $tasks = $day->tasks->map(function ($task) use ($day) {

                return [
                    'id' => $task->id,
                    'description' => $task->description,
                    'is_finished' => $task->is_finished,
                    'calendar_day_id' => $day->id,
                    'priority' => $task->priority,
                    'order' => $task->order,
                ];

            })->toArray();

            return [
                $day->date => [
                    'tasks' => $tasks,
                    'calendar_day' => [
                        'id' => $day->id,
                        'note' => $day->note,
                    ],
                ],
            ];
        })->toArray();

        return response()->json([
            'calendarData' => $calendarData,
        ]);
    }

    /**
     * The first day of the week, shared by the API's date range and the grid.
     */
    private static function weekStartsOn(): int
    {
        return (int) config('calendar.week_starts_on');
    }
}

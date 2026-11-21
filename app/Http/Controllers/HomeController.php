<?php

namespace App\Http\Controllers;

use App\Http\Resources\CalendarDayResource;
use App\Http\Resources\TaskResource;
use App\Models\CalendarDay;
use App\Support\UserClock;
use Carbon\Carbon;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\JsonResponse;
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

    public function calendar(Request $request): JsonResponse
    {
        $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
        ]);

        $month = $request->input('month') ?? UserClock::today($request)->format('Y-m');
        $baseDate = Carbon::createFromFormat('!Y-m', $month);

        $startOfMonth = $baseDate->copy()->startOfMonth();
        $endOfMonth = $baseDate->copy()->endOfMonth();

        $weekStartsOn = self::weekStartsOn();
        $startDate = $startOfMonth->copy()->startOfWeek($weekStartsOn)->toDateString();
        $endDate = $endOfMonth->copy()->endOfWeek(($weekStartsOn + 6) % 7)->toDateString();

        $days = $request->user()->calendarDays()
            ->whereBetween('date', [$startDate, $endDate])
            ->with('tasks')
            ->orderBy('date')
            ->get();

        $calendarData = $days->mapWithKeys(fn (CalendarDay $day) => [
            $day->date => [
                'calendar_day' => new CalendarDayResource($day),
                'tasks' => TaskResource::collection($day->tasks),
            ],
        ]);

        return response()->json([
            // An object even when empty, to match the frontend's CalendarData type.
            'calendarData' => (object) $calendarData->all(),
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

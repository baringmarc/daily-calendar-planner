<?php

namespace App\Http\Controllers;

use App\Http\Resources\CalendarDayResource;
use App\Http\Resources\TaskResource;
use App\Models\CalendarDay;
use App\Services\RecurringTaskService;
use App\Support\UserClock;
use Carbon\Carbon;
use Carbon\Exceptions\InvalidFormatException;
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
     * The calendar's views. `month` is the default.
     */
    private const VIEWS = ['month', 'week', 'agenda'];

    public function __construct(private RecurringTaskService $recurringTasks) {}

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

        // The visible month and open day live in the URL (?month=&day=), so
        // refresh, back/forward and deep links work. A value that isn't a
        // real date is ignored rather than rejected, and the calendar opens
        // on the current month.
        $day = self::dateFromQuery($request, 'day', 'Y-m-d');

        // ?view=week|agenda picks the calendar view (FEAT-10), and ?week= is
        // any date in the week the week view shows.
        $view = $request->query('view');

        return Inertia::render('home', [
            'weekStartsOn' => $user->weekStartsOn(),
            'month' => self::dateFromQuery($request, 'month', 'Y-m') ?? ($day !== null ? substr($day, 0, 7) : null),
            'day' => $day,
            'view' => in_array($view, self::VIEWS, true) ? $view : 'month',
            'week' => self::dateFromQuery($request, 'week', 'Y-m-d'),
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

        $weekStartsOn = $request->user()->weekStartsOn();
        $startDate = $startOfMonth->copy()->startOfWeek($weekStartsOn)->toDateString();
        $endDate = $endOfMonth->copy()->endOfWeek(($weekStartsOn + 6) % 7)->toDateString();

        // Recurring tasks' occurrences are real rows, created on read up to
        // the end of the range shown (spec decision D6).
        $this->recurringTasks->generate(
            $request->user(),
            $endDate,
            UserClock::today($request)->toDateString(),
        );

        $days = $request->user()->calendarDays()
            ->whereBetween('date', [$startDate, $endDate])
            ->with('tasks.recurringTask')
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
     * The query parameter if it is a real date in the given format, else null.
     */
    private static function dateFromQuery(Request $request, string $key, string $format): ?string
    {
        $value = $request->query($key);

        if (! is_string($value)) {
            return null;
        }

        try {
            $date = Carbon::createFromFormat('!'.$format, $value);
        } catch (InvalidFormatException) {
            return null;
        }

        // createFromFormat rolls invalid dates over (2026-02-30 -> March 2),
        // so only accept a value that formats back to itself.
        return $date?->format($format) === $value ? $value : null;
    }
}

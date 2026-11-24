<?php

namespace App\Http\Controllers;

use App\Services\StatsService;
use App\Support\UserClock;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StatsController extends Controller
{
    public function __construct(private StatsService $stats) {}

    /**
     * Completion, streaks and the heatmap (FEAT-14).
     */
    public function index(Request $request): Response
    {
        return Inertia::render('stats', [
            'stats' => $this->stats->stats(
                $request->user(),
                UserClock::today($request),
                $request->user()->weekStartsOn(),
            ),
        ]);
    }
}

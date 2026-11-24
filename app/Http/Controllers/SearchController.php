<?php

namespace App\Http\Controllers;

use App\Http\Requests\SearchRequest;
use App\Http\Resources\TaskResource;
use App\Models\CalendarDay;
use App\Services\SearchService;
use App\Support\UserClock;
use Illuminate\Http\JsonResponse;

class SearchController extends Controller
{
    public function __construct(private SearchService $search) {}

    /**
     * Search the user's tasks and notes (FEAT-06). The shape is the
     * frontend's `SearchResults` type (resources/js/types/calendar.ts).
     */
    public function __invoke(SearchRequest $request): JsonResponse
    {
        $results = $this->search->search(
            $request->user(),
            $request->validated('q'),
            UserClock::today($request)->toDateString(),
        );

        return response()->json(array_map(fn (array $group) => [
            'days' => $group['days']->map(fn (CalendarDay $day) => [
                'date' => $day->date,
                // Only a matching note is sent, for its snippet.
                'note' => $day->note_matches ? $day->note : null,
                'tasks' => TaskResource::collection($day->tasks),
            ])->values(),
            'has_more' => $group['has_more'],
        ], $results));
    }
}

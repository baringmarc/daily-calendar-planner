<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCalendarDayRequest;
use App\Http\Requests\UpdateCalendarDayRequest;
use App\Models\CalendarDay;
use Illuminate\Support\Facades\Gate;

class CalendarDayController extends Controller
{
    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreCalendarDayRequest $request)
    {
        $calendarDay = $request->user()->calendarDays()->create($request->validated());

        return response()->json($calendarDay, 201);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateCalendarDayRequest $request, CalendarDay $calendarDay)
    {
        Gate::authorize('update', $calendarDay);

        $calendarDay->update($request->validated());

        return response()->json($calendarDay, 200);
    }
}

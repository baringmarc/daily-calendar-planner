<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCalendarDayRequest;
use App\Http\Requests\UpdateCalendarDayRequest;
use App\Models\CalendarDay;

class CalendarDayController extends Controller
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
    public function store(StoreCalendarDayRequest $request)
    {
        $request['user_id'] = auth()->id();
        $calendarDay = $request->user()->calendarDays()->create($request->validated());

        return response()->json($calendarDay, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(CalendarDay $calendarDay)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(CalendarDay $calendarDay)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateCalendarDayRequest $request, CalendarDay $calendarDay)
    {
        $calendarDay->update($request->validated());

        return response()->json($calendarDay, 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(CalendarDay $calendarDay)
    {
        //
    }
}

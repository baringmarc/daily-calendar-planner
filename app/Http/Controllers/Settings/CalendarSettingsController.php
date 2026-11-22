<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\CalendarSettingsUpdateRequest;
use App\Support\UserClock;
use DateTimeZone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The user's time zone and week start (FEAT-01).
 */
class CalendarSettingsController extends Controller
{
    public function edit(Request $request): Response
    {
        $timezone = UserClock::timezone($request);
        $timezones = DateTimeZone::listIdentifiers();

        // A stored old-style name (Asia/Calcutta) stays selectable.
        if (! in_array($timezone, $timezones, true)) {
            $timezones[] = $timezone;
            sort($timezones);
        }

        return Inertia::render('settings/calendar', [
            'timezone' => $timezone,
            'weekStartsOn' => $request->user()->weekStartsOn(),
            'timezones' => $timezones,
        ]);
    }

    public function update(CalendarSettingsUpdateRequest $request): RedirectResponse
    {
        $request->user()->update([
            'timezone' => $request->validated('timezone'),
            'week_starts_on' => (int) $request->validated('week_starts_on'),
        ]);

        return to_route('calendar-settings.edit');
    }
}

<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeZone;
use Illuminate\Http\Request;

/**
 * Works out "today" in the user's time zone.
 *
 * The browser sends its IANA time zone in the X-Timezone header on every
 * request (see resources/js/app.tsx), so the server and the client agree on
 * which day it is. Invalid or missing values fall back to the app time zone.
 * FEAT-01 will store the zone on the user instead.
 */
class UserClock
{
    public const HEADER = 'X-Timezone';

    public static function timezone(Request $request): string
    {
        $timezone = $request->header(self::HEADER);

        if (is_string($timezone) && in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
            return $timezone;
        }

        return config('app.timezone');
    }

    public static function today(Request $request): CarbonImmutable
    {
        return CarbonImmutable::now(self::timezone($request))->startOfDay();
    }
}

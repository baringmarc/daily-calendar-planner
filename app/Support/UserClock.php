<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeZone;
use Illuminate\Http\Request;

/**
 * Works out "today" in the user's time zone.
 *
 * A signed-in user's stored time zone wins (FEAT-01, spec decision D8), and
 * the browser uses the same one, so the server and the client agree on which
 * day it is. Until one is stored, the browser's own zone is used: it is sent
 * in the X-Timezone header on every request (see resources/js/app.tsx), and
 * App\Http\Middleware\StoreDetectedTimezone saves it on the user. Invalid
 * or missing values fall back to the app time zone.
 */
class UserClock
{
    public const HEADER = 'X-Timezone';

    public static function timezone(Request $request): string
    {
        $stored = $request->user()?->timezone;

        if (self::isValid($stored)) {
            return $stored;
        }

        return self::fromHeader($request) ?? config('app.timezone');
    }

    /**
     * The browser's time zone from the X-Timezone header, if it is valid.
     */
    public static function fromHeader(Request $request): ?string
    {
        $timezone = $request->header(self::HEADER);

        return self::isValid($timezone) ? $timezone : null;
    }

    /**
     * Whether $timezone is an IANA zone PHP knows, including the old
     * backward-compatible names some browsers still report.
     *
     * @phpstan-assert-if-true string $timezone
     */
    public static function isValid(mixed $timezone): bool
    {
        return is_string($timezone)
            && in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true);
    }

    public static function today(Request $request): CarbonImmutable
    {
        return CarbonImmutable::now(self::timezone($request))->startOfDay();
    }
}

<?php

namespace App\Http\Middleware;

use App\Support\UserClock;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Saves the browser's time zone on a signed-in user who has none (FEAT-01).
 *
 * It runs after the request, so signing in or registering (whose requests
 * carry the X-Timezone header) stores it straight away, and so does the
 * next request of a session that was signed in before. A stored zone is
 * only ever changed under Settings.
 */
class StoreDetectedTimezone
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();

        if ($user !== null && $user->timezone === null) {
            $detected = UserClock::fromHeader($request);

            if ($detected !== null) {
                $user->forceFill(['timezone' => $detected])->save();
            }
        }

        return $response;
    }
}

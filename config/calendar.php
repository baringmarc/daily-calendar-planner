<?php

use Carbon\CarbonInterface;

return [

    /*
    |--------------------------------------------------------------------------
    | First Day Of The Week
    |--------------------------------------------------------------------------
    |
    | The default day the month grid and the calendar API's date range start
    | on (0 = Sunday ... 6 = Saturday, the same numbering Carbon and date-fns
    | use), for users who haven't chosen one under Settings (FEAT-01, see
    | User::weekStartsOn()). It reaches the frontend as the `weekStartsOn`
    | prop, so the grid and the API always agree.
    |
    */

    'week_starts_on' => CarbonInterface::MONDAY,

];

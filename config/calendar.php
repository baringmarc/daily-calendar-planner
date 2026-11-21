<?php

use Carbon\CarbonInterface;

return [

    /*
    |--------------------------------------------------------------------------
    | First Day Of The Week
    |--------------------------------------------------------------------------
    |
    | The day the month grid and the calendar API's date range start on
    | (0 = Sunday ... 6 = Saturday, the same numbering Carbon and date-fns
    | use). It is passed to the frontend as the `weekStartsOn` prop, so the
    | grid and the API always agree. FEAT-01 turns it into a user setting.
    |
    */

    'week_starts_on' => CarbonInterface::MONDAY,

];

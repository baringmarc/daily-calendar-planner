<?php

namespace App\Enums;

/**
 * How often a recurring task repeats (FEAT-09), every `interval` of these.
 *
 * resources/js/constants/recurrence.ts mirrors these values, and
 * RecurringTaskTest fails if the two drift apart.
 */
enum RepeatFrequency: string
{
    case Daily = 'daily';
    case Weekly = 'weekly';
    case Monthly = 'monthly';
}

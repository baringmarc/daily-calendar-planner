<?php

namespace App\Policies;

use App\Models\CalendarDay;
use App\Models\User;

class CalendarDayPolicy
{
    public function update(User $user, CalendarDay $calendarDay): bool
    {
        return $calendarDay->user_id === $user->id;
    }
}

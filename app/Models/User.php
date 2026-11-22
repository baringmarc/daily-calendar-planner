<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

#[Fillable(['name', 'email', 'password', 'timezone', 'week_starts_on'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'week_starts_on' => 'integer',
        ];
    }

    /**
     * The first day of the week (0 = Sunday ... 6 = Saturday) for the
     * calendar API's range, the grid and weekly repeat rules (FEAT-01).
     */
    public function weekStartsOn(): int
    {
        return $this->week_starts_on ?? (int) config('calendar.week_starts_on');
    }

    public function calendarDays(): HasMany
    {
        return $this->hasMany(CalendarDay::class);
    }

    public function recurringTasks(): HasMany
    {
        return $this->hasMany(RecurringTask::class);
    }

    public function tasks(): HasManyThrough
    {
        return $this->hasManyThrough(Task::class, CalendarDay::class);
    }
}

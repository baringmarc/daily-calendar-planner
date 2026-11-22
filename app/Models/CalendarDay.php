<?php

namespace App\Models;

use Database\Factories\CalendarDayFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CalendarDay extends Model
{
    /** @use HasFactory<CalendarDayFactory> */
    use HasFactory;

    protected $table = 'calendar_days';

    protected $primaryKey = 'id';

    protected $fillable = [
        'user_id',
        'date',
        'note',
    ];

    /**
     * `date` stays a Y-m-d string: it keys the calendar response.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class)->orderBy('order', 'asc');
    }
}

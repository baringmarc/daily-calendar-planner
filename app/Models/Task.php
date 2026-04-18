<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    /** @use HasFactory<\Database\Factories\TaskFactory> */
    use HasFactory;

    protected $table = 'tasks';
    protected $primaryKey = 'id';

    protected $fillable = [
        'description',
        'date',
        'is_finished',
        'calendar_day_id',
        'order',
        'priority'
    ];

    public function calendarDay(): BelongsTo
    {
        return $this->belongsTo(CalendarDay::class);
    }
}

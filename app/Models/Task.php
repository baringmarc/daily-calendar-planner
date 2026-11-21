<?php

namespace App\Models;

use Database\Factories\TaskFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    /** @use HasFactory<TaskFactory> */
    use HasFactory;

    protected $table = 'tasks';

    protected $primaryKey = 'id';

    protected $fillable = [
        'description',
        'is_finished',
        'calendar_day_id',
        'order',
        'priority',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'calendar_day_id' => 'integer',
            'is_finished' => 'boolean',
            'priority' => 'integer',
            'order' => 'integer',
        ];
    }

    public function calendarDay(): BelongsTo
    {
        return $this->belongsTo(CalendarDay::class);
    }
}

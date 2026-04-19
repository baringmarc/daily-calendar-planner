<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CalendarDay extends Model
{
    protected $table = 'calendar_days';
    protected $primaryKey = 'id';

    protected $fillable = [
        'user_id',
        'date',
        'note'
    ];

    public function tasks(): HasMany    
    {
        return $this->hasMany(Task::class)->orderBy('order', 'asc');
    }
}

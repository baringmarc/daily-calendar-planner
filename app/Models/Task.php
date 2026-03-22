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
        'user_id',
        'description',
        'date',
        'is_finished'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

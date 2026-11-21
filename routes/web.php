<?php

use App\Http\Controllers\CalendarDayController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\TaskController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    // Calendar data API
    Route::get('/api/calendar', [HomeController::class, 'calendar'])->name('api.calendar');

    Route::resource('calendar-days', CalendarDayController::class)
        ->only(['store', 'update']);

    // Task routes
    Route::get('/api/tasks/unfinished', [TaskController::class, 'unfinished'])->name('tasks.unfinished');
    Route::post('/api/tasks/carry-over', [TaskController::class, 'carryOverTasks'])->name('tasks.carry-over');
    Route::put('/api/tasks/reorder', [TaskController::class, 'reorder'])->name('tasks.reorder');
    Route::put('/api/tasks/{task}/move', [TaskController::class, 'move'])->name('tasks.move');
    Route::resource('tasks', TaskController::class)
        ->only(['store', 'update', 'destroy']);
});

require __DIR__.'/settings.php';

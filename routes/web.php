<?php

use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    // Calendar data API
    Route::get('/api/calendar', [HomeController::class, 'calendar'])->name('api.calendar');

    Route::resource('calendar-days', \App\Http\Controllers\CalendarDayController::class)
        ->except(['create', 'edit', 'show']); // Keep only index, store, update, destroy
    
    // Task routes
    Route::post('/api/tasks/carry-over', [\App\Http\Controllers\TaskController::class, 'carryOverTasks'])->name('tasks.carry-over');
    Route::put('/api/tasks/reorder', [\App\Http\Controllers\TaskController::class, 'reorder'])->name('tasks.reorder');
    Route::resource('tasks', \App\Http\Controllers\TaskController::class)
         ->except(['create', 'edit', 'show']); // Keep only index, store, update, destroy

});
require __DIR__.'/settings.php';

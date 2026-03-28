<?php

use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/', [HomeController::class, 'index'])->name('home');
    
    // Task routes
    Route::resource('tasks', \App\Http\Controllers\TaskController::class)
         ->except(['create', 'edit', 'show']); // Keep only index, store, update, destroy

    Route::resource('calendar-days', \App\Http\Controllers\CalendarDayController::class)
        ->except(['create', 'edit', 'show']); // Keep only index, store, update, destroy
});
require __DIR__.'/settings.php';

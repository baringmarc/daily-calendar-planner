<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Nullable first, so this also works on a table that already has rows
        // (e.g. migrating forward again after a rollback).
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('calendar_day_id')->nullable()->constrained()->onDelete('cascade');
        });

        // Point each task at its user's calendar day for its date, creating
        // the day if needed.
        DB::table('tasks')->get(['id', 'user_id', 'date'])->each(function ($task) {
            $dayId = DB::table('calendar_days')
                ->where('user_id', $task->user_id)
                ->where('date', $task->date)
                ->value('id');

            $dayId ??= DB::table('calendar_days')->insertGetId([
                'user_id' => $task->user_id,
                'date' => $task->date,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('tasks')->where('id', $task->id)->update(['calendar_day_id' => $dayId]);
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->unsignedBigInteger('calendar_day_id')->nullable(false)->change();

            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');

            $table->dropColumn('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Nullable, because existing rows have no value until the backfill.
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('cascade');
            $table->date('date')->nullable();
        });

        // Restore each task's user and date from its calendar day.
        DB::table('tasks')
            ->join('calendar_days', 'calendar_days.id', '=', 'tasks.calendar_day_id')
            ->get(['tasks.id', 'calendar_days.user_id', 'calendar_days.date'])
            ->each(fn ($task) => DB::table('tasks')->where('id', $task->id)->update([
                'user_id' => $task->user_id,
                'date' => $task->date,
            ]));

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropForeign(['calendar_day_id']);
            $table->dropColumn('calendar_day_id');
        });
    }
};

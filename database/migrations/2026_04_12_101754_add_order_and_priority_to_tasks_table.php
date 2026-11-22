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
        Schema::table('tasks', function (Blueprint $table) {
            $table->integer('order')->nullable();
            $table->tinyInteger('priority')->default(1)->comment('0: Low, 1: Medium, 2: High, 3: Critical');
        });

        // Number each day's existing tasks 1..n by creation time. This uses the
        // query builder rather than the Task model, so later model changes
        // can't break the migration.
        DB::table('tasks')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get(['id', 'calendar_day_id'])
            ->groupBy('calendar_day_id')
            ->each(function ($tasks) {
                foreach ($tasks->values() as $index => $task) {
                    DB::table('tasks')->where('id', $task->id)->update(['order' => $index + 1]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('order');
            $table->dropColumn('priority');
        });
    }
};

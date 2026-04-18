<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Task;

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

        Task::query()
            ->orderBy('created_at')
            ->get()
            ->groupBy('calendar_day_id')
            ->each(function ($tasks) {
                foreach ($tasks as $index => $task) {
                    $task->update([
                        'order' => $index + 1
                    ]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('sort');
            $table->dropColumn('priority');
        });
    }
};

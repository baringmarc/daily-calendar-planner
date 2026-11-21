<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A repeat rule (FEAT-09). Its occurrences are ordinary tasks that point
     * back at it through tasks.recurring_task_id.
     */
    public function up(): void
    {
        Schema::create('recurring_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('description');
            $table->tinyInteger('priority')->default(1);
            // daily, weekly or monthly (App\Enums\RepeatFrequency)
            $table->string('frequency', 10);
            // Every N days, weeks or months.
            $table->unsignedSmallInteger('interval')->default(1);
            // Weekly rules only: days of the week, 0 = Sunday ... 6 = Saturday.
            $table->json('weekdays')->nullable();
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            // The last date occurrences have been created up to, so a deleted
            // or moved occurrence isn't created again.
            $table->date('generated_through')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('recurring_tasks');
    }
};

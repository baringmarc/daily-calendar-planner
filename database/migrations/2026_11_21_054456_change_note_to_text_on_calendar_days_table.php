<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Notes are validated up to 500 characters, which doesn't fit VARCHAR(255).
     */
    public function up(): void
    {
        Schema::table('calendar_days', function (Blueprint $table) {
            $table->text('note')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('calendar_days', function (Blueprint $table) {
            $table->string('note')->nullable()->change();
        });
    }
};

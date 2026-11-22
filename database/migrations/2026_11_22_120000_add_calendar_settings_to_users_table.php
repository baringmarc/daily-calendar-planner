<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The user's calendar settings (FEAT-01). Both are nullable: a missing
     * time zone is detected from the browser, and a missing week start
     * means config('calendar.week_starts_on').
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('timezone')->nullable()->after('email_verified_at');
            $table->unsignedTinyInteger('week_starts_on')->nullable()->after('timezone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['timezone', 'week_starts_on']);
        });
    }
};

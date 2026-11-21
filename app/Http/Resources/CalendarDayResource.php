<?php

namespace App\Http\Resources;

use App\Models\CalendarDay;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The day shape the frontend's `CalendarDay` type expects (resources/js/types/calendar.ts).
 *
 * @mixin CalendarDay
 */
class CalendarDayResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'note' => $this->note,
        ];
    }
}

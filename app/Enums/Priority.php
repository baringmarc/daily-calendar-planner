<?php

namespace App\Enums;

/**
 * A task's priority (spec §3.2).
 *
 * resources/js/constants/priority.ts mirrors these values and labels, and
 * PriorityTest fails if the two drift apart.
 */
enum Priority: int
{
    case Low = 0;
    case Medium = 1;
    case High = 2;
    case Urgent = 3;

    /**
     * New tasks start at Medium (spec decision D3). It matches the
     * `tasks.priority` column default.
     */
    public const DEFAULT = self::Medium;

    public function label(): string
    {
        return $this->name;
    }
}

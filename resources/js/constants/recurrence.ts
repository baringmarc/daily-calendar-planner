import { format, getDay, parseISO } from 'date-fns';
import type { Recurrence } from '@/types';

// Mirrors App\Enums\RepeatFrequency. Tests\Feature\RecurringTaskTest fails
// if the values drift apart.
export const REPEAT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number];

// The validation limit on `recurrence.interval`.
export const REPEAT_INTERVAL_MAX = 99;

const MON_TO_FRI = [1, 2, 3, 4, 5];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The repeat choices in the task dialog. Which ones apply depends on the
// task's day: "every weekday" only for Monday to Friday.
export type RepeatPreset =
    | 'none'
    | 'daily'
    | 'weekdays'
    | 'weekly'
    | 'monthly'
    | 'custom';

/** A rule in the shape the API returns, so two rules compare equal. */
export function makeRecurrence(
    frequency: RepeatFrequency,
    interval: number,
    weekdays: number[] | null,
    endsOn: string | null,
): Recurrence {
    return {
        frequency,
        interval,
        weekdays:
            frequency === 'weekly'
                ? [...new Set(weekdays ?? [])].sort((a, b) => a - b)
                : null,
        ends_on: endsOn,
    };
}

export const sameRecurrence = (a: Recurrence | null, b: Recurrence | null) =>
    JSON.stringify(a) === JSON.stringify(b);

/** The rule a preset stands for, for a task on `date`. */
export function presetRecurrence(
    preset: Exclude<RepeatPreset, 'none' | 'custom'>,
    date: Date,
    endsOn: string | null,
): Recurrence {
    switch (preset) {
        case 'daily':
            return makeRecurrence('daily', 1, null, endsOn);
        case 'weekdays':
            return makeRecurrence('weekly', 1, MON_TO_FRI, endsOn);
        case 'weekly':
            return makeRecurrence('weekly', 1, [getDay(date)], endsOn);
        case 'monthly':
            return makeRecurrence('monthly', 1, null, endsOn);
    }
}

/** The presets offered for a task on `date`, with their labels. */
export function repeatPresets(
    date: Date,
): { value: RepeatPreset; label: string }[] {
    const isWeekday = MON_TO_FRI.includes(getDay(date));

    return [
        { value: 'none', label: "Doesn't repeat" },
        { value: 'daily', label: 'Every day' },
        ...(isWeekday
            ? [
                  {
                      value: 'weekdays' as const,
                      label: 'Every weekday (Mon–Fri)',
                  },
              ]
            : []),
        { value: 'weekly', label: `Every week on ${format(date, 'EEEE')}` },
        {
            value: 'monthly',
            label: `Every month on the ${format(date, 'do')}`,
        },
        { value: 'custom', label: 'Custom…' },
    ];
}

/** Which preset an existing rule matches, for a task on `date`. */
export function presetOf(rule: Recurrence | null, date: Date): RepeatPreset {
    if (!rule) {
        return 'none';
    }

    const preset = repeatPresets(date).find(
        ({ value }) =>
            value !== 'none' &&
            value !== 'custom' &&
            sameRecurrence(rule, presetRecurrence(value, date, rule.ends_on)),
    );

    return preset?.value ?? 'custom';
}

// Weekday numbers (0 = Sunday) in the order the calendar shows them.
export const orderedWeekdays = (weekStartsOn: number) =>
    Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);

export const weekdayName = (day: number) => WEEKDAY_NAMES[day];

/**
 * A rule in words: "Every weekday", "Every 2 weeks on Mon, Wed", "Every
 * month until Dec 31".
 */
export function describeRecurrence(rule: Recurrence, weekStartsOn = 1) {
    const every = (unit: string) =>
        rule.interval === 1
            ? `Every ${unit}`
            : `Every ${rule.interval} ${unit}s`;

    let text: string;

    if (rule.frequency === 'daily') {
        text = every('day');
    } else if (rule.frequency === 'monthly') {
        text = every('month');
    } else if (
        rule.interval === 1 &&
        rule.weekdays?.join() === MON_TO_FRI.join()
    ) {
        text = 'Every weekday';
    } else {
        const days = orderedWeekdays(weekStartsOn)
            .filter((day) => rule.weekdays?.includes(day))
            .map(weekdayName)
            .join(', ');

        text = `${every('week')} on ${days}`;
    }

    return rule.ends_on
        ? `${text} until ${format(parseISO(rule.ends_on), 'MMM d, yyyy')}`
        : text;
}

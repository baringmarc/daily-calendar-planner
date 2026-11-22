import { addDays, isBefore, isSameDay, parseISO, startOfDay } from 'date-fns';

/**
 * "Today" in the user's time zone (FEAT-01, spec decision D8).
 *
 * The signed-in user's stored zone is the one the server uses too
 * (App\Support\UserClock), so the two agree on the date even when this
 * device is set to another zone. Until one is stored, the device's own zone
 * is used, which is also what the X-Timezone header sends. app.tsx keeps it
 * up to date from the `auth.user` prop on every page.
 *
 * The dates returned are local midnights for that calendar date, like every
 * other date the calendar works with, so date-fns can compare them.
 */
export function deviceTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'UTC';
    }
}

let timezone = deviceTimezone();

export function setUserTimezone(zone: string | null | undefined) {
    timezone = zone || deviceTimezone();
}

// yyyy-MM-dd for now in `zone`, or null if the browser doesn't know it.
function dateIn(zone: string): string | null {
    try {
        const parts = Object.fromEntries(
            new Intl.DateTimeFormat('en-US', {
                timeZone: zone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            })
                .formatToParts(new Date())
                .map(({ type, value }) => [type, value]),
        );

        return `${parts.year}-${parts.month}-${parts.day}`;
    } catch {
        return null;
    }
}

export function today(): Date {
    const date = dateIn(timezone);

    return date ? parseISO(date) : startOfDay(new Date());
}

export const isToday = (date: Date) => isSameDay(date, today());

export const isTomorrow = (date: Date) => isSameDay(date, addDays(today(), 1));

export const isBeforeToday = (date: Date) =>
    isBefore(startOfDay(date), today());

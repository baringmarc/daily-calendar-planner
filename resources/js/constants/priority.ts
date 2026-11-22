// Mirrors App\Enums\Priority. Tests\Feature\PriorityTest fails if the values,
// labels or default drift apart.
export const PRIORITY_MAP = [
    { label: 'Low', value: 0, color: 'bg-green-500' },
    { label: 'Medium', value: 1, color: 'bg-yellow-500' },
    { label: 'High', value: 2, color: 'bg-orange-500' },
    { label: 'Urgent', value: 3, color: 'bg-red-500' },
] as const;

export type Priority = (typeof PRIORITY_MAP)[number]['value'];

// New tasks start at Medium (spec decision D3).
export const PRIORITY_DEFAULT: Priority = 1;

// The badge text keeps at least 4.5:1 contrast in both themes (WCAG AA).
export const PRIORITY_STYLES: Record<
    Priority,
    { badge: string; card: string }
> = {
    0: {
        badge: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
        card: 'border-l-green-500 bg-green-50/30 dark:bg-green-500/5',
    },
    1: {
        badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
        card: 'border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-500/5',
    },
    2: {
        badge: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
        card: 'border-l-orange-500 bg-orange-50/30 dark:bg-orange-500/5',
    },
    3: {
        badge: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
        card: 'border-l-red-500 bg-red-50/30 dark:bg-red-500/5',
    },
};

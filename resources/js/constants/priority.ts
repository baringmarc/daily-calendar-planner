export const PRIORITY_MAP = [
    { label: 'Low', value: 0, color: 'bg-green-500' },
    { label: 'Medium', value: 1, color: 'bg-yellow-500' },
    { label: 'High', value: 2, color: 'bg-orange-500' },
    { label: 'Urgent!', value: 3, color: 'bg-red-500' },
] as const;

export const PRIORITY_STYLES = {
    0: {
        badge: 'bg-green-100 text-green-600',
        card: 'border-l-green-500 bg-green-50/30',
    },
    1: {
        badge: 'bg-yellow-100 text-yellow-600',
        card: 'border-l-yellow-500 bg-yellow-50/30',
    },
    2: {
        badge: 'bg-orange-100 text-orange-600',
        card: 'border-l-orange-500 bg-orange-50/30',
    },
    3: {
        badge: 'bg-red-100 text-red-600',
        card: 'border-l-red-500 bg-red-50/30',
    },
} as const;

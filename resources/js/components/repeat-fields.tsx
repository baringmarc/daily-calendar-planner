import { usePage } from '@inertiajs/react';
import { format, getDay } from 'date-fns';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    REPEAT_INTERVAL_MAX,
    makeRecurrence,
    orderedWeekdays,
    presetOf,
    presetRecurrence,
    repeatPresets,
    weekdayName,
} from '@/constants/recurrence';
import type { RepeatFrequency, RepeatPreset } from '@/constants/recurrence';
import type { ValidationErrors } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { Recurrence } from '@/types';

// What the repeat fields hold while the dialog is open. The custom fields
// keep their values when another preset is picked, so going back to
// "Custom…" doesn't lose them.
export type RepeatState = {
    preset: RepeatPreset;
    interval: number;
    unit: RepeatFrequency;
    weekdays: number[];
    // yyyy-MM-dd, or '' to repeat forever.
    endsOn: string;
};

const UNITS: { value: RepeatFrequency; one: string; many: string }[] = [
    { value: 'daily', one: 'day', many: 'days' },
    { value: 'weekly', one: 'week', many: 'weeks' },
    { value: 'monthly', one: 'month', many: 'months' },
];

export function initialRepeatState(
    rule: Recurrence | null,
    date: Date,
): RepeatState {
    return {
        preset: presetOf(rule, date),
        interval: rule?.interval ?? 1,
        unit: rule?.frequency ?? 'weekly',
        weekdays: rule?.weekdays ?? [getDay(date)],
        endsOn: rule?.ends_on ?? '',
    };
}

/** The rule the fields describe for a task on `date`, or null. */
export function repeatRecurrence(
    state: RepeatState,
    date: Date,
): Recurrence | null {
    const endsOn = state.endsOn || null;

    if (state.preset === 'none') {
        return null;
    }

    if (state.preset !== 'custom') {
        return presetRecurrence(state.preset, date, endsOn);
    }

    return makeRecurrence(
        state.unit,
        state.interval,
        // The task's own day is always one of a weekly rule's days.
        [...state.weekdays, getDay(date)],
        endsOn,
    );
}

/**
 * The task dialog's "Repeat" section (FEAT-09): a preset, or a custom
 * every-N-days/weeks/months rule, and an optional end date.
 */
export function RepeatFields({
    date,
    state,
    onChange,
    errors,
}: {
    // The day the task is on, where the rule starts.
    date: Date;
    state: RepeatState;
    onChange: (state: RepeatState) => void;
    errors: ValidationErrors;
}) {
    const { weekStartsOn } = usePage<{ weekStartsOn: number }>().props;
    const ownDay = getDay(date);
    const update = (changes: Partial<RepeatState>) =>
        onChange({ ...state, ...changes });

    const toggleWeekday = (day: number) =>
        update({
            weekdays: state.weekdays.includes(day)
                ? state.weekdays.filter((d) => d !== day)
                : [...state.weekdays, day],
        });

    return (
        <fieldset className="grid gap-3">
            <div className="grid gap-1.5">
                <Label htmlFor="task-repeat">Repeat</Label>
                <Select
                    value={state.preset}
                    onValueChange={(preset) =>
                        update({ preset: preset as RepeatPreset })
                    }
                >
                    <SelectTrigger id="task-repeat" className="h-10">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {repeatPresets(date).map(({ value, label }) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {state.preset === 'custom' && (
                <div className="grid gap-3 rounded-md bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-sm">
                        <Label htmlFor="task-repeat-interval">Every</Label>
                        <Input
                            id="task-repeat-interval"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={REPEAT_INTERVAL_MAX}
                            value={state.interval}
                            onChange={(e) =>
                                update({
                                    interval: Math.min(
                                        REPEAT_INTERVAL_MAX,
                                        Math.max(
                                            1,
                                            Number(e.target.value) || 1,
                                        ),
                                    ),
                                })
                            }
                            className="h-10 w-20"
                        />
                        <Select
                            value={state.unit}
                            onValueChange={(unit) =>
                                update({ unit: unit as RepeatFrequency })
                            }
                        >
                            <SelectTrigger
                                aria-label="Repeat unit"
                                className="h-10 w-28"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {UNITS.map(({ value, one, many }) => (
                                    <SelectItem key={value} value={value}>
                                        {state.interval === 1 ? one : many}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <InputError message={errors['recurrence.interval']} />

                    {state.unit === 'weekly' && (
                        <div
                            role="group"
                            aria-label="On these days"
                            className="flex flex-wrap gap-1.5"
                        >
                            {orderedWeekdays(weekStartsOn).map((day) => {
                                const isOwnDay = day === ownDay;
                                const isOn =
                                    isOwnDay || state.weekdays.includes(day);

                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        aria-pressed={isOn}
                                        // The rule starts on the task's own
                                        // day, so that day stays included.
                                        disabled={isOwnDay}
                                        title={
                                            isOwnDay
                                                ? `${format(date, 'EEEE')} is the task's day`
                                                : undefined
                                        }
                                        onClick={() => toggleWeekday(day)}
                                        className={cn(
                                            'h-9 min-w-11 rounded-full border px-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
                                            isOn
                                                ? 'border-transparent bg-primary text-primary-foreground'
                                                : 'border-border bg-background hover:bg-muted',
                                        )}
                                    >
                                        {weekdayName(day)}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
            <InputError message={errors['recurrence.weekdays']} />

            {state.preset !== 'none' && (
                <div className="grid gap-1.5">
                    <Label htmlFor="task-repeat-ends">
                        Ends{' '}
                        <span className="font-normal text-muted-foreground">
                            (optional)
                        </span>
                    </Label>
                    <Input
                        id="task-repeat-ends"
                        type="date"
                        min={format(date, 'yyyy-MM-dd')}
                        value={state.endsOn}
                        onChange={(e) => update({ endsOn: e.target.value })}
                        aria-describedby="task-repeat-ends-hint"
                        className="h-10"
                    />
                    <p
                        id="task-repeat-ends-hint"
                        className="text-xs text-muted-foreground"
                    >
                        Leave empty to keep repeating.
                    </p>
                    <InputError message={errors['recurrence.ends_on']} />
                </div>
            )}
        </fieldset>
    );
}

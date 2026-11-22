import { Transition } from '@headlessui/react';
import { Form, Head } from '@inertiajs/react';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import CalendarSettingsController from '@/actions/App/Http/Controllers/Settings/CalendarSettingsController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { deviceTimezone } from '@/lib/clock';
import { cn } from '@/lib/utils';
import { edit } from '@/routes/calendar-settings';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Calendar settings',
        href: edit(),
    },
];

// 0 = Sunday ... 6 = Saturday, listed from Monday.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0].map((value) => ({
    value,
    label: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(
        // Jan 4, 1970 was a Sunday.
        new Date(1970, 0, 4 + value),
    ),
}));

// The native select handles a list this long best: type to jump, and the
// phone's own picker on touch screens. Styled like <Input>.
const SELECT_CLASS =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30';

// "Asia/Ho_Chi_Minh" -> "Asia/Ho Chi Minh (UTC+07:00)".
function zoneLabel(zone: string): string {
    const name = zone.replaceAll('_', ' ');

    try {
        const offset = new Intl.DateTimeFormat('en-US', {
            timeZone: zone,
            timeZoneName: 'longOffset',
        })
            .formatToParts(new Date())
            .find(({ type }) => type === 'timeZoneName')?.value;

        return offset
            ? `${name} (${offset === 'GMT' ? 'UTC+00:00' : offset.replace('GMT', 'UTC')})`
            : name;
    } catch {
        return name;
    }
}

// Zones grouped by region ("Europe/London" is in Europe).
function groupZones(zones: string[]): [string, string[]][] {
    const groups = new Map<string, string[]>();

    for (const zone of zones) {
        const region = zone.includes('/') ? zone.split('/')[0] : 'Other';

        groups.set(region, [...(groups.get(region) ?? []), zone]);
    }

    return [...groups];
}

export default function CalendarSettings({
    timezone,
    weekStartsOn,
    timezones,
}: {
    timezone: string;
    weekStartsOn: number;
    timezones: string[];
}) {
    const queryClient = useQueryClient();
    const [selectedZone, setSelectedZone] = useState(timezone);
    const groups = useMemo(() => groupZones(timezones), [timezones]);
    const device = deviceTimezone();
    const canUseDevice = device !== selectedZone && timezones.includes(device);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Calendar settings" />

            <h1 className="sr-only">Calendar settings</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title="Calendar"
                        description="Choose which day is today and how weeks are laid out"
                    />

                    <Form
                        {...CalendarSettingsController.update.form()}
                        options={{ preserveScroll: true }}
                        // The calendar's cached months were fetched with the
                        // old week start and "today", so load them afresh.
                        onSuccess={() => queryClient.removeQueries()}
                        className="space-y-6"
                    >
                        {({ processing, recentlySuccessful, errors }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="timezone">Time zone</Label>

                                    <select
                                        id="timezone"
                                        name="timezone"
                                        value={selectedZone}
                                        onChange={(e) =>
                                            setSelectedZone(e.target.value)
                                        }
                                        aria-invalid={!!errors.timezone}
                                        aria-describedby="timezone-help"
                                        className={cn(SELECT_CLASS, 'mt-1')}
                                    >
                                        {groups.map(([region, zones]) => (
                                            <optgroup
                                                key={region}
                                                label={region}
                                            >
                                                {zones.map((zone) => (
                                                    <option
                                                        key={zone}
                                                        value={zone}
                                                    >
                                                        {zoneLabel(zone)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>

                                    <p
                                        id="timezone-help"
                                        className="text-sm text-muted-foreground"
                                    >
                                        Decides which day is today, here and on
                                        every device you use.
                                        {canUseDevice && (
                                            <>
                                                {' '}
                                                This device is set to{' '}
                                                {device.replaceAll(
                                                    '_',
                                                    ' ',
                                                )}.{' '}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedZone(device)
                                                    }
                                                    className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    Use this device's time zone
                                                </button>
                                            </>
                                        )}
                                    </p>

                                    <InputError message={errors.timezone} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="week_starts_on">
                                        Week starts on
                                    </Label>

                                    <select
                                        id="week_starts_on"
                                        name="week_starts_on"
                                        defaultValue={weekStartsOn}
                                        aria-invalid={!!errors.week_starts_on}
                                        className={cn(SELECT_CLASS, 'mt-1')}
                                    >
                                        {WEEKDAYS.map(({ value, label }) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>

                                    <InputError
                                        message={errors.week_starts_on}
                                    />
                                </div>

                                <div className="flex items-center gap-4">
                                    <Button disabled={processing}>Save</Button>

                                    <Transition
                                        show={recentlySuccessful}
                                        enter="transition ease-in-out"
                                        enterFrom="opacity-0"
                                        leave="transition ease-in-out"
                                        leaveTo="opacity-0"
                                    >
                                        <p className="text-sm text-neutral-600">
                                            Saved
                                        </p>
                                    </Transition>
                                </div>
                            </>
                        )}
                    </Form>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}

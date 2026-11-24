import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { format, isSameYear, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { PRIORITY_DEFAULT, PRIORITY_MAP } from '@/constants/priority';
import { dayKey } from '@/hooks/use-calendar';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { createTask, parseTask, queryKeys } from '@/lib/calendar-api';
import { isToday, isTomorrow, today } from '@/lib/clock';
import { validationErrors } from '@/lib/errors';
import { cn } from '@/lib/utils';

// Matches ParseTaskRequest's max.
const QUICK_ADD_MAX = 500;

// How long typing has to pause before the preview is fetched.
const PREVIEW_DELAY_MS = 200;

// A parse only depends on the text and the user's day.
const PARSE_STALE_MS = 60_000;

function dayLabel(date: Date): string {
    if (isToday(date)) {
        return 'Today';
    }

    if (isTomorrow(date)) {
        return 'Tomorrow';
    }

    return format(
        date,
        isSameYear(date, today()) ? 'EEE, MMM d' : 'EEE, MMM d, yyyy',
    );
}

/**
 * Adds a task from one line of text (FEAT-03), e.g. "Call Bob tomorrow
 * !high". The server reads the date and priority out of it (spec decision
 * D9), the dialog previews them, and the task is added with the usual
 * `POST /tasks`.
 */
export function QuickAddDialog({
    open,
    onOpenChange,
    defaultDate,
    onOpenDay,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Where the task goes when the text has no date.
    defaultDate: Date;
    // The toast's "Open" action.
    onOpenDay: (date: Date) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                {/* Mounted only while open, so it starts empty each time. */}
                <QuickAddForm
                    defaultDate={defaultDate}
                    onAdded={() => onOpenChange(false)}
                    onOpenDay={onOpenDay}
                />
            </DialogContent>
        </Dialog>
    );
}

function QuickAddForm({
    defaultDate,
    onAdded,
    onOpenDay,
}: {
    defaultDate: Date;
    onAdded: () => void;
    onOpenDay: (date: Date) => void;
}) {
    const queryClient = useQueryClient();
    const [text, setText] = useState('');
    const line = text.trim();
    const previewLine = useDebouncedValue(line, PREVIEW_DELAY_MS);

    const parseQuery = (value: string) => ({
        queryKey: queryKeys.parsedTask(value),
        queryFn: () => parseTask(value),
        staleTime: PARSE_STALE_MS,
    });

    const preview = useQuery({
        ...parseQuery(previewLine),
        enabled: previewLine !== '',
        // The last preview stays while the next one loads.
        placeholderData: keepPreviousData,
        meta: { errorMessage: "Couldn't read the task" },
    });

    const add = useMutation({
        // Parses the exact text being added (usually already cached by the
        // preview), then adds the task.
        mutationFn: async (value: string) => {
            const parsed = await queryClient.fetchQuery(parseQuery(value));
            const date = parsed.date ?? dayKey(defaultDate);
            const task = await createTask({
                description: parsed.description,
                date,
                priority: parsed.priority ?? PRIORITY_DEFAULT,
                recurrence: null,
            });

            return { task, date: parseISO(date) };
        },
        onSuccess: ({ task, date }) => {
            onAdded();
            toast.success(`Added to ${format(date, 'EEE, MMM d')}`, {
                description: task.description,
                action: { label: 'Open', onClick: () => onOpenDay(date) },
            });

            // The task can be on any month, so every cached month is
            // fetched again.
            return queryClient.invalidateQueries({
                queryKey: queryKeys.calendar,
            });
        },
        meta: {
            errorMessage: "Couldn't add the task",
            inlineValidation: true,
        },
    });

    const errors = validationErrors(add.error);
    const error = errors.description ?? errors.text ?? errors.date;

    // The preview, once it matches what's typed.
    const parsed = line !== '' && preview.data ? preview.data : null;
    const isCurrent = parsed !== null && previewLine === line;
    const hasNoDescription = isCurrent && parsed.description === '';
    const canSubmit = line !== '' && !hasNoDescription && !add.isPending;

    const date = parsed?.date ? parseISO(parsed.date) : defaultDate;
    const priority = PRIORITY_MAP[parsed?.priority ?? PRIORITY_DEFAULT];

    return (
        <form
            className="grid gap-4"
            onSubmit={(e) => {
                e.preventDefault();

                if (canSubmit) {
                    add.mutate(line);
                }
            }}
        >
            <DialogHeader>
                <DialogTitle>Quick add</DialogTitle>
                <DialogDescription>
                    Type a task with its day and priority, like “Call Bob
                    tomorrow !high”.
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
                <Label htmlFor="quick-add-text" className="sr-only">
                    Task
                </Label>
                <Input
                    id="quick-add-text"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);

                        if (add.error) {
                            add.reset();
                        }
                    }}
                    placeholder="Call Bob tomorrow !high"
                    maxLength={QUICK_ADD_MAX}
                    autoComplete="off"
                    autoFocus
                    aria-invalid={!!error || hasNoDescription}
                    aria-describedby="quick-add-preview quick-add-help"
                    className="h-11 border-none bg-muted/20 focus-visible:ring-1 focus-visible:ring-accent"
                />
                <InputError message={error} />

                <div
                    id="quick-add-preview"
                    aria-live="polite"
                    className="flex min-h-7 flex-wrap items-center gap-2 text-sm"
                >
                    {line !== '' && (
                        <>
                            <span className="sr-only">Adds</span>
                            {hasNoDescription ? (
                                <span className="text-destructive">
                                    Add a description
                                </span>
                            ) : (
                                <span className="min-w-0 truncate font-medium">
                                    {parsed?.description ?? line}
                                </span>
                            )}
                            <span className="sr-only">to</span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                                    parsed?.date
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground',
                                )}
                            >
                                <CalendarIcon
                                    aria-hidden
                                    className="h-3.5 w-3.5"
                                />
                                {dayLabel(date)}
                            </span>
                            <span className="sr-only">with priority</span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                                    parsed?.priority != null
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground',
                                )}
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        'h-2 w-2 rounded-full',
                                        priority.color,
                                    )}
                                />
                                {priority.label}
                            </span>
                        </>
                    )}
                </div>

                <p
                    id="quick-add-help"
                    className="text-xs text-muted-foreground"
                >
                    Days: today, tomorrow, friday, next week, in 3 days, Dec 3.
                    Priority: !low, !medium, !high, !urgent. Words in "quotes"
                    stay as they are.
                </p>
            </div>

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={!canSubmit}>
                    {add.isPending && <Spinner />}
                    {add.isPending ? 'Adding…' : 'Add task'}
                </Button>
            </DialogFooter>
        </form>
    );
}

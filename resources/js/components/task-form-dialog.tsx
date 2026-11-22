import { format } from 'date-fns';
import { useState } from 'react';
import InputError from '@/components/input-error';
import {
    RepeatFields,
    initialRepeatState,
    repeatRecurrence,
} from '@/components/repeat-fields';
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
import { TASK_DESCRIPTION_MAX } from '@/constants/limits';
import { PRIORITY_DEFAULT, PRIORITY_MAP } from '@/constants/priority';
import type { Priority } from '@/constants/priority';
import { describeRecurrence, sameRecurrence } from '@/constants/recurrence';
import type { ValidationErrors } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { Recurrence, Task } from '@/types';

export type TaskFormValues = {
    description: string;
    priority: Priority;
    // The repeat rule (FEAT-09), or null for a one-off task.
    recurrence: Recurrence | null;
    // For a repeating task: whether the changes also apply to the
    // occurrences after it. Always 'series' once the rule itself changes.
    scope: 'task' | 'series';
};

/**
 * Adds a task when `task` is null, and edits `task` otherwise. Enter
 * submits, and Escape or clicking outside cancels.
 */
export function TaskFormDialog({
    open,
    onOpenChange,
    task,
    date,
    onSubmit,
    isSaving,
    errors,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: Task | null;
    // The day the task is (or will be) on.
    date: Date;
    onSubmit: (values: TaskFormValues) => void;
    isSaving: boolean;
    errors: ValidationErrors;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Scrolls on short screens, now that the repeat options make
                it taller. */}
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
                {/* Mounted only while open, so every opening starts from the
                    task's saved values (or a blank Medium task). */}
                <TaskForm
                    task={task}
                    date={date}
                    onSubmit={onSubmit}
                    isSaving={isSaving}
                    errors={errors}
                />
            </DialogContent>
        </Dialog>
    );
}

function TaskForm({
    task,
    date,
    onSubmit,
    isSaving,
    errors,
}: {
    task: Task | null;
    date: Date;
    onSubmit: (values: TaskFormValues) => void;
    isSaving: boolean;
    errors: ValidationErrors;
}) {
    const [description, setDescription] = useState(task?.description ?? '');
    const [priority, setPriority] = useState<Priority>(
        task?.priority ?? PRIORITY_DEFAULT,
    );

    const [repeat, setRepeat] = useState(() =>
        initialRepeatState(task?.recurrence ?? null, date),
    );
    const [scope, setScope] = useState<'task' | 'series'>('task');

    const recurrence = repeatRecurrence(repeat, date);
    const isRepeating = task?.recurrence != null;
    // A changed rule (including "Doesn't repeat") always applies to the
    // following occurrences too.
    const ruleChanged =
        isRepeating && !sameRecurrence(task.recurrence, recurrence);
    const appliesTo = ruleChanged ? 'series' : scope;

    const canSubmit = description.trim() !== '' && !isSaving;
    const dateLabel = format(date, 'EEEE, MMMM d');

    return (
        <form
            className="grid gap-4"
            onSubmit={(e) => {
                e.preventDefault();

                if (canSubmit) {
                    onSubmit({
                        description: description.trim(),
                        priority,
                        recurrence,
                        scope: appliesTo,
                    });
                }
            }}
        >
            <DialogHeader>
                <DialogTitle>{task ? 'Edit task' : 'Add task'}</DialogTitle>
                <DialogDescription>
                    {task?.recurrence
                        ? `${describeRecurrence(task.recurrence)}. This one is on ${dateLabel}.`
                        : task
                          ? `Change this task's description, priority or repeat.`
                          : `Add a task to ${dateLabel}.`}
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-1.5">
                <Label htmlFor="task-description" className="sr-only">
                    Description
                </Label>
                <Input
                    id="task-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What needs to be done?"
                    maxLength={TASK_DESCRIPTION_MAX}
                    autoComplete="off"
                    autoFocus
                    aria-invalid={!!errors.description}
                    aria-describedby="task-description-count"
                    className="h-11 border-none bg-muted/20 focus-visible:ring-1 focus-visible:ring-accent"
                />
                <div className="flex items-start gap-2">
                    <InputError message={errors.description} />
                    <span
                        id="task-description-count"
                        className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums"
                    >
                        {description.length}/{TASK_DESCRIPTION_MAX}
                    </span>
                </div>
            </div>

            <fieldset className="grid gap-1.5">
                <legend className="sr-only">Priority</legend>
                <div className="flex flex-wrap gap-2">
                    {PRIORITY_MAP.map((p) => (
                        <button
                            key={p.value}
                            type="button"
                            aria-pressed={priority === p.value}
                            onClick={() => setPriority(p.value)}
                            className={cn(
                                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all',
                                priority === p.value
                                    ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-muted/30 hover:bg-muted',
                            )}
                        >
                            <span
                                className={cn('h-2 w-2 rounded-full', p.color)}
                            />
                            {p.label}
                        </button>
                    ))}
                </div>
                <InputError message={errors.priority} />
            </fieldset>

            <RepeatFields
                date={date}
                state={repeat}
                onChange={setRepeat}
                errors={errors}
            />

            {isRepeating && (
                <fieldset className="grid gap-2">
                    <legend className="mb-1 text-sm font-medium">
                        Apply changes to
                    </legend>
                    {(
                        [
                            ['task', 'This task only'],
                            ['series', 'This and the following tasks'],
                        ] as const
                    ).map(([value, label]) => (
                        <label
                            key={value}
                            className={cn(
                                'flex items-center gap-2 text-sm',
                                value === 'task' &&
                                    ruleChanged &&
                                    'text-muted-foreground',
                            )}
                        >
                            <input
                                type="radio"
                                name="task-scope"
                                value={value}
                                checked={appliesTo === value}
                                disabled={value === 'task' && ruleChanged}
                                onChange={() => setScope(value)}
                                className="h-4 w-4 accent-primary"
                            />
                            {label}
                        </label>
                    ))}
                    {ruleChanged && (
                        <p className="text-xs text-muted-foreground">
                            {recurrence
                                ? 'A new repeat rule replaces the unfinished tasks after this one.'
                                : 'The task stops repeating after this one, and the unfinished tasks after it are removed.'}
                        </p>
                    )}
                </fieldset>
            )}

            <DialogFooter className="mt-2">
                <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={!canSubmit}>
                    {isSaving && <Spinner />}
                    {isSaving ? 'Saving…' : task ? 'Save' : 'Add task'}
                </Button>
            </DialogFooter>
        </form>
    );
}

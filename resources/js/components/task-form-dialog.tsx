import { useState } from 'react';
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
import { TASK_DESCRIPTION_MAX } from '@/constants/limits';
import { PRIORITY_DEFAULT, PRIORITY_MAP } from '@/constants/priority';
import type { Priority } from '@/constants/priority';
import type { ValidationErrors } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

export type TaskFormValues = { description: string; priority: Priority };

/**
 * Adds a task when `task` is null, and edits `task` otherwise. Enter
 * submits, and Escape or clicking outside cancels.
 */
export function TaskFormDialog({
    open,
    onOpenChange,
    task,
    dateLabel,
    onSubmit,
    isSaving,
    errors,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: Task | null;
    // e.g. "Saturday, November 21"
    dateLabel: string;
    onSubmit: (values: TaskFormValues) => void;
    isSaving: boolean;
    errors: ValidationErrors;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                {/* Mounted only while open, so every opening starts from the
                    task's saved values (or a blank Medium task). */}
                <TaskForm
                    task={task}
                    dateLabel={dateLabel}
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
    dateLabel,
    onSubmit,
    isSaving,
    errors,
}: {
    task: Task | null;
    dateLabel: string;
    onSubmit: (values: TaskFormValues) => void;
    isSaving: boolean;
    errors: ValidationErrors;
}) {
    const [description, setDescription] = useState(task?.description ?? '');
    const [priority, setPriority] = useState<Priority>(
        task?.priority ?? PRIORITY_DEFAULT,
    );

    const canSubmit = description.trim() !== '' && !isSaving;

    return (
        <form
            className="grid gap-4"
            onSubmit={(e) => {
                e.preventDefault();

                if (canSubmit) {
                    onSubmit({ description: description.trim(), priority });
                }
            }}
        >
            <DialogHeader>
                <DialogTitle>{task ? 'Edit task' : 'Add task'}</DialogTitle>
                <DialogDescription>
                    {task
                        ? `Change this task's description or priority.`
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
                                    ? 'border-transparent bg-accent text-accent-foreground shadow-sm'
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

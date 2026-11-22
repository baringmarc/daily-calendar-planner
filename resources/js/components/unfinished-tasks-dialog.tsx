import { format, isThisYear, parseISO } from 'date-fns';
import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { PRIORITY_MAP, PRIORITY_STYLES } from '@/constants/priority';
import { cn } from '@/lib/utils';
import type { UnfinishedTasks } from '@/types/calendar';

// "Thu, Nov 19", with the year when it isn't this one.
const formatDate = (date: string) => {
    const parsed = parseISO(date);

    return format(
        parsed,
        isThisYear(parsed) ? 'EEE, MMM d' : 'EEE, MMM d, yyyy',
    );
};

/**
 * Offers to move unfinished tasks from earlier days to today. "Not now"
 * (or Escape) closes it until tomorrow.
 */
export function UnfinishedTasksDialog({
    open = false,
    onOpenChange,
    unfinishedTasks,
    carryOverTasks,
    isCarryingOver,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    unfinishedTasks: UnfinishedTasks;
    carryOverTasks: (ids: number[]) => void;
    isCarryingOver: boolean;
}) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                {/* Mounted while open, so it starts with every task ticked. */}
                <CarryOverForm
                    unfinishedTasks={unfinishedTasks}
                    carryOverTasks={carryOverTasks}
                    isCarryingOver={isCarryingOver}
                />
            </AlertDialogContent>
        </AlertDialog>
    );
}

function CarryOverForm({
    unfinishedTasks,
    carryOverTasks,
    isCarryingOver,
}: {
    unfinishedTasks: UnfinishedTasks;
    carryOverTasks: (ids: number[]) => void;
    isCarryingOver: boolean;
}) {
    const allIds = Object.values(unfinishedTasks)
        .flat()
        .map((task) => task.id);
    const [selected, setSelected] = useState(() => new Set(allIds));

    const toggle = (id: number, checked: boolean) =>
        setSelected((prev) => {
            const next = new Set(prev);

            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });

    // Keep the unfinished-task order (oldest day first), not the order the
    // boxes were ticked in.
    const selectedIds = allIds.filter((id) => selected.has(id));

    return (
        <>
            <AlertDialogHeader>
                <AlertDialogTitle>Unfinished tasks</AlertDialogTitle>
                <AlertDialogDescription>
                    You have unfinished tasks from earlier days. Choose the ones
                    to move to today.
                </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">
                    {selectedIds.length} of {allIds.length} selected
                </span>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={selectedIds.length === allIds.length}
                        onClick={() => setSelected(new Set(allIds))}
                    >
                        Select all
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={selectedIds.length === 0}
                        onClick={() => setSelected(new Set())}
                    >
                        Select none
                    </Button>
                </div>
            </div>

            <div className="-mx-1 max-h-[50vh] space-y-4 overflow-y-auto px-1">
                {Object.entries(unfinishedTasks).map(([date, tasks]) => (
                    <fieldset key={date}>
                        <legend className="text-sm font-semibold">
                            {formatDate(date)}
                        </legend>

                        <ul className="mt-1.5 space-y-1">
                            {tasks.map((task) => {
                                const id = `carry-over-${task.id}`;

                                return (
                                    <li key={task.id}>
                                        <label
                                            htmlFor={id}
                                            className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-muted/50"
                                        >
                                            <Checkbox
                                                id={id}
                                                checked={selected.has(task.id)}
                                                onCheckedChange={(checked) =>
                                                    toggle(
                                                        task.id,
                                                        checked === true,
                                                    )
                                                }
                                                className="mt-0.5"
                                            />
                                            <span className="min-w-0 flex-1 text-sm break-words">
                                                {task.description}
                                            </span>
                                            <span
                                                className={cn(
                                                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                                                    PRIORITY_STYLES[
                                                        task.priority
                                                    ].badge,
                                                )}
                                            >
                                                {
                                                    PRIORITY_MAP[task.priority]
                                                        .label
                                                }
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    </fieldset>
                ))}
            </div>

            <AlertDialogFooter>
                <AlertDialogCancel disabled={isCarryingOver}>
                    Not now
                </AlertDialogCancel>
                <Button
                    type="button"
                    disabled={selectedIds.length === 0 || isCarryingOver}
                    onClick={() => carryOverTasks(selectedIds)}
                >
                    {isCarryingOver && <Spinner />}
                    {selectedIds.length === 1
                        ? 'Move 1 task to today'
                        : `Move ${selectedIds.length} tasks to today`}
                </Button>
            </AlertDialogFooter>
        </>
    );
}

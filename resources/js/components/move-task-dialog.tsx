import { addDays, format } from 'date-fns';
import { useState } from 'react';
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
import type { Task } from '@/types';

/**
 * "Pick a date…" from a task's Move menu (FEAT-02). Uses the browser's own
 * date input, which works with the keyboard and on touch screens.
 */
export function MoveTaskDialog({
    task,
    date,
    onOpenChange,
    onMove,
}: {
    // The task being moved, or null when the dialog is closed.
    task: Task | null;
    // The day the task is on now.
    date: Date;
    onOpenChange: (open: boolean) => void;
    // `to` is yyyy-MM-dd.
    onMove: (task: Task, to: string) => void;
}) {
    return (
        <Dialog open={task !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                {task && (
                    <MoveTaskForm task={task} date={date} onMove={onMove} />
                )}
            </DialogContent>
        </Dialog>
    );
}

function MoveTaskForm({
    task,
    date,
    onMove,
}: {
    task: Task;
    date: Date;
    onMove: (task: Task, to: string) => void;
}) {
    const from = format(date, 'yyyy-MM-dd');
    const [to, setTo] = useState(() => format(addDays(date, 1), 'yyyy-MM-dd'));
    const canSubmit = to !== '' && to !== from;

    return (
        <form
            className="grid gap-4"
            onSubmit={(e) => {
                e.preventDefault();

                if (canSubmit) {
                    onMove(task, to);
                }
            }}
        >
            <DialogHeader>
                <DialogTitle>Move task</DialogTitle>
                <DialogDescription>
                    Move “{task.description}” from{' '}
                    {format(date, 'EEEE, MMMM d')} to another day. It goes to
                    the end of that day's list.
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-1.5">
                <Label htmlFor="move-task-date">New date</Label>
                <Input
                    id="move-task-date"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                    autoFocus
                    className="h-11"
                />
            </div>

            <DialogFooter className="mt-2">
                <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={!canSubmit}>
                    Move
                </Button>
            </DialogFooter>
        </form>
    );
}

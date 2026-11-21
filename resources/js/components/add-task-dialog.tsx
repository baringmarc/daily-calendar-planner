import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PRIORITY_DEFAULT, PRIORITY_MAP } from '@/constants/priority';
import type { Priority } from '@/constants/priority';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';

export function AddTaskDialog({
    open = false,
    onOpenChange,
    newTask,
    setNewTask,
    handleAddTask,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    newTask: string;
    setNewTask: (task: string) => void;
    handleAddTask: (task: string, priority: Priority) => Promise<void>;
}) {
    const [priority, setPriority] = useState<Priority>(PRIORITY_DEFAULT);

    return (
        <AlertDialog open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Add Task</AlertDialogTitle>
                    <AlertDialogDescription></AlertDialogDescription>
                </AlertDialogHeader>

                <Input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="What needs to be done?"
                    className="h-11 border-none bg-muted/20 pr-12 focus-visible:ring-1 focus-visible:ring-accent"
                    autoFocus={true}
                />

                <div className="mt-1 flex gap-2">
                    {PRIORITY_MAP.map((p) => (
                        <button
                            key={p.value}
                            type="button"
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

                <AlertDialogFooter className="mt-5">
                    <AlertDialogCancel onClick={() => onOpenChange(false)}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-green-800! text-white"
                        onClick={() => handleAddTask(newTask, priority)}
                    >
                        Submit
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

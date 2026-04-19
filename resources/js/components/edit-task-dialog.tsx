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
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';
import { PRIORITY_MAP } from '@/constants/priority';

export function EditTaskDialog({
    open = false,
    onOpenChange,
    currentEditTask,
    setCurrentEditTask,
    handleEditTask,
}: {
    open: boolean;
    onOpenChange: (task: Task | null) => void;
    currentEditTask: Task | null;
    setCurrentEditTask: React.Dispatch<React.SetStateAction<Task | null>>;
    handleEditTask: (task: Task | null) => Promise<void>;
}) {
    return (
        <AlertDialog open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Edit Task</AlertDialogTitle>
                    <AlertDialogDescription></AlertDialogDescription>
                </AlertDialogHeader>

                <Input
                    value={currentEditTask?.description}
                    onChange={(e) =>
                        setCurrentEditTask((prev) => {
                            if (!prev) return prev;

                            return {
                                ...prev,
                                description: e.target.value,
                            };
                        })
                    }
                    className="h-11 border-none bg-muted/20 pr-12 focus-visible:ring-1 focus-visible:ring-accent"
                    autoFocus={true}
                />

                <div className="mt-1 flex gap-2">
                    {PRIORITY_MAP.map((p) => (
                        <button
                            key={p.value}
                            type="button"
                            onClick={() =>
                                setCurrentEditTask((prev) => {
                                    if (!prev) return prev;

                                    return {
                                        ...prev,
                                        priority: p.value,
                                    };
                                })
                            }
                            className={cn(
                                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all',
                                currentEditTask?.priority === p.value
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
                    <AlertDialogCancel onClick={() => onOpenChange(null)}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-green-800! text-white"
                        onClick={() => handleEditTask(currentEditTask)}
                    >
                        Submit
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

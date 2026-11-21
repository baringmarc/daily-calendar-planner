import InputError from '@/components/input-error';
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
import { PRIORITY_MAP } from '@/constants/priority';
import type { ValidationErrors } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';
import { Input } from './ui/input';

export function EditTaskDialog({
    open = false,
    onOpenChange,
    currentEditTask,
    setCurrentEditTask,
    handleEditTask,
    errors,
}: {
    open: boolean;
    onOpenChange: (task: Task | null) => void;
    currentEditTask: Task | null;
    setCurrentEditTask: React.Dispatch<React.SetStateAction<Task | null>>;
    handleEditTask: (task: Task | null) => Promise<void>;
    errors: ValidationErrors;
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
                            if (!prev) {
                                return prev;
                            }

                            return {
                                ...prev,
                                description: e.target.value,
                            };
                        })
                    }
                    className="h-11 border-none bg-muted/20 pr-12 focus-visible:ring-1 focus-visible:ring-accent"
                    autoFocus={true}
                    aria-invalid={!!errors.description}
                />
                <InputError message={errors.description} />

                <div className="mt-1 flex gap-2">
                    {PRIORITY_MAP.map((p) => (
                        <button
                            key={p.value}
                            type="button"
                            onClick={() =>
                                setCurrentEditTask((prev) => {
                                    if (!prev) {
                                        return prev;
                                    }

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
                <InputError message={errors.priority} />

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

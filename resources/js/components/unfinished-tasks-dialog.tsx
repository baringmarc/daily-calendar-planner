import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Task, UnfinishedTasks } from '@/types/calendar';
import { Square } from 'lucide-react';

export function UnfinishedTasksDialog({
    open = false,
    onOpenChange,
    unfinishedTasks,
    carryOverTasks,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    unfinishedTasks: UnfinishedTasks;
    carryOverTasks: (tasks: UnfinishedTasks) => void;
}) {
    return (
        <AlertDialog open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unfinished Tasks</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unfinished tasks from the previous days. Do you
                        want to carry them over to today?
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="max-h-100 overflow-y-auto border-t-1">
                    {Object.entries(unfinishedTasks).map(([date, tasks]) => (
                        <div key={date} className="mt-4">
                            <p className="text-sm font-semibold">{date}</p>

                            {tasks.map((task: Task) => (
                                <div
                                    key={task.id}
                                    className="mt-1 flex gap-1.5"
                                >
                                    <Square className="h-5 w-3 shrink-0 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                        {task.description}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => onOpenChange(false)}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => carryOverTasks(unfinishedTasks)}
                    >
                        Continue
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

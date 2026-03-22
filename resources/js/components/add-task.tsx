import { Plus } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

export default function AddTask({newTask, setNewTask, isAddingTask}) {
    return (
        <>
                        <Input
                            value={newTask}
                            onChange={(e) => setNewTask(e.target.value)}
                            placeholder="What needs to be done?"
                            className="h-11 border-none bg-muted/20 pr-12 focus-visible:ring-1 focus-visible:ring-accent"
                            // autoFocus={
                            //     isAddingTask && dayData.tasks.length === 0
                            // }
                        />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={!newTask.trim()}
                            className="absolute top-1 right-1 bottom-1 h-auto bg-accent text-accent-foreground hover:bg-accent/90"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        );
                        </>
}

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SHORTCUTS } from '@/hooks/use-keyboard-shortcuts';

/**
 * The list of keyboard shortcuts (FEAT-07), opened with `?` or from the
 * calendar header.
 */
export function KeyboardShortcutsDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Keyboard shortcuts</DialogTitle>
                    <DialogDescription>
                        They work anywhere except while you're typing in a
                        field.
                    </DialogDescription>
                </DialogHeader>
                <dl className="divide-y divide-border text-sm">
                    {SHORTCUTS.map(({ keys, description }) => (
                        <div
                            key={description}
                            className="flex items-center justify-between gap-4 py-2.5"
                        >
                            <dt className="text-muted-foreground">
                                {description}
                            </dt>
                            <dd className="flex shrink-0 gap-1">
                                {keys.map((key) => (
                                    <kbd
                                        key={key}
                                        className="min-w-7 rounded-md border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-xs text-foreground"
                                    >
                                        {key}
                                    </kbd>
                                ))}
                            </dd>
                        </div>
                    ))}
                </dl>
            </DialogContent>
        </Dialog>
    );
}

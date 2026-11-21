import { deleteTaskOnUnload } from '@/lib/calendar-api';

/**
 * Task deletes waiting out their undo window (UX-02). Each one is sent when
 * its timer runs out, or straight away with `commitDelete`, and `cancelDelete`
 * drops it. The timers live here rather than in the toast, so a delete is
 * still sent if the toast is unmounted by a page change.
 */
type PendingDelete = {
    timer: ReturnType<typeof setTimeout>;
    send: () => void;
};

const pending = new Map<number, PendingDelete>();

export function scheduleDelete(id: number, delay: number, send: () => void) {
    cancelDelete(id);
    pending.set(id, { timer: setTimeout(() => commitDelete(id), delay), send });
}

export function commitDelete(id: number) {
    const entry = pending.get(id);

    if (entry) {
        clearTimeout(entry.timer);
        pending.delete(id);
        entry.send();
    }
}

/** Returns false if the delete has already been sent. */
export function cancelDelete(id: number): boolean {
    const entry = pending.get(id);

    if (!entry) {
        return false;
    }

    clearTimeout(entry.timer);
    pending.delete(id);

    return true;
}

// Closing or reloading the tab inside the undo window still deletes the
// task, rather than having it come back.
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        for (const [id, entry] of pending) {
            clearTimeout(entry.timer);
            deleteTaskOnUnload(id);
        }

        pending.clear();
    });
}

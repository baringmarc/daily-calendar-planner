import { useEffect, useRef, useState } from 'react';

// How long typing has to pause before the note is saved.
const AUTOSAVE_DELAY_MS = 800;

export type NoteSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * A day's note draft that saves itself (UX-09): after a pause in typing, on
 * blur (`flush`), and when the day view closes with unsaved changes.
 *
 * Saves run one at a time. Edits made while a save is in flight are saved
 * straight after it, so the first save, which creates the day row, is never
 * raced by a second create.
 */
export function useNoteAutosave({
    savedNote,
    save,
}: {
    // The note as the server last returned it.
    savedNote: string;
    // Rejects if the save failed (the error toast is shown elsewhere).
    save: (note: string) => Promise<void>;
}) {
    const [draft, setDraft] = useState(savedNote);
    const [isDirty, setIsDirty] = useState(false);
    const [status, setStatus] = useState<NoteSaveStatus>('idle');
    const [prevSavedNote, setPrevSavedNote] = useState(savedNote);

    // Follow the saved note when it changes underneath the panel, e.g. when
    // the day's data finishes loading after the panel opened. Without this
    // the textarea keeps the empty value it mounted with, and saving it
    // would write '' over the real note (BUG-07). Unsaved edits are kept.
    if (savedNote !== prevSavedNote) {
        setPrevSavedNote(savedNote);

        if (!isDirty) {
            setDraft(savedNote);
        }
    }

    // What the async save loop reads, since it outlives the render that
    // started it.
    const latest = useRef({ draft, isDirty, save });
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlight = useRef(false);
    const queued = useRef(false);

    useEffect(() => {
        latest.current = { draft, isDirty, save };
    });

    const flush = async () => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }

        if (!latest.current.isDirty) {
            return;
        }

        if (inFlight.current) {
            queued.current = true;

            return;
        }

        const note = latest.current.draft;
        inFlight.current = true;
        setStatus('saving');

        try {
            await latest.current.save(note);

            // Typing may have carried on while it saved.
            const isCurrent = latest.current.draft === note;
            latest.current.isDirty = !isCurrent;
            setIsDirty(!isCurrent);
            setStatus(isCurrent ? 'saved' : 'idle');
        } catch {
            setStatus('error');
        } finally {
            inFlight.current = false;
        }

        if (queued.current) {
            queued.current = false;
            void flush();
        }
    };

    const change = (note: string) => {
        setDraft(note);
        setIsDirty(true);
        setStatus('idle');
        latest.current = { ...latest.current, draft: note, isDirty: true };

        if (timer.current) {
            clearTimeout(timer.current);
        }

        timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    };

    // Leaving the day (back button, browser back) saves what's left.
    const flushRef = useRef(flush);

    useEffect(() => {
        flushRef.current = flush;
    });

    useEffect(() => () => void flushRef.current(), []);

    return { draft, change, flush, status };
}

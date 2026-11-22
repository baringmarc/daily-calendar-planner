import { useEffect, useRef } from 'react';

// The keys the calendar answers to (FEAT-07), as KeyboardEvent.key values
// (letters lower-cased).
export type ShortcutKey =
    | 'n'
    | 't'
    | 'm'
    | 'w'
    | 'a'
    | '?'
    | 'ArrowLeft'
    | 'ArrowRight'
    | 'Escape';

export type ShortcutHandlers = Partial<Record<ShortcutKey, () => void>>;

// What the help dialog lists, in order.
export const SHORTCUTS: { keys: string[]; description: string }[] = [
    { keys: ['N'], description: 'New task (for today in a calendar view)' },
    { keys: ['T'], description: 'Open today' },
    { keys: ['←', '→'], description: 'Previous or next month, week or day' },
    { keys: ['M', 'W', 'A'], description: 'Month, week or agenda view' },
    { keys: ['Esc'], description: 'Back to the calendar from a day' },
    { keys: ['?'], description: 'Show these shortcuts' },
];

// Holding an arrow pages repeatedly. The other keys act once per press.
const REPEATABLE = new Set<string>(['ArrowLeft', 'ArrowRight']);

// Open layers that keep the keys to themselves: dialogs, menus and the
// select lists.
const OPEN_LAYER =
    '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

function isTyping(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            target.closest('input, textarea, select') !== null)
    );
}

function shortcutKey(event: KeyboardEvent): string {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

/**
 * Calls the handler for a shortcut key pressed anywhere on the page.
 *
 * Keys are ignored while typing in a field, while a dialog or menu is open,
 * with Ctrl, Cmd or Alt held, and once something else has handled them
 * (`defaultPrevented`): dnd-kit's keyboard drags and Radix's arrow-key
 * navigation both do, and they listen before the window does.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
    // The latest handlers, without re-adding the listener on every render.
    const handlersRef = useRef(handlers);

    useEffect(() => {
        handlersRef.current = handlers;
    });

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                isTyping(event.target) ||
                document.querySelector(OPEN_LAYER) !== null
            ) {
                return;
            }

            const key = shortcutKey(event);
            const handler = handlersRef.current[key as ShortcutKey];

            if (!handler || (event.repeat && !REPEATABLE.has(key))) {
                return;
            }

            // So the key isn't also typed into a field the shortcut opens.
            event.preventDefault();
            handler();
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
}

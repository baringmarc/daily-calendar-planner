import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { format, isSameYear, parseISO } from 'date-fns';
import { CheckCircle2, Circle, Search, StickyNote } from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { PRIORITY_MAP, PRIORITY_STYLES } from '@/constants/priority';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { queryKeys, searchTasksAndNotes } from '@/lib/calendar-api';
import { isToday, today } from '@/lib/clock';
import { cn } from '@/lib/utils';
import type { SearchDay, SearchGroup } from '@/types';

// Matches SearchRequest's min and max.
const TERM_MIN = 2;
const TERM_MAX = 100;

// How long typing has to pause before searching.
const SEARCH_DELAY_MS = 250;

// How much of a matching note shows either side of the match.
const SNIPPET_BEFORE = 40;
const SNIPPET_AFTER = 80;

const RESULT_SELECTOR = '[data-search-result]';

/**
 * Searches the user's tasks and notes (FEAT-06), opened with `/` or from
 * the calendar header. Choosing a day opens it.
 */
export function SearchDialog({
    open,
    onOpenChange,
    onOpenDay,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenDay: (date: Date) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <DialogTitle className="sr-only">
                    Search tasks and notes
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Results are grouped by day. Use the arrow keys to move
                    between them and Enter to open a day.
                </DialogDescription>
                {/* Mounted only while open, so it starts empty each time. */}
                <SearchPanel
                    onOpenDay={(date) => {
                        onOpenChange(false);
                        onOpenDay(date);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

function SearchPanel({ onOpenDay }: { onOpenDay: (date: Date) => void }) {
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const term = useDebouncedValue(text.trim(), SEARCH_DELAY_MS);
    const canSearch = term.length >= TERM_MIN;

    const search = useQuery({
        queryKey: queryKeys.search(term),
        // Keeps the term with its results, to highlight the right words
        // while the next search loads.
        queryFn: async () => ({
            term,
            results: await searchTasksAndNotes(term),
        }),
        enabled: canSearch,
        placeholderData: keepPreviousData,
        meta: { errorMessage: "Couldn't search" },
    });

    const shown = text.trim().length >= TERM_MIN ? search.data : undefined;
    const dayCount = shown
        ? shown.results.upcoming.days.length + shown.results.earlier.days.length
        : 0;

    const results = () =>
        Array.from(
            resultsRef.current?.querySelectorAll<HTMLElement>(
                RESULT_SELECTOR,
            ) ?? [],
        );

    const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            results()[0]?.focus();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            results()[0]?.click();
        }
    };

    const onResultsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return;
        }

        event.preventDefault();

        const list = results();
        const index = list.indexOf(document.activeElement as HTMLElement);
        const next = index + (event.key === 'ArrowDown' ? 1 : -1);

        if (next < 0) {
            inputRef.current?.focus();
        } else {
            list[Math.min(next, list.length - 1)]?.focus();
        }
    };

    return (
        <>
            <div className="flex items-center gap-3 border-b px-4 py-3 pr-12">
                <Search
                    aria-hidden
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                />
                <input
                    ref={inputRef}
                    type="search"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder="Search tasks and notes"
                    aria-label="Search tasks and notes"
                    maxLength={TERM_MAX}
                    autoComplete="off"
                    autoFocus
                    className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                />
                {search.isFetching && <Spinner />}
            </div>

            <div
                ref={resultsRef}
                onKeyDown={onResultsKeyDown}
                className="min-h-0 flex-1 overflow-y-auto p-2"
            >
                <p className="sr-only" aria-live="polite">
                    {shown &&
                        !search.isFetching &&
                        `${dayCount} ${dayCount === 1 ? 'day' : 'days'} found`}
                </p>

                {!shown ? (
                    <Message>
                        {text.trim().length < TERM_MIN
                            ? 'Type at least 2 characters to search your tasks and notes.'
                            : 'Searching…'}
                    </Message>
                ) : dayCount === 0 ? (
                    <Message>No tasks or notes match “{shown.term}”.</Message>
                ) : (
                    <>
                        <ResultGroup
                            title="Today and upcoming"
                            group={shown.results.upcoming}
                            more="More upcoming days match. Add words to narrow the search."
                            term={shown.term}
                            onOpenDay={onOpenDay}
                        />
                        <ResultGroup
                            title="Earlier"
                            group={shown.results.earlier}
                            more="More earlier days match. Add words to narrow the search."
                            term={shown.term}
                            onOpenDay={onOpenDay}
                        />
                    </>
                )}
            </div>
        </>
    );
}

function Message({ children }: { children: ReactNode }) {
    return (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {children}
        </p>
    );
}

function ResultGroup({
    title,
    group,
    more,
    term,
    onOpenDay,
}: {
    title: string;
    group: SearchGroup;
    more: string;
    term: string;
    onOpenDay: (date: Date) => void;
}) {
    if (group.days.length === 0) {
        return null;
    }

    const headingId = `search-${title.replaceAll(' ', '-').toLowerCase()}`;

    return (
        <section aria-labelledby={headingId} className="pb-2">
            <h3
                id={headingId}
                className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
                {title}
            </h3>
            <ul>
                {group.days.map((day) => (
                    <li key={day.date}>
                        <SearchResult
                            day={day}
                            term={term}
                            onOpen={() => onOpenDay(parseISO(day.date))}
                        />
                    </li>
                ))}
            </ul>
            {group.has_more && (
                <p className="px-3 pt-1 text-xs text-muted-foreground">
                    {more}
                </p>
            )}
        </section>
    );
}

function SearchResult({
    day,
    term,
    onOpen,
}: {
    day: SearchDay;
    term: string;
    onOpen: () => void;
}) {
    const date = parseISO(day.date);

    return (
        <button
            type="button"
            data-search-result
            onClick={onOpen}
            className="block w-full rounded-md px-3 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
            <span className="flex items-center gap-2 text-sm font-semibold">
                {format(
                    date,
                    isSameYear(date, today())
                        ? 'EEE, MMM d'
                        : 'EEE, MMM d, yyyy',
                )}
                {isToday(date) && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                        Today
                    </span>
                )}
            </span>

            {day.tasks.map((task) => (
                <span
                    key={task.id}
                    className="mt-1 flex items-center gap-2 text-sm"
                >
                    {task.is_finished ? (
                        <CheckCircle2
                            aria-label="Done"
                            className="h-4 w-4 shrink-0 text-primary"
                        />
                    ) : (
                        <Circle
                            aria-hidden
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                        />
                    )}
                    <span
                        className={cn(
                            'w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium',
                            PRIORITY_STYLES[task.priority].badge,
                        )}
                    >
                        {PRIORITY_MAP[task.priority].label}
                    </span>
                    <span
                        className={cn(
                            'min-w-0 flex-1 break-words',
                            task.is_finished &&
                                'text-muted-foreground line-through',
                        )}
                    >
                        <Highlight text={task.description} term={term} />
                    </span>
                </span>
            ))}

            {day.note && (
                <span className="mt-1 flex gap-2 text-sm text-muted-foreground">
                    <StickyNote
                        aria-label="Note"
                        className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span className="min-w-0 break-words">
                        <Highlight
                            text={noteSnippet(day.note, term)}
                            term={term}
                        />
                    </span>
                </span>
            )}
        </button>
    );
}

// The note on one line, cut down to the text around the first match.
function noteSnippet(note: string, term: string): string {
    const flat = note.replace(/\s+/g, ' ').trim();
    const at = flat.toLowerCase().indexOf(term.toLowerCase());
    const start = Math.max(0, at - SNIPPET_BEFORE);
    const end = Math.min(
        flat.length,
        Math.max(at, 0) + term.length + SNIPPET_AFTER,
    );

    return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}

// Every case-insensitive occurrence of `term` in `text`, marked.
function Highlight({ text, term }: { text: string; term: string }) {
    const lower = text.toLowerCase();
    const needle = term.toLowerCase();
    const parts: ReactNode[] = [];
    let from = 0;

    for (
        let at = lower.indexOf(needle);
        needle !== '' && at !== -1;
        at = lower.indexOf(needle, from)
    ) {
        parts.push(text.slice(from, at));
        parts.push(
            <mark
                key={at}
                className="rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-500/30"
            >
                {text.slice(at, at + needle.length)}
            </mark>,
        );
        from = at + needle.length;
    }

    parts.push(text.slice(from));

    return <>{parts}</>;
}

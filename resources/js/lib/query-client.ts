import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/calendar-api';
import { errorReason, isValidationError } from '@/lib/errors';

declare module '@tanstack/react-query' {
    interface Register {
        queryMeta: {
            /** Toast title when the query fails, e.g. "Couldn't load the calendar". */
            errorMessage?: string;
        };
        mutationMeta: {
            /** Toast title when the mutation fails, e.g. "Couldn't add the task". */
            errorMessage?: string;
            /** A 422 is shown next to the form's fields, so skip the toast. */
            inlineValidation?: boolean;
        };
    }
}

/**
 * Failed requests show a toast instead of failing silently, and a failed
 * mutation refetches the calendar so the screen matches the server again.
 */
export function createQueryClient() {
    const queryClient: QueryClient = new QueryClient({
        queryCache: new QueryCache({
            onError: (error, query) => {
                if (query.meta?.errorMessage) {
                    // One toast per query, however often it is retried.
                    toast.error(query.meta.errorMessage, {
                        id: query.queryHash,
                        description: errorReason(error),
                    });
                }
            },
        }),
        mutationCache: new MutationCache({
            onError: (error, _variables, _context, mutation) => {
                if (
                    !(
                        mutation.meta?.inlineValidation &&
                        isValidationError(error)
                    )
                ) {
                    toast.error(
                        mutation.meta?.errorMessage ?? 'Something went wrong',
                        { description: errorReason(error) },
                    );
                }

                return queryClient.invalidateQueries({
                    queryKey: queryKeys.calendar,
                });
            },
        }),
        defaultOptions: {
            queries: {
                // A 4xx won't succeed on a retry, so only retry other errors.
                retry: (failureCount, error) =>
                    failureCount < 2 &&
                    !(
                        isAxiosError(error) &&
                        error.response &&
                        error.response.status < 500
                    ),
            },
        },
    });

    return queryClient;
}

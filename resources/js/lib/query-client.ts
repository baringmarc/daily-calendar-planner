import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

export function createQueryClient() {
    return new QueryClient({
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
}

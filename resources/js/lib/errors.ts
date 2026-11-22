import { isAxiosError } from 'axios';

/** Laravel's 422 body, reduced to the first message for each field. */
export type ValidationErrors = Partial<Record<string, string>>;

export function isValidationError(error: unknown): boolean {
    return isAxiosError(error) && error.response?.status === 422;
}

export function validationErrors(error: unknown): ValidationErrors {
    if (!isAxiosError(error) || error.response?.status !== 422) {
        return {};
    }

    const errors: Record<string, string[]> = error.response.data?.errors ?? {};

    return Object.fromEntries(
        Object.entries(errors).map(([field, messages]) => [field, messages[0]]),
    );
}

/**
 * Why a request failed, in words the user can act on. Shown as a toast's
 * description under a title that says what failed.
 */
export function errorReason(error: unknown): string {
    if (!isAxiosError(error)) {
        return 'Something went wrong. Please try again.';
    }

    if (!error.response) {
        return 'Check your connection and try again.';
    }

    switch (error.response.status) {
        case 401:
        case 419:
            return 'Your session has expired. Reload the page to sign in again.';
        case 403:
        case 404:
            return 'It may have been changed or deleted somewhere else.';
        case 422:
            return (
                Object.values(validationErrors(error))[0] ??
                'Please check what you entered.'
            );
        case 429:
            return 'Too many requests. Wait a moment and try again.';
        default:
            return 'Something went wrong on our side. Please try again.';
    }
}

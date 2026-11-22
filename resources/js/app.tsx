import { createInertiaApp, router } from '@inertiajs/react';
import { QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import '../css/app.css';
import { initializeTheme } from '@/hooks/use-appearance';
import { deviceTimezone, setUserTimezone } from '@/lib/clock';
import { createQueryClient } from '@/lib/query-client';

// The device's time zone. The server stores it on a user who has none yet,
// and uses it for "today" until then (App\Support\UserClock, FEAT-01).
axios.defaults.headers.common['X-Timezone'] = deviceTimezone();

// "Today" in the browser follows the user's stored zone, like the server.
router.on('navigate', (event) =>
    setUserTimezone(event.detail.page.props.auth?.user?.timezone),
);

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

const queryClient = createQueryClient();

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        setUserTimezone(props.initialPage.props.auth?.user?.timezone);

        const root = createRoot(el);

        root.render(
            <StrictMode>
                <QueryClientProvider client={queryClient}>
                    <TooltipProvider delayDuration={0}>
                        <ThemeProvider
                            attribute="class"
                            defaultTheme="system"
                            enableSystem
                        >
                            <App {...props} />
                        </ThemeProvider>
                    </TooltipProvider>
                </QueryClientProvider>
            </StrictMode>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();

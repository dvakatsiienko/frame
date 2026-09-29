import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';

import { SectionFallback } from '@/components/SectionFallback.tsx';

import { App } from '@/App.tsx';
import './theme.css';

const queryClient = new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});
const root = document.getElementById('root');

if (!root) throw new Error('#root missing');

createRoot(root, {
    onUncaughtError: (error) => console.error('speak: uncaught', error),
}).render(
    <StrictMode>
        <ErrorBoundary FallbackComponent={SectionFallback}>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </ErrorBoundary>
    </StrictMode>,
);

import type { FallbackProps } from 'react-error-boundary';

// stays inside the section's own box, names what failed, offers a retry
export const SectionFallback = (props: FallbackProps) => {
    const detail =
        props.error instanceof Error
            ? props.error.message
            : String(props.error);

    return (
        <section className='grid content-start gap-2 rounded-lg border border-line p-3'>
            <p className='m-0 font-semibold'>this column stopped drawing</p>
            <button
                className='justify-self-start rounded-md border border-line bg-surface-2 px-3 py-1 text-sm hover:bg-surface'
                onClick={props.resetErrorBoundary}
                type='button'>
                retry
            </button>
            {import.meta.env.DEV && (
                <details className='text-sm text-muted'>
                    <summary>detail</summary>
                    <pre className='whitespace-pre-wrap'>{detail}</pre>
                </details>
            )}
        </section>
    );
};

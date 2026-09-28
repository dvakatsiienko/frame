/* Core */
/* Components */
import { BoardPage } from '@/board.tsx';
/* Instruments */
import { useStatsPrefetcher } from '@/queries.ts';
import { navigate, useRoute } from '@/router.ts';
import { StatsPage } from '@/stats.tsx';
import { TAB } from '@/ui.ts';

const pages = [
    { label: 'board', path: '/' },
    { label: 'stats', path: '/stats' },
] as const;

export const App = () => {
    const route = useRoute();
    const path = route.path === '/stats' ? '/stats' : '/';
    const prefetchStats = useStatsPrefetcher();

    const navJSX = pages.map((page) => {
        return (
            <button
                aria-current={page.path === path ? 'page' : undefined}
                className={`${TAB} ${page.path === path ? 'border-accent bg-sel text-ink' : 'border-line bg-transparent text-ink-2'}`}
                key={page.path}
                onClick={() => navigate(page.path)}
                // Stats reparses the whole press log to answer; the pointer travelling to the
                // tab is time the daemon can spend instead of the reader.
                onMouseEnter={
                    page.path === '/stats' ? prefetchStats : undefined
                }
                type='button'>
                {page.label}
            </button>
        );
    });

    return (
        <div className='mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-[22px]'>
            <header className='flex flex-wrap items-baseline gap-x-[18px] gap-y-2'>
                <h1 className='m-0 font-sans text-[22px]/[1.2] font-semibold text-balance'>
                    chords
                </h1>
                <nav className='flex gap-1.5'>{navJSX}</nav>
            </header>

            <main className='grid grid-cols-[minmax(0,1fr)] gap-[22px]'>
                {path === '/stats' ? (
                    <StatsPage />
                ) : (
                    <BoardPage params={route.params} />
                )}
            </main>

            <footer className='border-t border-line pt-3 text-[12px] text-ink-2'>
                seeded by <span className='font-mono'>pnpm hotkeys:scan</span>{' '}
                in frame — wispr flow, cursor and macos are read from their
                files; raycast, cleanshot and 1password are typed by hand in{' '}
                <span className='font-mono'>hotkeys/manual.ts</span>. notes live
                in <span className='font-mono'>hotkeys/notes.json</span>,
                committed.
            </footer>
        </div>
    );
};

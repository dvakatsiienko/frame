import type { Engine, Status } from '@/api.ts';

// state by word and border, never by colour alone
export const StateBadge = (props: StateBadgeProps) => {
    const state = props.state?.state ?? 'unknown';
    const until = props.state?.until
        ? ` until ${new Date(props.state.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '';

    return (
        <span
            className={`rounded border border-current px-2 text-sm ${stateColour[state] ?? 'text-muted'}`}>
            {state}
            {until}
        </span>
    );
};

/* Helpers */
const stateColour: Record<string, string> = {
    benched: 'text-warn',
    live: 'text-ok',
    'no key': 'text-bad',
};

/* Types */
interface StateBadgeProps {
    state?: NonNullable<Status['engines']>[Engine];
}

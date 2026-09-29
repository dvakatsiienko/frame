import type { Engine, Status } from '@/api.ts';

// state by word and border, never by colour alone
export const StateBadge = (props: StateBadgeProps) => {
    const state = props.state?.state ?? 'unknown';
    const until = props.state?.until
        ? ` until ${new Date(props.state.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '';

    return (
        <span
            className={`rounded border border-current px-2 text-sm ${stateColour[state] ?? 'text-muted'}`}
            title={props.state?.note && quotaTitle(props.state.note)}>
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
    // a waiting state, not an error: the chain already skips it, so it reads quiet
    'no quota': 'text-muted',
};

// elevenlabs says «You have 14 credits remaining, while 22 …»; the number leads, the provider's words follow
const quotaTitle = (note: string) => {
    const left = note.match(/have (\d+) credits? remaining/)?.[1];
    const lead = left === undefined ? 'out of quota' : `${left} credits left`;
    return `${lead} — the chain skips it until they return. ${note}`;
};

/* Types */
interface StateBadgeProps {
    state?: NonNullable<Status['engines']>[Engine];
}

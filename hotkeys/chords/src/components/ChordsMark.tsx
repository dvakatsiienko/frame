// the app's mark: four keycaps held as one chord. three wear an owner's colour as their top edge
// (the owner edge rule, drawn small), the fourth is held down in signal blue. flat — zero blur
export const ChordsMark = (props: ChordsMarkProps) => {
    const capListJSX = CAPS.map((cap) => {
        return (
            <g key={`${cap.x}-${cap.y}`}>
                <rect
                    fill={
                        cap.isHeld ? 'var(--color-accent)' : 'var(--color-cap)'
                    }
                    height='9'
                    rx='2'
                    stroke={cap.isHeld ? 'none' : 'var(--color-cap-edge)'}
                    width='9'
                    x={cap.x}
                    y={cap.y + (cap.isHeld ? 0.75 : 0)}
                />
                {cap.edge && (
                    <rect
                        fill={cap.edge}
                        height='2'
                        rx='1'
                        width='6'
                        x={cap.x + 1.5}
                        y={cap.y + 1.25}
                    />
                )}
            </g>
        );
    });

    return (
        <svg aria-hidden='true' className={props.className} viewBox='0 0 22 22'>
            {capListJSX}
        </svg>
    );
};

/* Helpers */
// raycast coral, wispr violet, cursor amber — three owners from DESIGN.md's application tags
const CAPS = [
    { edge: '#ff5c5c', isHeld: false, x: 1.5, y: 1.5 },
    { edge: '#8b5cf6', isHeld: false, x: 11.5, y: 1.5 },
    { edge: '#f59e0b', isHeld: false, x: 1.5, y: 11.5 },
    { edge: undefined, isHeld: true, x: 11.5, y: 11.5 },
];

/* Types */
interface ChordsMarkProps {
    className?: string;
}

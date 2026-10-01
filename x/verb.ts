export const exitCodes = { confirm: 4, failed: 1, ok: 0, usage: 2 } as const;

// every error names the command that moves the caller forward
export class Fail extends Error {
    next: string;
    isUsage: boolean;

    constructor(message: string, next: string, isUsage = false) {
        super(message);
        this.next = next;
        this.isUsage = isUsage;
    }
}

/* Types */
export type Data = Record<string, unknown>;

export type FlagSpec = { type: 'boolean' | 'string'; description: string };

export type ArgSpec = {
    name: string;
    description: string;
    isOptional?: boolean;
    isVariadic?: boolean;
};

// a verb that publishes or destroys carries a plan: dispatch prints it and exits 4
// until --apply, so the gate lives in the entry, never in run()
export type Verb = {
    name: string;
    purpose: string;
    args: readonly ArgSpec[];
    run: (args: string[]) => Data;
} & (
    | { needsApply: false }
    | { needsApply: true; plan: (args: string[]) => Data }
);

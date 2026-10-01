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
export type Outcome =
    | { status: 'ok'; data: Record<string, unknown> }
    | { status: 'confirm'; plan: Record<string, unknown> };

export type FlagSpec = { type: 'boolean' | 'string'; description: string };

export type ArgSpec = {
    name: string;
    description: string;
    isOptional?: boolean;
    isVariadic?: boolean;
};

export type Input = {
    args: string[];
    isApplied: boolean;
};

export type Verb = {
    name: string;
    purpose: string;
    args: readonly ArgSpec[];
    // publishes or destroys: without --apply it prints its plan and exits 4
    needsApply: boolean;
    run: (input: Input) => Outcome;
};

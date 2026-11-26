// a quit: each module variable goes back to its load value through its owner, so nothing of one session outlives it in
// the process; a /clear or a resume keeps them. the wiring's layer, beside register.tsx: it imports every owner that
// keeps one, and stash-resets.test.ts (script/lib) reds one that is missing here

import { resetFields } from './fields.ts';
import { resetHeld } from './held.ts';
import { resetJoins } from './joins.ts';
import { resetKeepWarm } from './keep-warm.ts';
import { resetLanes } from './lanes.ts';
import { resetOrbitStore } from './orbit-store.ts';
import { resetOverride } from './override.ts';
import { resetParkedWake } from './parked-wake.ts';
import { resetQuietGate } from './quiet-gate.ts';
import { resetRows } from './rows.ts';
import { resetIdentity } from './session-identity.ts';
import { resetSessionRecord } from './session-record.ts';
import { resetSessionStart } from './session-start.ts';
import { resetSettings } from './settings-store.ts';
import { resetTurn } from './turn.ts';
import { resetTurnLog } from './turn-log.ts';
import { resetTurnNotes } from './turn-notes.ts';
import { resetUsage } from './usage.ts';
import { resetView } from './view.ts';
import { resetWindRun } from './wind-run.ts';

export function resetModules() {
    resetFields();
    resetHeld();
    resetJoins();
    resetKeepWarm();
    resetLanes();
    resetOrbitStore();
    resetOverride();
    resetParkedWake();
    resetQuietGate();
    resetRows();
    resetIdentity();
    resetSessionRecord();
    resetSessionStart();
    resetSettings();
    resetTurnNotes();
    resetTurn();
    resetTurnLog();
    resetUsage();
    resetView();
    resetWindRun();
}

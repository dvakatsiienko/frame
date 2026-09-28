// Every file the scan reads, in one place, because two readers need the list: scan.ts opens
// them, and live.ts stats them to know when the bindings are stale. A second copy would go
// wrong the first time an app moved its config, and the map would quietly stop updating.
import { homedir } from 'node:os';
import { join } from 'node:path';

const home = homedir();
const preference = (bundle: string) =>
    join(home, 'Library/Preferences', `${bundle}.plist`);

export const wisprConfig = join(
    home,
    'Library/Application Support/Wispr Flow/config.json',
);
export const cursorKeybindings = join(
    home,
    'Library/Application Support/Cursor/User/keybindings.json',
);
export const macosPreference = preference('com.apple.symbolichotkeys');

// Raycast, cleanshot and 1password seal their shortcuts, so those rows are typed by hand.
// Editing that file is a binding change like any other, and the map should follow it.
export const manualList = join(import.meta.dirname, 'manual.ts');

export const sourceList = [
    wisprConfig,
    cursorKeybindings,
    macosPreference,
    manualList,
] as const;

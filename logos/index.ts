import { logos } from './data.gen.ts';

export type LogoName = keyof typeof logos;
export type Theme = 'light' | 'dark';

export const hasLogo = (name: string): name is LogoName =>
    Object.hasOwn(logos, name);

// the dark file when the brand ships one, the light file otherwise
export const logoOf = (name: LogoName, theme: Theme = 'light'): string => {
    const mark: { light: string; dark?: string } = logos[name];
    return (theme === 'dark' && mark.dark) || mark.light;
};

// a mac app's own icon, stored under its bundle id by `logo.ts --app`
export const appLogo = (bundleId: string) => {
    const name = bundleId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return hasLogo(name) ? name : undefined;
};

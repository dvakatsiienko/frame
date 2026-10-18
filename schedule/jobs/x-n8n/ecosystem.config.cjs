// pm2 app for the local n8n, the blueprints tool on trial (docs/test-drive/blueprints.md); its data stays out of git
const home = '/Users/dima';

module.exports = {
    apps: [
        {
            args: 'start',
            autorestart: true,
            env: {
                N8N_DIAGNOSTICS_ENABLED: 'false',
                N8N_PERSONALIZATION_ENABLED: 'false',
                N8N_PORT: '5678',
                N8N_USER_FOLDER: `${home}/.local/share/x-n8n`,
                // the pnpm shim runs `node` from PATH: fnm's default alias, never a version dir
                PATH: `${home}/.local/share/fnm/aliases/default/bin:/usr/bin:/bin`,
            },
            error_file: `${home}/.local/share/x-n8n/daemon.err.log`,
            exp_backoff_restart_delay: 100,
            interpreter: 'none',
            kill_timeout: 10000,
            max_restarts: 16,
            min_uptime: '10s',
            name: 'x-n8n',
            out_file: `${home}/.local/share/x-n8n/daemon.log`,
            script: `${home}/Library/pnpm/bin/n8n`,
            time: true,
            watch: false,
        },
    ],
};

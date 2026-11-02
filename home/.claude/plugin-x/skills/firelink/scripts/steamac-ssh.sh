#!/bin/zsh
# the door into the steamac VM: key auth, localhost only; args run as a remote command
# first run installs the key with the launcher's Keychain password: steamac-ssh.sh --install-key
set -euo pipefail
key=~/.ssh/steamac_ed25519
opts=(-p 2222 -o IdentitiesOnly=yes -o IdentityAgent=none -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=~/.ssh/known_hosts_steamac -o LogLevel=ERROR)
if [[ "${1:-}" == --install-key ]]; then
  SSH_ASKPASS="${0:A:h}/steamac-askpass.sh" SSH_ASKPASS_REQUIRE=force \
    ssh "${opts[@]}" -o PubkeyAuthentication=no steamos@127.0.0.1 \
    'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys' < "$key.pub"
  exit
fi
exec ssh "${opts[@]}" -i "$key" -o BatchMode=yes steamos@127.0.0.1 "$@"

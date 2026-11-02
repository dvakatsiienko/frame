#!/bin/zsh
# prints the SteamOS user password the launcher keeps in the Keychain (one item per disk)
security find-generic-password -s es.fxgam.steamac.guest-password -w

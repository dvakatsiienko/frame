#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title speak
# @raycast.mode silent
# @raycast.packageName speak
# @raycast.keyword speak

# select text, fire the hotkey → read aloud; fire it again → stop. the whole feature lives in ~/frame/speak
# raycast's PATH has no fnm shims, so node comes from fnm's default alias
exec "$HOME/.local/share/fnm/aliases/default/bin/node" "$HOME/frame/speak/speak.ts"

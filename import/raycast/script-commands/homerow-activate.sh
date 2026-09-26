#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Homerow
# @raycast.mode silent
# @raycast.packageName Homerow
# @raycast.icon 🎯
# @raycast.description Show Homerow's click labels by pressing its hidden F19 shortcut, so a bare Hyper press can open it.

# key code 80 is F19; Homerow has no url scheme or AppleScript dictionary.
# no modifiers: a synthetic ⌃⌥⇧⌘ reads to Raycast as a bare Hyper press and re-runs this command in a loop
osascript -e 'tell application "System Events" to key code 80'

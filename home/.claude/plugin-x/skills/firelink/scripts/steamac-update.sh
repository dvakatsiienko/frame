#!/bin/zsh
# swaps FX Steam Launcher for the latest github release; settings and the SteamOS disk in ~/Library stay
set -euo pipefail
app="/Applications/FX Steam Launcher.app"
team=V25VKGTW55
tag=$(gh release view -R fxgl/steamac --json tagName -q .tagName)
have=$(defaults read "$app/Contents/Info" CFBundleShortVersionString)
[[ "v$have" == "$tag" ]] && { print "up to date: $have"; exit 0; }
dir=$(mktemp -d)
dmg="$dir/FX-Steam-Launcher-${tag#v}.dmg"
gh release download "$tag" -R fxgl/steamac -p "FX-Steam-Launcher-${tag#v}.dmg" -D "$dir" --clobber
want=$(gh release view "$tag" -R fxgl/steamac --json assets -q '.assets[]|select(.name|endswith(".dmg"))|.digest')
[[ "sha256:$(shasum -a 256 "$dmg" | cut -d' ' -f1)" == "$want" ]] || { print "hash mismatch"; exit 1; }
spctl -a -t open --context context:primary-signature "$dmg"
signer=$(codesign -dv "$dmg" 2>&1)
[[ "$signer" == *"TeamIdentifier=$team"* ]] || { print "wrong signer"; exit 1; }
if pgrep -qf "$app/Contents/MacOS/steamac-vm"; then
  osascript -e 'quit app "FX Steam Launcher"' || true
  for i in {1..60}; do pgrep -qf "$app/Contents/MacOS/steamac-vm" || break; sleep 2; done
  pgrep -qf "$app/Contents/MacOS/steamac-vm" && { print "the VM is still running; quit it and retry"; exit 1; }
fi
vol=$(hdiutil attach -readonly -nobrowse -noautoopen "$dmg" | awk -F'\t' '/Volumes/{print $NF}')
trash "$app"
ditto "$vol/FX Steam Launcher.app" "$app"
hdiutil detach "$vol" -quiet
spctl -a "$app"
print "updated: $have -> $(defaults read "$app/Contents/Info" CFBundleShortVersionString)"

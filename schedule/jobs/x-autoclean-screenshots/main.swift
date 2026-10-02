// x-autoclean-screenshots — moves screenshots older than 7 days to the Trash, once a day.
//
// A binary of our own rather than /usr/bin/find, because TCC gates ~/Desktop per executable
// and a system binary can never be granted: find under launchd answers
// "find: /Users/dima/Desktop/screenshots: Operation not permitted" and stops there. This one
// is ad-hoc signed with a stable identifier, so the grant survives every rebuild.
//
// 📌 ~/Desktop is iCloud-managed here (Desktop & Documents in iCloud). Files land in the
// ordinary ~/.Trash because this moves them there itself; macOS's own trash call would have
// put them in the iCloud Drive trash instead, which is a different place to go looking.
//
// 📌 It reports what it SCANNED, not only what it trashed. A folder holding nothing old
// enough and a folder it was refused both trash zero files, and that ambiguity is exactly
// how a silent TCC deny gets read as a clean run. A scan it cannot perform exits non-zero.

import Foundation

let maxAgeDays = 7
let folder = URL(fileURLWithPath: NSHomeDirectory())
    .appendingPathComponent("Desktop/screenshots")

let fileManager = FileManager.default
let cutoff = Date().addingTimeInterval(TimeInterval(-maxAgeDays * 24 * 60 * 60))

func log(_ line: String) {
    print(line)
}

// FileManager.trashItem is REFUSED under launchd even with Full Disk Access granted to this
// exact binary — measured 2026-09-18, and `isWritableFile` reported true on the same folder in
// the same instant, so it is the trash call that is brokered, not the file. An ordinary move
// into ~/.Trash is allowed, lands the file where Finder shows it, and behaves identically
// whether a human or launchd runs it. Finder's own " 2" numbering is mirrored so a repeated
// screenshot name never collides with one already sitting in the trash.
func trashDestination(for name: String) -> URL {
    let trash = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".Trash")
    let candidate = trash.appendingPathComponent(name)

    guard FileManager.default.fileExists(atPath: candidate.path) else { return candidate }

    let stem = (name as NSString).deletingPathExtension
    let ext = (name as NSString).pathExtension

    for index in 2...99 {
        let suffixed = ext.isEmpty ? "\(stem) \(index)" : "\(stem) \(index).\(ext)"
        let next = trash.appendingPathComponent(suffixed)

        if !FileManager.default.fileExists(atPath: next.path) { return next }
    }

    // Every name taken is not a real state; the move then throws and the file gets logged.
    return candidate
}

func fail(_ line: String) -> Never {
    FileHandle.standardError.write(Data("\(stamp()) \(line)\n".utf8))
    exit(1)
}

func stamp() -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withFullDate, .withTime, .withColonSeparatorInTime]
    // Default is GMT, and the log is read next to `ls` output and Console — both local.
    formatter.timeZone = TimeZone.current

    return formatter.string(from: Date())
}

// .skipsHiddenFiles covers .DS_Store and every other dotfile — nothing hidden is ever a
// screenshot, and trashing one would be a surprise nobody asked for.
let entryList: [URL]
do {
    entryList = try fileManager.contentsOfDirectory(
        at: folder,
        includingPropertiesForKeys: [.isRegularFileKey, .contentModificationDateKey],
        options: [.skipsHiddenFiles]
    )
} catch {
    fail("cannot read \(folder.path): \(error.localizedDescription)")
}

var scannedCount = 0
var trashedCount = 0
var failedCount = 0

for entry in entryList {
    guard
        let values = try? entry.resourceValues(forKeys: [
            .isRegularFileKey, .contentModificationDateKey,
        ]),
        values.isRegularFile == true,
        let modifiedAt = values.contentModificationDate
    else { continue }

    scannedCount += 1

    guard modifiedAt < cutoff else { continue }

    do {
        try fileManager.moveItem(
            at: entry, to: trashDestination(for: entry.lastPathComponent)
        )
        trashedCount += 1
        log("trashed \(entry.lastPathComponent)")
    } catch {
        failedCount += 1
        FileHandle.standardError.write(
            Data("\(stamp()) could not trash \(entry.lastPathComponent): \(error.localizedDescription)\n".utf8)
        )
    }
}

log(
    "\(stamp()) scanned \(scannedCount) file(s) in \(folder.path), trashed \(trashedCount) older than \(maxAgeDays) days"
)

exit(failedCount == 0 ? 0 : 1)

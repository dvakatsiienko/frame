---
id: PK-211
title: >-
  speak: does f4 TTS reach meeting participants (zoom, meet) and screen
  recordings — and if not, how to support it
status: done
assignee: []
created_date: '2026-10-20 11:02'
updated_date: '2026-10-20 12:22'
due_date: '2026-10-23'
labels:
  - s
dependencies: []
priority: next
type: question
ordinal: 99200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 2026-10-20, dima: if during a zoom / google meet / etc meeting i press f4, would participants hear my text to speech? and when recording computer video and sound? if not, how do we support it?
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-20 answered: speak plays through AVAudioEngine to the macOS default output (schedule/jobs/x-speak/main.swift:86-131). meetings send the mic, so participants do not hear f4 — except when zoom's «share sound» or a meet tab-audio share is on (inference, not tested). a screen recording hears it only when the recorder takes system audio. the support path: a virtual device (brew cask blackhole-2ch 0.7.1) — speak plays to the speakers and blackhole at once, the meeting's mic is an aggregate of the real mic + blackhole. the feature ask is in orbit (speak wishes FRM-282).
<!-- SECTION:NOTES:END -->

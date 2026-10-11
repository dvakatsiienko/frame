# gifs — dima's gif storage

every gif made with `x:art-kit` lands here, one dir per gif, named by its slug. this dir is the
feature's home: the cli from [FRM-260](https://linear.app/x-com/issue/FRM-260) (`pnpm gif:*`)
lives here when it exists, and the raycast extension reads this tree.

## a gif dir

- `<slug>.gif` — the main one (≤ 5 MB)
- `<slug>-small.gif` — the autoplay one (≤ 3 MB, slack / discord)
- `<slug>.mp4` — the twin for telegram and x, which convert gifs to video anyway
- `spec.json` — `source` (a url plus `from`/`to`, or a path under `source/`), `made`, `skill`;
  once FRM-260 lands it is the build input and the gifs are rebuilt from it

## sources

a url is the source: record it with its range, never copy the video. a file dima handed over
(a screen recording, an image) is copied into `<slug>/source/` because nothing else can refetch it.
caption html, mocks and earlier versions are scratch and die with the session.

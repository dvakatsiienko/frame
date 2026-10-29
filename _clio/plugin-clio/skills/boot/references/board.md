# boot board mode — the tracker orientation

read by `cclio:boot` when the argument means the full picture («board», «full»). state is queried, never remembered: a stored board goes stale silently and gets read with confidence.

**one query serves the skeleton** (per-project counts blow linear's complexity cap — derive counts client-side):

```
x linear api 'query { teams(first: 10) { nodes { key name } } projects(first: 50) { pageInfo { hasNextPage } nodes { name state description } } issues(filter: { state: { type: { nin: ["completed","canceled"] } } }, first: 250) { pageInfo { hasNextPage } nodes { identifier project { name } parent { identifier project { name } } } } }'
```

- **skeleton**: one bullet line per project — project, state, open count, what it is for (the `description` is the payload). count no-project issues too; an unprojected ticket is invisible on every board.
- **milestones** — the first source of truth for «what's next»:

```
x linear api 'query { projectMilestones(first: 50) { pageInfo { hasNextPage } nodes { name project { name } issues(first: 50) { nodes { identifier state { type } } } } } }'
```

  one line per milestone: `project · milestone · done/total`. ⚠️ flag on sight: a milestone with 0 issues, and one whose done-count disagrees with the board — both mean nobody maintains it. 📌 milestones are project-scoped; `Initiative` is the cross-project layer.
- **placement drift**: flag every open sub-issue whose project differs from its parent's. clean → one line. non-zero → list ids, do NOT fix unasked.
- 📌 the class this cannot catch: two stories cutting one domain on different dimensions (FRM-184 by artifact vs FRM-28 by channel). before creating or splitting a story, name the dimension it cuts on and compare against the stories already covering that domain.

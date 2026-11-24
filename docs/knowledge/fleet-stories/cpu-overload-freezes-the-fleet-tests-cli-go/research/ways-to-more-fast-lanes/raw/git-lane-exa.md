# Bottom line

For this workload, **nothing I found beats your custom minimal Git build as a drop-in replacement while retaining Git’s complete semantics**. The strongest alternatives split into two categories:

1. **A much faster replacement for read-heavy commands:** `ziggit`, with unusually strong published macOS numbers, but not yet a demonstrated replacement for your exact hook + signed-commit + clean/smudge + worktree + local-push matrix.
2. **Eliminating process launches rather than making Git launch faster:** a long-lived `git cat-file --batch-command` process, an in-process library, or fixture construction by copying/preparing repositories. These are likely to produce larger gains than further dyld tuning, but they require changing the test harness or application architecture.

## 1. Maintained replacements and libraries

| Project | Link / adoption / freshness | Published number | Fit for your operations |
|---|---|---|---|
| **ziggit** | [GitHub repository](https://github.com/hdresearch/ziggit). The repository page reported **255 stars**. It is a pure-Zig Git implementation and claims 4–10× faster macOS arm64 operation. The search did not establish a reliable tagged-release date; treat the project as very new and verify the exact commit/release you test. | Its [benchmark document](https://github.com/hdresearch/ziggit/blob/master/BENCHMARKS.md) reports, on Apple silicon/macOS 15.6, `status` 8.1→1.0 ms, `rev-parse HEAD` 7.0→1.3 ms, and an average CLI speedup of 4.9×. Its embedded-library benchmark reports `rev-parse HEAD` averaging **92 µs versus 7,856 µs** for a spawned Git process: 85.4×. The project attributes much of the macOS result to process creation. | It advertises `init`, `add`, `commit`, `worktree`-adjacent workflows, `push`, and a Git server, and says it reads/writes the normal `.git` format. I found **no evidence that it runs arbitrary Git hooks, faithfully implements external clean/smudge filters, or reproduces Git’s signed-commit behavior**. Do not substitute it for your test unless a conformance matrix passes your exact cases. Its performance numbers are not directly comparable to your 3.4 ms minimal Git measurement: the benchmark’s Git baseline is Apple Git 2.50.1 at roughly 7–8 ms for the listed commands, not your already-optimized binary.
| **gitoxide / gix** | [Repository](https://github.com/GitoxideLabs/gitoxide): about **12,072 stars**. [crates.io](https://crates.io/crates/gitoxide) reported gitoxide 0.61.0 published **2026-10-22**, with 111,544 total downloads and 1,463 recent downloads. | I found no directly comparable macOS process-start benchmark for the complete write path. | The project’s own feature list marks `commit` as available but `hooks` and `push` as not complete; its command-line binaries are explicitly described as potentially unstable. This matches your prior finding: promising as an embedded read/object/index implementation, not a safe replacement for hooks, filters, signed commits, and push.
| **libgit2** | [Repository](https://github.com/libgit2/libgit2): about **10,530 stars**. [Releases](https://github.com/libgit2/libgit2/releases) showed v1.9.7 on **2026-08-13** and v2.0.0-rc.1 on **2026-10-14**. | No relevant published process-start number found. | This is the most mature embedded option. Its commit API has a signing callback and APIs for creating a commit with a supplied signature ([API documentation](https://libgit2.org/docs/reference/main/commit/index.html)). It does **not** automatically mean Git-compatible hook execution or git-crypt-compatible filter behavior; those need explicit integration. You would need to invoke hooks and clean/smudge programs yourself and preserve Git’s exact environment/order/error semantics. Local push, worktrees, and all edge cases also need testing.
| **git2go** | [Repository and bindings](https://github.com/libgit2/git2go). Adoption is represented primarily by libgit2 users; no reliable star/release figure was exposed in the retrieved material. | None found. | It exposes libgit2’s commit-signing callbacks, so signing is possible in-process. The same caveat applies: hooks and external filters are integration work, not automatic Git CLI compatibility.
| **go-git** | [Repository](https://github.com/go-git/go-git): about **7,847 stars**. Its releases page showed v6.0.0-beta.1 on **2026-10-04**. | No credible macOS startup benchmark found. | Pure Go and embeddable. The retrieved material did not establish complete compatibility with Git hooks, clean/smudge filters, signed commits, worktrees, and local push together. Treat it as an application library, not a drop-in Git replacement.
| **JGit** | [Repository](https://github.com/eclipse-jgit/jgit): about **429 stars**. Eclipse’s release listing reported JGit 7.8.0 on **2026-09-09**. | None found for macOS process launch or your workload. | More complete than many alternatives: its `CommitCommand` exposes hook streams, signing configuration, and `GpgSigner`; SSH signing was merged for JGit 7.1 ([issue](https://github.com/eclipse-jgit/jgit/issues/44)). It is Java, so it is not a cheap native macOS process replacement. Filter behavior, worktree behavior, and exact Git compatibility still require validation.
| **Dulwich** | [Repository](https://github.com/jelmer/dulwich). | No reliable current adoption/release number or relevant benchmark found. | Its source documents shell hooks, filters, and a `sign` option, but the in-memory repository path explicitly says hooks and signing are ignored. It is therefore unsuitable for claiming equivalent semantics without a carefully chosen code path and tests.
| **zig-git / other small rewrites** | The [zig-git project](https://github.com/nktkt/zig-git) documents hooks, `.gitattributes`, commit, object storage, worktrees-related plumbing, and transports. | No trustworthy adoption or benchmark found. | Interesting for experimentation, but not enough evidence of maintenance, compatibility, or production use to recommend it over your minimal Git.

### Practical ranking

* **Best drop-in candidate to benchmark:** ziggit, but only after testing all of `init`, `add`, `commit`, `worktree`, `rev-parse`, `status`, local-bare `push`, hook rejection/output, GPG/SSH signing, and git-crypt clean/smudge.
* **Best embedded foundation:** libgit2, possibly with a thin compatibility layer that deliberately runs hooks and filters as child processes.
* **Best read-side library:** gix, but not for your complete write contract today.
* **Best already-compatible fallback:** your minimal Git build.

## 2. What high-volume users do

### Long-lived Git processes

This is the clearest established technique. GitLab says [Gitaly keeps `git cat-file` processes running](https://about.gitlab.com/blog/contributions-to-git-2-42-release/) and feeds object queries over stdin/stdout using `--batch`, `--batch-check`, and `--batch-command`, so it does not launch one Git process per object. Git upstream’s `--batch-command` commit records that GitLab used two long-lived processes and could remove roughly half of them by combining the modes ([commit](https://github.com/git/git/commit/440c705ea63253642c8f4761f80eb7a97a62b614)).

This is excellent for object metadata/content, revision plumbing, and tree/blob access. It does **not** turn `commit`, `add`, `worktree`, `status`, hooks, signing, filters, or push into requests to the same batch protocol. For your suite, a persistent helper could cover `rev-parse`-like and object operations, but the write-heavy commands would still need Git or an embedded implementation.

Google’s 2022 [long-running Git process proposal](http://public-inbox.org/git/20220207190320.2960362-1-jonathantanmy@google.com/T/) went further: a persistent pkt-line RPC process (`git-batch`) for filesystem/index queries and batch fetches, specifically to avoid repeated fork/exec. It was a proposal/experimental direction, not a generally available server mode that replaces all Git commands.

### Daemons for worktree scanning

GitHub’s built-in [FSMonitor daemon](https://github.blog/engineering/infrastructure/improve-git-monorepo-performance-with-a-file-system-monitor/) is relevant to large worktrees, but not primarily to process startup. GitHub reported status-related worktree timings dropping from 17–85 seconds to under 1 second on large worktrees; the published examples include Chromium at 393K files and synthetic 1M/2M-file trees. FSMonitor is a persistent file-change watcher and IPC service. It reduces the scan performed by later `status`/`add`; it does not remove the startup cost of each Git process and does not help `init`, `commit`, `push`, hooks, or signing much.

### Monorepo and CI strategies

* Google uses Piper/CitC rather than ordinary Git for its main monorepo. The [Google monorepo paper](https://cacm.acm.org/research/why-google-stores-billions-of-lines-of-code-in-a-single-repository/) says more than 80% of Piper users use CitC and that Google could not make an off-the-shelf VCS scale to that repository. This is a different architecture, not a faster Git binary.
* Meta’s [Sapling](https://sapling-scm.com/docs/introduction/) uses a scalable server/virtual-filesystem architecture internally; its Git support uses Git under the hood for clone/push/pull. It is not evidence of a macOS Git-startup optimization for your fixture tests.
* Buildkite recommends shallow/sparse checkout and persistent local bare mirrors ([checkout optimization](https://buildkite.com/docs/pipelines/best-practices/git-checkout-optimization)). Mirrors and reference clones reduce network/object transfer and setup work, not the cost of thousands of local Git execs.
* GitHub/GitLab/Google-style systems generally amortize Git through services, RPC, caches, virtual filesystems, and long-lived workers. I found no public evidence that they use a `DYLD_INSERT_LIBRARIES` preload, a shared-library version of Git, or a universal Git server mode for arbitrary write commands.

### AI-agent products

The public documentation I found points overwhelmingly to **worktree isolation and remote sandboxes**, not Git daemons:

* [Cursor](https://cursor.com/docs/configuration/worktrees) creates an isolated Git worktree per agent; its Agents Window also runs cloud agents in isolated environments.
* [Claude Code](https://code.claude.com/docs/en/worktrees) uses `--worktree` and temporary worktrees for parallel sessions/subagents.
* [Codex](https://learn.chatgpt.com/docs/environments/git-worktrees) uses managed worktrees for parallel chats and background tasks.
* [Conductor](https://www.conductor.build/docs/concepts/git-worktrees) creates one worktree per workspace and shares the underlying object database.
* [Devin](https://docs.devin.ai/use-cases/gallery/parallelize-migration) documents parallel sessions and separate PRs/work packages.
* GitHub’s Copilot app says [cloud sessions run in isolated sandboxes](https://docs.github.com/en/copilot/how-tos/github-copilot-app/agent-sessions).

These designs avoid agents clobbering one checkout; they do not demonstrate reduced Git process startup on one Mac. In fact, local worktree orchestration can increase the number of Git invocations.

One newer, surprising project is **git-ai / Graft**. Its [benchmark](https://github.com/feder-cr/git-ai/blob/main/doc/graft/BENCH.md) reports 50 agents landing 250 changes: roughly 1,487–1,944 lands/minute with batching versus 264–385 without, and p99 latency 1.9–2.7 s versus 4.4–5.2 s. It also reports finding nine short Git processes per request and removing them. This is an agent-oriented server/landing architecture, not a drop-in local Git replacement; it is relevant if the suite’s real bottleneck is concurrent agent landing rather than Git semantics in each fixture.

## 3. Static/minimal macOS Git and dyld

### What is known to work

A **minimally dynamically linked** Mach-O executable is normal and practical: statically link your own and third-party libraries where licensing/build constraints permit, and retain the required Apple system libraries. A fully Linux-style static macOS executable is not generally available. The macOS discussion summarized in [this Swift forum thread](https://forums.swift.org/t/building-an-static-executable-for-distribution-on-macos/45497) states that macOS requires at least dynamic `libSystem`; Apple frameworks such as Foundation/Darwin are dynamic, and fully static executables are not supported.

Your 85-dylib build is therefore already using the right general strategy: remove optional dependencies, avoid Objective-C/Foundation/CoreServices where possible, disable gettext/perl/python/Rust integrations, and retain only the system closure needed by the code you actually execute. A fully static Git is not the likely next step.

### dyld closures and prebinding

Apple’s [dyld4 policy](https://github.com/apple-oss-distributions/dyld/blob/main/doc/PrebuiltLoaderSet_Policy.md) documents prebuilt loader sets (the successor concept to dyld3 closures). They can avoid repeated Mach-O dependency parsing/fixup work. However, third-party macOS command-line programs may have their closure cached automatically; there is no supported “prelink this Git binary” recipe that turns it into a zero-cost launch. The same document says closures are not used when `DYLD_INSERT_LIBRARIES`, `DYLD_*_PATH`, or image suffix/interposing conditions complicate the load graph—so preload experiments can actively defeat the optimization.

I found no public benchmark showing that manually forcing or prebuilding a closure materially improves a Git-sized process on Apple silicon, and no evidence that macOS 26 or macOS 27 exposes a new Git-specific facility. Measure cold and warm starts separately with `hyperfine`, Instruments/DTrace equivalents available on your system, and `DYLD_PRINT_STATISTICS`/dyld diagnostics where supported; do not assume a closure will beat removing 600+ dylibs.

The only concrete public static-vs-dynamic numbers I found were not Git-sized: an [independent dyld3/static comparison](https://blog.allegro.tech/2018/05/Static-linking-vs-dyld3.html) reported cold launch of 3.687 s (dyld2), 2.947 s (dyld3), and 2.276 s (static) in one application, with little warm-launch difference. It demonstrates directionally that static linking can help cold launch, but it is not a prediction for your 3–5 ms Git process.

### Shared-library preload

I found no credible production report of Git users solving this with a preload/interpose library. On macOS, interposing can disable or complicate dyld prebuilt closures, and it cannot remove the cost of Git’s own initialization safely unless you effectively maintain a fork. It is a poor fit for correctness-sensitive hooks, signing, filters, and repository discovery.

## 4. Fixtures: avoid Git altogether

These are likely the highest-return changes for throwaway repositories.

### Copy a prepared template repository

The most directly relevant example is [Beads’ test change](https://github.com/steveyegge/beads/commit/d582e00ffc916145187ca779cc387f8af9b2872f). It creates one template repository once, then copies `.git` for each test instead of spawning `git init` and configuration commands. The commit describes the old cost as roughly **20–30 ms per `git init`**, about 60 calls costing 1–2 s, and calls the directory-copy approach roughly 100× faster than subprocess initialization. That is a project-reported estimate, not a controlled macOS benchmark, but the technique is sound.

A second example, [Gentleman Programming’s immutable Git fixture](https://github.com/Gentleman-Programming/gentle-ai/pull/1522), reports a Windows package run improving from 788.947 s to 753.275 s, a **35.672 s / 4.52%** improvement, after removing about 1,365 Git subprocess launches. The page explicitly warns that the run was single-sequence and not statistically conclusive. It is nevertheless evidence that copying a validated template helps real test suites.

For your fixtures, create a template containing exactly the baseline `.git` structure, config, hooks, attributes, filter definitions, and any initial objects you need. Copy it with native filesystem APIs into a fresh directory. Do not use hardlinks for mutable files or shared object databases unless you have tested mutation isolation and concurrent writers. Recompute or remove stateful files such as `index`, `logs`, lock files, and worktree metadata as appropriate.

**Compatibility:** copying a template preserves hooks and filter configuration if you copy them, but it does not execute `init`; it also cannot test Git’s initialization behavior. It is excellent for tests whose purpose begins after repository creation.

### Fast-import

Git’s [fast-import documentation](https://git-scm.com/docs/git-fast-import.html) says it is designed to import large projects with minimal processing time and that 100,000-commit histories generally completed in 1–2 hours on modest 2007 hardware. That is a broad historical statement, not a modern per-fixture benchmark.

The useful pattern is to generate one complete stream of blobs/trees/commits and feed it to one `git fast-import` process, rather than launch Git once per commit. Git’s own performance test [p9300](https://code.googlesource.com/git/+/ce3986bb224067ecdb372d7cb7a56d22682e9a31/t/perf/p9300-fast-import-export.sh) measures export/import as a stream. A recent generator example reports 100,000 synthetic commits in seconds for stream construction plus one import, but that is application-specific and not a controlled benchmark.

**Compatibility:** fast-import writes objects and refs directly. It does not run ordinary `pre-commit`, `commit-msg`, `post-commit`, clean filters, smudge filters, or signing workflows. It is ideal for data-only fixture construction, then use real Git for the small number of tests specifically testing hooks/signing/filters.

### Write Git objects directly

You can write blob/tree/commit objects and refs directly, or use libgit2/gix APIs. This can remove both process startup and much Git setup work. It also bypasses precisely the behaviors you said must be exercised. Use it only for tests where the repository’s contents/history matter but Git’s behavioral contract does not.

### Split the suite

A practical fixture matrix is:

* **Most tests:** copy a template or materialize with fast-import/direct objects; zero Git starts during setup.
* **Compatibility tests:** real minimal Git, covering each hook, filter, signing mode, worktree operation, and local push.
* **A smaller integration slice:** real child processes and throwaway repositories, to retain coverage of process/environment behavior.

## 5. Other findings and surprises

* The dominant win is probably **amortization**, not another 10–20% reduction in dyld closure work. Your measured 3.4 ms is already close to the irreducible cost of repeatedly starting a native program under macOS.
* `git cat-file --batch-command` is more useful than the often-mentioned `git daemon` for local APIs. It is a persistent per-repository worker, not a network daemon and not a general command server.
* GitHub’s FSMonitor daemon can radically improve `status` on huge worktrees, but your fixture repositories and startup bottleneck make it secondary.
* Worktrees share object storage, but each worktree still has its own index and working tree. They reduce clone/copy cost and provide isolation; they do not eliminate Git process starts.
* Google’s and Meta’s solutions are effectively different VCS/server architectures. They demonstrate that very high-volume users avoid repeatedly invoking a full local Git CLI, but they are not portable macOS build tricks.
* Agent products publicly document worktrees, sandboxes, remote VMs, and PR orchestration—not a shared Git process, preload library, or complete in-process Git implementation.
* Even apparently promising replacements frequently fail at the exact edges that matter here: arbitrary hooks, external filters, cryptographic signing, worktree bookkeeping, and push protocol compatibility.

## Recommendation

1. Keep and ship the **custom minimal Git** for all semantic/integration tests; nothing found is a safer drop-in replacement.
2. Add a persistent helper for read-heavy operations (`cat-file --batch-command`, revision/object queries).
3. Convert fixture setup to cached-template copies or one-shot fast-import/direct-object construction.
4. Benchmark ziggit as an **experimental read/write candidate**, but require a conformance suite before trusting it.
5. Avoid spending much more effort on fully static macOS linking, manual dyld prebinding, or `DYLD_INSERT_LIBRARIES`; public evidence does not show a reliable payoff for a Git-sized command, and some of those techniques interfere with closures or correctness.

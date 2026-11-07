# sourced by the commit gate and the push twin: what a commit of only memory has to prove. ci still runs the whole suite on the push
# a test that reads memory, skills or rules as text; a new one joins here
MEMORY_TESTS=(
    script/ctx-init-trace.test.ts
    script/lib/code-rule-coverage.test.ts
    script/lib/crew-dna-cloud.test.ts
    script/lib/memory-load-agents-md.test.ts
    script/lib/memory-load-rule-lazy.test.ts
    script/lib/memory-sync-mirror.test.ts
    script/lib/model-cards-cap.test.ts
    script/lib/recipe-shape.test.ts
    script/lib/skill-size.test.ts
    script/lib/vibe-contract.test.ts
)

is_memory_path() {
    case $1 in
    _clio/pocket/*) return 0 ;;
    _clio/plugin-clio/.claude-plugin/plugin.json | home/.claude/plugin-x/.claude-plugin/plugin.json) return 0 ;;
    recipes/nurture-memory/scripts/memory-budgets.tsv) return 0 ;;
    _clio/memory/*.md | _clio/plugin-clio/skills/*.md | home/.claude/plugin-x/skills/*.md | home/.claude/rules/*.md | home/.claude/rules-lazy/*.md) return 0 ;;
    esac
    return 1
}

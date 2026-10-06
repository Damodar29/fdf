## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

**STRICT REQUIREMENT — YOU MUST READ [AGENTS.md](./AGENTS.md) BEFORE performing ANY task in this repository.** AGENTS.md contains repository-wide rules, structure, and policies that apply to all agents and contributors. Failure to read and follow AGENTS.md may result in incorrect outputs. Do NOT skip this step.

**Cloudflare Workers**: deploy with `node wr.mjs deploy` from the Worker's folder, never plain `npx wrangler` (wrong account) and never `wrangler logout`. Details: "Cloudflare Workers (Deploy & Auth)" in AGENTS.md.

**Before you start**: don't commit, push or deploy unless the user asks in this task; never print secrets from `.env` / `.wrangler-auth/` / `.gcloud/`; Home's 3-press back exit is intentional. Full list: "Working Rules" in AGENTS.md.

**Design system requests**: follow `.agents/skills/design-system-generator/SKILL.md` (summary in AGENTS.md, "Skill: Design System Generator").

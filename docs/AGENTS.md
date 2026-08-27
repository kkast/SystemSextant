# Documentation Guide for Agents

These instructions apply to files in `docs/`.

## Document roles

- `naming.md`: canonical product identity and identifiers.
- `IMPLEMENTATION_STATUS.md`: concise, high-level implementation progress and current MVP boundary.
- `HIGH_LEVEL_IMPLEMENTATION_PLAN.md`: durable principles, package boundaries, delivery stages, and cross-cutting requirements.
- `DETAILED_IMPLEMENTATION_PLAN.md`: implementation behavior, domain model, workflows, artifact rules, safety, and testing detail.
- `PRODUCT_ROADMAP.md`: product sequencing, deferred capabilities, and uncommitted ideas.
- `AGENT_INTEGRATION.md`: deferred agent usage contracts, conversational modes, machine-readable interfaces, and possible MCP integration.

## Maintenance rules

- Keep `IMPLEMENTATION_STATUS.md` high level. Use one checkbox per meaningful phase or outcome; do not add task IDs, file lists, evidence logs, or temporary subtasks.
- Mark a status item complete only when the whole outcome is implemented and verified.
- Record product prioritization in the roadmap, architecture in the plans, and progress in the status file.
- Keep speculative or deferred features out of the current MVP section.
- Use the canonical identifiers from `naming.md` in every document.
- When a current milestone decision conflicts with an older plan, update the older plan instead of leaving both versions indefinitely.
- Preserve the distinction between `AGENT_PROMPT.md`, which directs an agent for one generated project, and future agent-integration documentation, which explains how an agent operates SystemSextant.
- Avoid copying full sections between documents. Link to the authoritative document where practical.
- Keep examples consistent with the currently supported commands; label future commands explicitly as deferred.
- Treat the reusable headless core as a current architecture requirement even though local and deployed web interfaces are deferred.

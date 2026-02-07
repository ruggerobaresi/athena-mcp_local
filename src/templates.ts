/**
 * Athena File Templates
 * Used by athena_init to bootstrap workspace structure.
 */

export const CORE_IDENTITY_TEMPLATE = `# Core Identity — Athena v7.5

> Last updated: {{DATE}}

## Prime Directive
You are Athena, a Bionic-OS agent operating within the constraints of your framework.
You adhere to strict protocols defined in your .framework directory.

## Laws
1. **Law of Persistence**: All significant decisions and context must be preserved.
2. **Law of Transparency**: Communicate rationale clearly.
3. **Law of Fidelity**: Follow established protocols without deviation.
4. **Law of Self-Improvement**: Continuously optimize processes.

## Tags
#core #identity #athena #framework
`;

export const PROJECT_STATE_TEMPLATE = `# Project State — Living Specification

> Last synchronized: {{DATE}}

## Current Focus
- (Define current sprint/goal here)

## Active Tasks
- [ ] Task 1
- [ ] Task 2

## Decisions Log
- (Record key decisions here)

## Tags
#project #state #living-spec
`;

export const TAG_INDEX_TEMPLATE = `# TAG INDEX
Auto-generated index of hashtags found in .framework and .context.

## Usage
Run \`athena_generate_tag_index\` to refresh this file.

---

(Tags will appear here after indexing)
`;

export const VSCODE_SETTINGS_TEMPLATE = `{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.associations": {
    "*.md": "markdown"
  },
  "markdown.preview.scrollEditorWithPreview": true,
  "athena.projectRoot": "\${workspaceFolder}",
  "athena.mcpServer": "athena-litegraph"
}
`;

export const CURSOR_RULES_TEMPLATE = `# Cursor AI Rules for Athena Workspace

## Context Loading
Always load .framework/modules/Core_Identity.md at session start.
Reference .context/project_state.md for current project focus.

## Protocols
- Use #tags from TAG_INDEX.md for categorization.
- Follow quicksave format when checkpointing.
- Append to session logs in .context/memories/session_logs/.

## Forbidden Actions
- Never delete files in .framework without explicit permission.
- Never modify Core_Identity.md without #critical-change tag.
`;

export const GEMINI_AGENTS_TEMPLATE = `# AGENTS.md — Gemini/Antigravity Configuration

## Athena Agent
This workspace uses Athena as the primary memory and context management system.

### MCP Servers
- **athena-litegraph**: Memory persistence via LiteGraph.

### Workflows
- **/start**: Begin a session, load context.
- **/save**: Quicksave checkpoint.
- **/end**: Close session, archive decisions.

### Key Files
- \`.framework/modules/Core_Identity.md\`: Agent identity and laws.
- \`.context/project_state.md\`: Living specification.
- \`.context/TAG_INDEX.md\`: Searchable tag index.
`;

export const START_WORKFLOW_TEMPLATE = `---
description: Start an Athena session
---

# /start Workflow

1. Load Core Identity from \`.framework/modules/Core_Identity.md\`
2. Load Project State from \`.context/project_state.md\`
3. Create session log in \`.context/memories/session_logs/\`
4. Inject output standards (latency indicator, tagging)
5. Begin work
`;

export const END_WORKFLOW_TEMPLATE = `---
description: End an Athena session
---

# /end Workflow

1. Summarize session accomplishments
2. Record decisions made
3. Identify next steps / tasks
4. Sync to CANONICAL.md
5. Close session log with timestamp
6. (Optional) Git harvest commit
`;

export const SAVE_WORKFLOW_TEMPLATE = `---
description: Quicksave checkpoint
---

# /save Workflow

1. Capture current state summary
2. Append checkpoint to session log with timestamp
3. (Optional) Store as node in LiteGraph
`;

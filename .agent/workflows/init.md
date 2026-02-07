---
description: Initialize Athena workspace structure
---

# /init — Workspace Bootstrap

> **Use Case**: First-time setup. Creates `.framework/`, `.context/`, `.agent/` structure.

## Steps

// turbo

- [ ] Run `athena_init` tool (target: current directory)
- [ ] Verify `.framework/modules/Core_Identity.md` exists
- [ ] Verify `.context/project_state.md` exists
- [ ] (Optional) Generate IDE config: `athena_init ide=vscode|cursor|gemini`

**Confirm**: "✅ Workspace initialized. Run `/start` to begin."

---

## What Gets Created

| Path | Purpose |
|------|---------|
| `.framework/` | Identity, protocols, case studies |
| `.context/` | Project state, session logs, memories |
| `.agent/` | Workflows, scripts |
| `.athena` | Workspace marker |

---

# workflow #init #setup

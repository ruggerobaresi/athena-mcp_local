---
description: Health check for Athena workspace
---

# /check — System Diagnostics

> **Use Case**: Verify workspace integrity and environment configuration.

## Steps

// turbo

- [ ] Run `athena_check` tool
- [ ] Review status: OK / WARN / FAIL
- [ ] If WARN/FAIL: Address missing files or env vars

**Confirm**: "🔍 Health check complete. Status: [OK/WARN/FAIL]"

---

## What Gets Checked

- `.athena` marker file
- Critical directories (`.framework`, `.context`, `.agent`)
- Core files (`Core_Identity.md`, `project_state.md`)
- TAG_INDEX freshness (warns if >7 days old)
- Environment variables (`LITEGRAPH_ENDPOINT`, `LITEGRAPH_GRAPH_GUID`)

---

# workflow #diagnostics #check

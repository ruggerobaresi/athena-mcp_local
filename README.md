# 🏛️ Athena MCP Server

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![MCP Tools](https://img.shields.io/badge/MCP_Tools-12-blue)
![Protocols](https://img.shields.io/badge/Protocols-v8.2_Stable-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)
![Built for OpenCode](https://img.shields.io/badge/IDE-OpenCode_Agentic-000000)

> **A Model Context Protocol server bridging Athena's cognitive framework with LiteGraph memory.**  
> **Your AI. Your memory. Your rules.**

---

## Table of Contents
- [What You'll Get](#what-youll-get)
- [⚡ 5-Minute Quickstart](#-5-minute-quickstart)
- [MCP Tools](#mcp-tools)
- [The Core Loop](#the-core-loop)
- [📚 Further Reading](#-further-reading)

---

## What You'll Get

| Feature | Description |
|---------|-------------|
| 🧠 **LiteGraph Memory** | Persistent graph-based memory with semantic search |
| 📚 **64+ Protocols** | Athena v8.2 decision frameworks included |
| 🔄 **Dynamic Paths** | Works globally from any workspace directory |
| 🤖 **12 MCP Tools** | Session, memory, and search operations |

## ⚡ 5-Minute Quickstart

| Step | Action |
|------|--------|
| **1** | `git clone https://github.com/ruggerobaresi/athena-mcp_local.git` |
| **2** | `cd athena-mcp_local && npm install` |
| **3** | Create `.env` with LiteGraph credentials |
| **4** | `npm run build` |
| **5** | Add to your MCP configuration |

<details>
<summary><strong>📋 Environment Setup</strong></summary>

```bash
# .env
LITEGRAPH_ENDPOINT=your_endpoint
LITEGRAPH_TENANT_GUID=your_tenant
LITEGRAPH_GRAPH_GUID=your_graph
LITEGRAPH_ACCESS_KEY=your_key
```

</details>

<details>
<summary><strong>⚙️ MCP Configuration</strong></summary>

```json
{
  "mcpServers": {
    "athena": {
      "command": "node",
      "args": ["/path/to/athena-mcp_local/dist/index.js"],
      "env": {
        "PROJECT_ROOT": "/your/workspace"
      }
    }
  }
}
```

</details>

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `athena_init` | Initialize Athena workspace structure |
| `athena_check` | Health check for workspace and environment |
| `athena_start_session` | Start session with context retrieval |
| `athena_end_session` | Archive session and store decisions |
| `athena_quicksave` | Save intra-session checkpoint |
| `athena_read_memory` | Read memory file from `.context`/`.framework` |
| `athena_generate_tag_index` | Regenerate TAG_INDEX.md from hashtags |
| `athena_search` | Triple-path search (vector + tag + keyword) |
| `athena_store_node` | Store node in LiteGraph memory |
| `athena_read_node` | Read node by ID |
| `athena_search_nodes` | Search nodes by query |
| `athena_store_relationship` | Create relationship between nodes |

---

## The Core Loop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   (1) /start ──► Retrieve Context ──► (2) Work ──► (3) /end             │
│       ▲                                                    │            │
│       │                                                    ▼            │
│       └───── (5) Next Session ◄── Embed ◄── (4) Extract & Store        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Think of it like **Git, but for conversations**. Each session builds on the last.

---

## 📚 Further Reading

<details>
<summary><strong>🛠️ Tech Stack</strong></summary>

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Server** | MCP SDK (TypeScript) | Protocol implementation |
| **Memory** | LiteGraph | Persistent graph database |
| **Search** | Vector + Tag + Keyword | Hybrid semantic retrieval |
| **Protocols** | Athena v8.2 | Decision frameworks |

</details>

<details>
<summary><strong>📁 Repository Structure</strong></summary>

```
athena-mcp_local/
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── session.ts         # Session management
│   ├── context-service.ts # Memory file operations
│   ├── litegraph-client.ts# LiteGraph SDK wrapper
│   └── tools/             # Tool implementations
├── .context/              # Athena context files
├── .framework/            # Athena protocols (v8.2)
└── dist/                  # Compiled output
```

</details>

<details>
<summary><strong>🔗 Origin</strong></summary>

Consolidated from [opencode-agentic](https://github.com/ruggerobaresi/opencode-agentic):

| Date | Commit | Description |
|------|--------|-------------|
| Feb 5 | `265c850fd` | LiteGraph memory adapter |
| Feb 6 | `76a7f37fc` | Session harvest |
| Feb 7 | `32f289561` | Context updates |
| Feb 7 | `bf5854722` | LiteGraph server |
| Feb 7 | `ee17ff378` | CLI tools v1.5.0 |
| Feb 8 | current | Dynamic path support |

</details>

---

## License

MIT — Based on [Athena-Public](https://github.com/winstonkoh87/Athena-Public)

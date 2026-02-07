# Athena MCP Server

A Model Context Protocol (MCP) server that bridges Athena's cognitive framework with LiteGraph memory persistence.

## Features

- **12 MCP Tools** for session management, memory operations, and semantic search
- **LiteGraph Integration** for persistent graph-based memory
- **Dynamic Path Resolution** - works globally from any workspace directory
- **Athena v8.2 Protocols** - decision-making, engineering, and workflow frameworks

## Installation

```bash
npm install
npm run build
```

## Configuration

Create `.env` file:

```env
LITEGRAPH_ENDPOINT=your_endpoint
LITEGRAPH_TENANT_GUID=your_tenant
LITEGRAPH_GRAPH_GUID=your_graph
LITEGRAPH_ACCESS_KEY=your_key
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `athena_init` | Initialize Athena workspace structure |
| `athena_check` | Health check for workspace and environment |
| `athena_start_session` | Start new session with context retrieval |
| `athena_end_session` | Archive session and store decisions |
| `athena_quicksave` | Save intra-session checkpoint |
| `athena_read_memory` | Read memory file from `.context`/`.framework` |
| `athena_generate_tag_index` | Regenerate TAG_INDEX.md from hashtags |
| `athena_search` | Triple-path search (vector + tag + keyword) |
| `athena_store_node` | Store node in LiteGraph memory |
| `athena_read_node` | Read node by ID |
| `athena_search_nodes` | Search nodes by query |
| `athena_store_relationship` | Create relationship between nodes |

## Usage with OpenCode

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "athena": {
      "command": "node",
      "args": ["/path/to/athena_mcp/dist/index.js"],
      "env": {
        "PROJECT_ROOT": "/your/workspace"
      }
    }
  }
}
```

## Project Structure

```
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

## Origin

Consolidated from [opencode-agentic](https://github.com/ruggerobaresi/opencode-agentic) development:

- LiteGraph memory adapter (Feb 5)
- Session harvest and CLI tools (Feb 6-7)
- Dynamic path support (Feb 8)

## License

MIT

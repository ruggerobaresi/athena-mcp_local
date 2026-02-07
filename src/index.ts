#!/usr/bin/env node
// ----------------------------------------------------------------------------
// IMPORTANT: Redirect console.log to console.error to prevent corrupting
// the MCP JSON-RPC protocol which runs on stdout.
// ----------------------------------------------------------------------------
const originalLog = console.log;
console.log = function (...args) {
    console.error(...args);
};

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LiteGraphClient } from "./litegraph-client.js";
import { SessionManager } from "./session.js";

import { EmbeddingService } from "./services/EmbeddingService.js";
import { ContextService } from "./context-service.js"; // Restore missing import
import { InitTool } from "./tools/init.js";
import { CheckTool } from "./tools/check.js";

// Configuration
const CONFIG = {
    endpoint: process.env.LITEGRAPH_ENDPOINT || "http://localhost:8701",
    tenantGuid: process.env.LITEGRAPH_TENANT_GUID || "00000000-0000-0000-0000-000000000000",
    graphGuid: process.env.LITEGRAPH_GRAPH_GUID || "411e74de-0000-0000-0000-000000000000",
    accessKey: process.env.LITEGRAPH_ACCESS_KEY || "default-key"
};

// Use bge-m3 as found in user environment
const embeddingService = new EmbeddingService('bge-m3');
const db = new LiteGraphClient(CONFIG, embeddingService);
// Use process.cwd() as the default project root, but allow override via env var
const projectRoot = process.env.PROJECT_ROOT || process.cwd();
const sessionManager = new SessionManager(db, projectRoot);
const contextService = new ContextService(projectRoot);

// Create MCP Server
const server = new McpServer({
    name: "athena-litegraph",
    version: "1.0.0",
});

// --- Athena Session Tools ---

server.tool(
    "athena_start_session",
    "Start a new Athena session and retrieve recent context.",
    {
        userId: z.string().optional().describe("User ID"),
        projectId: z.string().optional().describe("Project ID"),
        description: z.string().optional().describe("Session description"),
        path: z.string().optional().describe("Workspace root path override")
    },
    async (params) => {
        try {
            const result = await sessionManager.startSession(params);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
            const errorMsg = error instanceof Error ? error.message + '\n' + error.stack : JSON.stringify(error);
            return { content: [{ type: "text", text: `Error starting session: ${errorMsg}` }], isError: true };
        }
    }
);


import { QuicksaveTool } from "./tools/quicksave.js";

server.tool(
    "athena_end_session",
    "End the current Athena session, archive it, and store decisions/tasks.",
    {
        sessionId: z.string().describe("Session UUID"),
        summary: z.string().describe("Summary of the session"),
        decisions: z.array(z.string()).optional().describe("List of decisions made"),
        nextSteps: z.array(z.string()).optional().describe("List of next steps/tasks identified"),
        path: z.string().optional().describe("Workspace root path override")
    },
    async (params) => {
        try {
            const result = await sessionManager.endSession(params);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error ending session: ${error.message}` }], isError: true };
        }
    }
);

const quicksaveTool = new QuicksaveTool(sessionManager, db, projectRoot);

server.tool(
    "athena_quicksave",
    "Save an intra-session checkpoint with compliance checks (Triple-Lock, Promise Gate).",
    {
        summary: z.string().describe("What just happened?"),
        bullets: z.array(z.string()).optional().describe("Key details or file changes"),
        path: z.string().optional().describe("Workspace root path override")
    },
    async (params) => {
        try {
            const result = await quicksaveTool.execute(params);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: `Quicksave failed: ${e.message}` }], isError: true };
        }
    }
);


server.tool(
    "athena_read_memory",
    "Read a specific memory file from the .context or .framework directory.",
    {
        path: z.string().describe("Relative path to the memory file (e.g., 'User_Vault.md' or 'modules/Core_Identity.md')"),
        target: z.string().optional().describe("Workspace root path override")
    },
    async ({ path: memoryPath, target }) => {
        const root = target || projectRoot;
        const content = await contextService.readMemory(memoryPath, root);
        if (content) {
            return { content: [{ type: "text", text: content }] };
        } else {
            return { content: [{ type: "text", text: `Memory file not found in .context or .framework: ${memoryPath} (Root: ${root})` }], isError: true };
        }
    }
);

// --- Init & Check Tools ---

const initTool = new InitTool(projectRoot);
const checkTool = new CheckTool(projectRoot);

server.tool(
    "athena_init",
    "Initialize an Athena workspace with standard directory structure and templates.",
    {
        target: z.string().optional().describe("Target directory (defaults to project root)"),
        ide: z.enum(["vscode", "cursor", "gemini", "antigravity"]).optional().describe("IDE-specific configuration to generate")
    },
    async (params) => {
        try {
            const result = await initTool.execute(params);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: `Init failed: ${e.message}` }] };
        }
    }
);

server.tool(
    "athena_check",
    "Perform health checks on the Athena workspace and environment.",
    {
        target: z.string().optional().describe("Target directory (defaults to scanned path)")
    },
    async ({ target }) => {
        try {
            const checkTool = new CheckTool(target || projectRoot);
            const result = await checkTool.execute();
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: `Check failed: ${e.message}` }] };
        }
    }
);

// --- Core Data Tools ---

server.tool(
    "athena_read_node",
    "Read a node by ID from LiteGraph memory",
    { id: z.string().describe("The UUID of the node") },
    async ({ id }) => {
        const node = await db.getNode(id);
        if (!node) {
            return { content: [{ type: "text", text: `Node ${id} not found.` }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] };
    }
);

server.tool(
    "athena_search_nodes",
    "Search nodes in LiteGraph memory. Query format 'key=value' for exact match, or empty for constraints.",
    {
        query: z.string().describe("Search query (e.g., 'type=Session')"),
        limit: z.number().default(20).describe("Max results")
    },
    async ({ query, limit }) => {
        const nodes = await db.searchNodes(query, limit);
        return { content: [{ type: "text", text: JSON.stringify(nodes, null, 2) }] };
    }
);

server.tool(
    "athena_search",
    "Triple-Path Search: Vector (Semantic) + Tag (Hashtags) + Keyword (Exact).",
    {
        query: z.string().describe("Search query (natural language)"),
        type: z.enum(["all", "vector", "tag", "keyword"]).default("all").describe("Search strategy (default: all)"),
        limit: z.number().default(10).describe("Max results")
    },
    async ({ query, type, limit }) => {
        console.error(`Searching: "${query}" (type: ${type})`);
        let results: { id: string, name: string, score: number, type: string, source: string }[] = [];

        // 1. Vector Search
        if ((type === "all" || type === "vector") && embeddingService) {
            try {
                const vector = await embeddingService.getEmbedding(query);
                if (vector) {
                    // Assuming LiteGraphClient exposes searchVectors (we verified this in Phase 3 tasks)
                    // Note: SDK types might need update if we are extending client strictly, but JS allows it.
                    // We added searchVectors to LiteGraphClient class.
                    const vectorNodes = await db.searchVectors(vector, limit);
                    // Map to uniform result structure
                    const mapped = vectorNodes.map((n: any) => ({
                        id: n.GUID || n.id, // handle GUID vs id
                        name: n.Name || n.Data?.name || "Unknown",
                        score: n.Score || 0.8, // simplified scoring if not present
                        type: n.Data?.type || "Unknown",
                        source: "vector"
                    }));
                    results = [...results, ...mapped];
                }
            } catch (e) {
                console.error("Vector path failed:", e);
            }
        }

        // 2. Tag Search (via TAG_INDEX.md)
        if (type === "all" || type === "tag") {
            // Basic regex for hashtags in query
            const tags = query.match(/#\w+/g);
            if (tags) {
                try {
                    const contextService = new ContextService(process.cwd()); // Re-instantiate locally or reuse global
                    // We should reuse global contextService but it's not in scope of this func closure unless we move it up or pass it.
                    // It is global constant in this file, so it is accessible.
                    // wait, contextService is defined line 31? Yes.

                    // Read index
                    const tagIndex = await contextService.readMemory('TAG_INDEX.md');
                    if (tagIndex) {
                        for (const tag of tags) {
                            if (tagIndex.includes(tag)) {
                                // Simple line matching for now
                                const lines = tagIndex.split('\n').filter((l: string) => l.includes(tag));
                                results.push(...lines.map((l: string) => ({
                                    id: "index-ref", // Placeholder ID, or parse from line if format is specific
                                    name: l.trim(),
                                    score: 1.0,
                                    type: "TagRef",
                                    source: "tag"
                                })));
                            }
                        }
                    }
                } catch (e) {
                    console.error("Tag path failed:", e);
                }
            }
        }

        // 3. Keyword Search (LiteGraph searchNodes)
        if (type === "all" || type === "keyword") {
            try {
                // Determine if query resembles "Key=Value" or just "Value"
                const searchQ = query.includes('=') ? query : `Name=${query}`;
                const keywordNodes = await db.searchNodes(searchQ, limit);
                const mapped = keywordNodes.map((n: any) => ({
                    id: n.GUID,
                    name: n.Name,
                    score: 0.9, // Exact matches usually imply high relevance
                    type: "Node",
                    source: "keyword"
                }));
                results = [...results, ...mapped];
            } catch (e) {
                console.error("Keyword path failed:", e);
            }
        }

        // De-duplicate by ID
        const unique = new Map();
        for (const r of results) {
            if (!unique.has(r.id)) {
                unique.set(r.id, r);
            }
        }

        return { content: [{ type: "text", text: JSON.stringify(Array.from(unique.values()), null, 2) }] };
    }
);

server.tool(
    "athena_generate_tag_index",
    "Scan .framework and .context directories for #hashtags and regenerate TAG_INDEX.md",
    {
        target: z.string().optional().describe("Workspace root path override")
    },
    async ({ target }) => {
        const fs = await import('fs/promises');
        const path = await import('path');
        // Removed glob import to avoid type issues and dependency checks, strictly using recursive walk
        // const glob = (await import('glob')).glob; 

        // Simple recursive walk 
        async function getFiles(dir: string): Promise<string[]> {
            try {
                const dirents = await fs.readdir(dir, { withFileTypes: true });
                const files = await Promise.all(dirents.map((dirent) => {
                    const res = path.resolve(dir, dirent.name);
                    return dirent.isDirectory() ? getFiles(res) : res;
                }));
                const flattened: string[] = Array.prototype.concat(...files);
                return flattened;
            } catch (e) { return []; }
        }

        const root = target || projectRoot;
        const dirs = ['.framework', '.context'].map(d => path.join(root, d));
        let allTags = new Set<string>();

        try {
            for (const dir of dirs) {
                const files = await getFiles(dir);
                for (const file of files) {
                    // Only markdown files
                    if (path.extname(file) !== '.md') continue;

                    const content = await fs.readFile(file, 'utf-8');
                    const tags = content.match(/#\w+/g);
                    if (tags) {
                        tags.forEach(t => allTags.add(`${t} -> ${path.relative(root, file)}`));
                    }
                }
            }

            const indexContent = Array.from(allTags).sort().join('\n');
            await fs.writeFile(path.join(root, '.context', 'TAG_INDEX.md'), indexContent);

            return { content: [{ type: "text", text: `Generated TAG_INDEX.md with ${allTags.size} tags at ${root}` }] };

        } catch (e: any) {
            return { content: [{ type: "text", text: `Error generating tag index: ${e.message}` }], isError: true };
        }
    }
);

server.tool(
    "athena_store_node",
    "Store (create or update) a node in LiteGraph memory",
    {
        id: z.string().describe("Node UUID"),
        type: z.string().describe("Node type (label)"),
        properties: z.record(z.any()).describe("Node properties"),
        labels: z.array(z.string()).optional().describe("Additional labels")
    },
    async (nodeData) => {
        const result = await db.storeNode(nodeData);
        return { content: [{ type: "text", text: `Node ${nodeData.id} ${result} successfully.` }] };
    }
);

server.tool(
    "athena_store_relationship",
    "Store (create or update) a relationship/edge in LiteGraph memory",
    {
        id: z.string().describe("Relationship UUID"),
        type: z.string().describe("Relationship type"),
        from: z.string().describe("Source Node UUID"),
        to: z.string().describe("Target Node UUID"),
        properties: z.record(z.any()).optional().describe("Edge properties")
    },
    async (relData) => {
        const result = await db.storeRelationship(relData);
        return { content: [{ type: "text", text: `Relationship ${relData.id} ${result} successfully.` }] };
    }
);

// Start
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Athena LiteGraph MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});


import { LiteGraphClient } from './litegraph-client.js';
import { EmbeddingService } from './services/EmbeddingService.js';
import { ContextService } from './context-service.js';

// Configuration (Mirroring index.ts)
const CONFIG = {
    endpoint: process.env.LITEGRAPH_ENDPOINT || "http://localhost:8701",
    tenantGuid: process.env.LITEGRAPH_TENANT_GUID || "00000000-0000-0000-0000-000000000000",
    graphGuid: process.env.LITEGRAPH_GRAPH_GUID || "411e74de-0000-0000-0000-000000000000",
    accessKey: process.env.LITEGRAPH_ACCESS_KEY || "default-key"
};

async function verifyRealData() {
    console.log("=== Athena Phase 3: Real Data Verification ===");
    console.log(`Target: LiteGraph @ ${CONFIG.endpoint}`);
    console.log(`Model: bge-m3 (Ollama)`);

    // 1. Setup Services
    const embeddingService = new EmbeddingService('bge-m3');
    const db = new LiteGraphClient(CONFIG, embeddingService);

    // 2. Connectivity Check
    try {
        await db.connect();
        console.log("✅ LiteGraph Connected");
    } catch (e) {
        console.error("❌ Could not connect to LiteGraph. Ensure it is running on port 8701.");
        process.exit(1);
    }

    // 3. Store a Node with Semantic Content
    const testContent = "The mitochondria is the powerhouse of the cell.";
    // Use a valid UUID to satisfy LiteGraph server strictness
    const nodeId = "99999999-9999-9999-9999-999999999999";
    const node = {
        id: nodeId,
        type: "Fact",
        properties: {
            content: testContent,
            category: "Biology"
        },
        labels: ["science", "test"]
    };

    console.log(`\nStoring node: "${testContent}"...`);

    // This should trigger embedding generation via Ollama 'bge-m3'
    const result = await db.storeNode(node);
    console.log(`Store Result: ${result}`);

    // Wait a bit for indexing if async? (LiteGraph usually instant for small creates)
    await new Promise(r => setTimeout(r, 1000));

    // 4. Verify Embedding Generation (by inspecting the stored node if possible, or just searching)
    // We'll jump straight to search to verify the loop.

    // 5. Semantic Search
    const queries = [
        "What is the energy source of the cell?", // Semantic match
        "mitochondria", // Keyword/Semantic match
        "programming patterns" // Irrelevant
    ];

    console.log("\n--- Testing Vector Search ---");

    // We simulate the logic inside 'athena_search' tool for the vector path
    // Generate query vector
    for (const q of queries) {
        console.log(`\nQuery: "${q}"`);
        const queryVector = await embeddingService.getEmbedding(q);
        if (!queryVector) {
            console.error("❌ Failed to generate query vector.");
            continue;
        }

        // Search
        const results = await db.searchVectors(queryVector, 5);
        if (results.length > 0) {
            const match = results.find((n: any) => n.GUID === nodeId);
            if (match) {
                console.log(`✅ Found our test node! (Score: ${match.Score})`);
            } else {
                console.log(`Values found: ${results.map((n: any) => n.Name).join(', ')}`);
            }
        } else {
            console.log("No results found.");
        }
    }

    console.log("\n=== Verification Complete ===");
}

verifyRealData().catch(console.error);

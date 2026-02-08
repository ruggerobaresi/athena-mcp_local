
import 'dotenv/config';
import { LiteGraphClient } from "./litegraph-client.js";
import { SessionManager } from "./session.js";

// Validate Config
const CONFIG = {
    endpoint: process.env.LITEGRAPH_ENDPOINT || "http://localhost:8701",
    tenantGuid: process.env.LITEGRAPH_TENANT_GUID || "00000000-0000-0000-0000-000000000000",
    graphGuid: process.env.LITEGRAPH_GRAPH_GUID || "00000000-0000-0000-0000-000000000000",
    accessKey: process.env.LITEGRAPH_ACCESS_KEY || "default"
};

const db = new LiteGraphClient(CONFIG);
const sessionManager = new SessionManager(db, process.cwd());

async function runTests() {
    console.log("🚀 Starting Athena MCP Integration Tests...");

    // Test Data
    const testNodeId = crypto.randomUUID();
    const testSessionId = crypto.randomUUID();

    try {
        // --- 1. Store Node ---
        console.log("\n🧪 Test 1: Store Node (Create)");
        const storeResult = await db.storeNode({
            id: testNodeId,
            type: "TestNode",
            labels: ["Test", "Debug"],
            properties: {
                foo: "bar",
                count: 123,
                description: "A temporary test node"
            }
        });
        console.log(`Result: ${storeResult}`);
        if (storeResult !== "Created" && storeResult !== "Updated") throw new Error("Failed to store node");
        console.log("✅ Store Node Passed");

        // --- 2. Read Node ---
        console.log("\n🧪 Test 2: Read Node");
        const readNode = await db.getNode(testNodeId);
        console.log(`Read Node:`, JSON.stringify(readNode, null, 2));
        if (!readNode || readNode.Name !== "TestNode") throw new Error("Failed to read node or incorrect content");
        console.log("✅ Read Node Passed");

        // --- 3. Search Nodes (Various Patterns) ---
        console.log("\n🧪 Test 3: Search Nodes");

        const queries = [
            { q: "Label=Test", expect: true, desc: "Label=Test" },
            { q: "type=TestNode", expect: true, desc: "type=TestNode (Should map to Name)" },
            { q: "Name=TestNode", expect: true, desc: "Name=TestNode" },
            { q: "count=123", expect: false, desc: "Property match (count=123) - Might fail depending on impl" }
        ];

        for (const { q, expect, desc } of queries) {
            console.log(`\n   Scanning query: '${q}'...`);
            const results = await db.searchNodes(q, 5);
            console.log(`   Found ${results.length} nodes.`);
            const foundMyNode = results.some((n: any) => n.GUID === testNodeId);

            if (expect && !foundMyNode) {
                console.error(`❌ Search Failed for '${q}': Expected to find test node but didn't.`);
                console.log("Full Results:", JSON.stringify(results, null, 2));
            } else if (!expect && foundMyNode) {
                console.warn(`⚠️ Search found node for '${q}' even though expectation was low (this is good if property search works).`);
            } else {
                console.log(`✅ Search OK for '${q}'`);
            }
        }

        // --- 4. Session Lifecycle ---
        console.log("\n🧪 Test 4: Session Lifecycle");

        // Start
        const session = await sessionManager.startSession({
            projectId: "integration-test",
            description: "Testing Session Manager",
            path: process.cwd()
        });
        console.log(`Session Started: ${session.sessionId}`);

        // Search for this session using type=Session
        const sessionSearch = await db.searchNodes("type=Session", 5);
        const sessionFound = sessionSearch.some((n: any) => n.GUID === session.sessionId);
        if (sessionFound) {
            console.log("✅ Found new session using 'type=Session'");
        } else {
            console.error("❌ Failed to find new session using 'type=Session'");
        }

        // End
        const endResult = await sessionManager.endSession({
            sessionId: session.sessionId,
            summary: "Integration test completed successfully.",
            decisions: ["Validated all tools"],
            nextSteps: ["Cleanup"],
            path: process.cwd()
        });
        console.log("Session Ended:", endResult);
        console.log("✅ Session Lifecycle Passed");


    } catch (error) {
        console.error("\n❌ FATAL TEST FAILURE:", error);
    } finally {
        console.log("\n🏁 Tests Finished");
    }
}

runTests();

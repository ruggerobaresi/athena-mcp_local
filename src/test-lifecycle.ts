
import 'dotenv/config';
import { LiteGraphClient } from "./litegraph-client.js";
import { SessionManager } from "./session.js";

// Discovered defaults from LiteGraphServer.cs
const CONFIG = {
    endpoint: process.env.LITEGRAPH_ENDPOINT || "http://localhost:8701",
    tenantGuid: process.env.LITEGRAPH_TENANT_GUID || "00000000-0000-0000-0000-000000000000",
    graphGuid: process.env.LITEGRAPH_GRAPH_GUID || "00000000-0000-0000-0000-000000000000",
    accessKey: process.env.LITEGRAPH_ACCESS_KEY || "default"
};

console.log("DEBUG: Using Config:");
console.log("Endpoint:", CONFIG.endpoint);
console.log("Tenant:", CONFIG.tenantGuid);
console.log("Graph:", CONFIG.graphGuid);
console.log("Key:", CONFIG.accessKey);

async function testLifecycle() {
    console.log("--- Starting Athena Lifecycle Test ---");

    const db = new LiteGraphClient(CONFIG);
    const sessionManager = new SessionManager(db, process.cwd());

    try {
        // 1. Start Session
        console.log("\n1. Starting Session...");
        const startResult = await sessionManager.startSession({
            description: "Automated Lifecycle Test Session",
            projectId: "test-project-123",
            path: process.cwd()
        });
        console.log("Session Started:", startResult.sessionId);
        console.log("Context Retrieved:", startResult.recentContext.length, "items");

        if (startResult.coreIdentity && startResult.coreIdentity.length > 0) {
            console.log("✅ Core Identity successfully loaded.");
        } else {
            console.warn("⚠️ Core Identity NOT loaded (File missing? or mock issue?)");
        }

        // 2. Verify Session Node Exists
        console.log("\n2. Verifying Session Node...");
        const sessionNode = await db.getNode(startResult.sessionId);
        if (sessionNode && sessionNode.Name === "Session") {
            console.log("✅ Session Node confirmed in LiteGraph.");
        } else {
            console.error("❌ Session Node NOT found or incorrect type:", sessionNode);
        }

        // 3. End Session
        console.log("\n3. Ending Session...");
        const endResult = await sessionManager.endSession({
            sessionId: startResult.sessionId,
            summary: "Lifecycle test complete.",
            decisions: ["Tested Start", "Tested Quicksave"],
            nextSteps: [
                "Verify Log Exists",
                "Verify Node Graph"
            ],
            path: process.cwd()
        });
        console.log("Session Ended:", endResult.status);

        // 4. Verify Archival and Linked Nodes
        console.log("\n4. Verifying Archival and Links...");
        const endNode = await db.getNode(startResult.sessionId);
        console.log("DEBUG: EndNode:", JSON.stringify(endNode, null, 2));
        if (endNode?.Data?.status === "completed") {
            console.log("✅ Session status updated to 'completed'.");
        } else {
            console.error("❌ Session status NOT updated. Status is:", endNode?.Data?.status);
        }

        // 5. Verify Context Retrieval (Automatic Recovery)
        console.log("\n5. Verifying Context Retrieval (Second Session)...");
        // startSession internally calls searchNodes("Label=Session", 5) now.
        const session2Result = await sessionManager.startSession({
            description: "Second Session to test context",
            projectId: "test-project-123",
            path: process.cwd()
        });
        console.log("Context Retrieved for Session 2:", session2Result.recentContext.length, "items");

        // DEBUG: Generic Search
        console.log("DEBUG: Running generic search (no filter)...");
        const allNodes = await db.searchNodes("", 5);
        console.log("Generic Search Results:", allNodes.length);
        if (allNodes.length > 0) {
            console.log("First node sample:", JSON.stringify(allNodes[0], null, 2));
        }

        const foundPreviousSession = session2Result.recentContext.find((s: any) => s.id === startResult.sessionId);
        if (foundPreviousSession) {
            console.log("✅ Successfully retrieved previous session context:", foundPreviousSession.summary);
        } else {
            console.error("❌ Failed to retrieve previous session as context.");
            console.log("Retrieved context:", JSON.stringify(session2Result.recentContext, null, 2));
        }

    } catch (error) {
        console.error("❌ Test Failed:", error);
        if (error instanceof Error) {
            console.error("Message:", error.message);
        }
    }
}

testLifecycle();

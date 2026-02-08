
import { SessionState } from './session-state.js';
import { SessionManager } from './session.js';
import { LiteGraphClient } from './litegraph-client.js';
import { QuicksaveTool } from './tools/quicksave.js';
import { EmbeddingService } from './services/EmbeddingService.js';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
    endpoint: process.env.LITEGRAPH_ENDPOINT || "http://localhost:8701",
    tenantGuid: process.env.LITEGRAPH_TENANT_GUID || "00000000-0000-0000-0000-000000000000",
    graphGuid: process.env.LITEGRAPH_GRAPH_GUID || "411e74de-0000-0000-0000-000000000000",
    accessKey: process.env.LITEGRAPH_ACCESS_KEY || "default"
};

async function test() {
    console.log("Starting Session State Verification...");

    // Use bge-m3 as found in user environment
    const embeddingService = new EmbeddingService('bge-m3');
    const db = new LiteGraphClient(CONFIG, embeddingService);
    const projectRoot = process.cwd();
    const sessionManager = new SessionManager(db, projectRoot);
    const quicksave = new QuicksaveTool(sessionManager, db, projectRoot);
    const state = SessionState.getInstance();

    console.log("Step 1: Verify Initial State");
    console.log("Active Sessions:", state.listActiveSessions().length);

    console.log("\nStep 2: Start Session");
    const session = await sessionManager.startSession({
        path: projectRoot,
        userId: "test-user",
        projectId: "test-project",
        description: "Verification Session"
    });
    console.log("Session Started:", session.sessionId);
    console.log("Active Sessions in memory:", state.listActiveSessions().length);

    const active = state.getActiveSession();
    console.log("Active Session ID:", active?.id);

    console.log("\nStep 3: Execute Quicksave");
    const qsResult = await quicksave.execute({
        summary: "Testing in-memory session tracking",
        bullets: ["Verified singleton pattern", "Verified O(1) lookup"]
    });
    console.log("Quicksave Result:", qsResult.status);

    console.log("\nStep 4: End Session");
    await sessionManager.endSession({
        sessionId: session.sessionId,
        summary: "Verification complete",
        path: projectRoot
    });
    console.log("Session Ended");
    console.log("Active Sessions in memory:", state.listActiveSessions().length);

    console.log("\nStep 5: Verify Quicksave Fails after End");
    try {
        await quicksave.execute({ summary: "Should fail" });
        console.log("ERROR: Quicksave should have failed!");
    } catch (e: any) {
        console.log("Success: Quicksave failed as expected:", e.message);
    }

    console.log("\nStep 6: Verify Session Resumption");
    const resumedSession = await sessionManager.startSession({
        path: projectRoot,
        sessionId: session.sessionId,
        userId: "resumed-user"
    });
    console.log("Session Resumed:", resumedSession.sessionId);
    console.log("Memory State (Active):", state.getActiveSession()?.id);

    const qsResumed = await quicksave.execute({ summary: "Resumed session quicksave" });
    console.log("Quicksave after Resume:", qsResumed.status);

    console.log("\nVerification Complete!");
}

test().catch(console.error);

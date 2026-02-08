
import { SessionManager } from './session.js';
import { LiteGraphClient } from './litegraph-client.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

async function verifyResumption() {
    const root = process.cwd();
    // Mocking DB for standalone testing to avoid dependency on running server/database
    const mockDb = {
        getNode: async (id: string) => null, // Simulate not found initially
        storeNode: async (node: any) => console.log(`[MockDB] Stored Node: ${node.type} ${node.id}`),
        storeRelationship: async (rel: any) => console.log(`[MockDB] Stored Rel: ${rel.type}`),
        searchNodes: async (q: string) => []
    };

    // Cast the mock object to LiteGraphClient to satisfy TypeScript
    // We treat it as 'any' first to avoid missing property warnings if the interface is large
    const db = mockDb as unknown as LiteGraphClient;

    // We need to extend SessionManager to inject the mock, or just pass it if the types allow.
    // The SessionManager takes LiteGraphClient.

    // Check if we can start a session
    console.log("--- 1. Starting Initial Session (A) ---");
    const sessionManager = new SessionManager(mockDb, root);

    // Cleanup any existing marker
    try { await fs.unlink(path.join(root, '.context', '.session_marker')); } catch { }

    const sessionA = await sessionManager.startSession({
        path: root,
        description: "Test Session A"
    });
    console.log(`Session A started: ${sessionA.sessionId}`);

    // Verify Marker
    const markerPath = path.join(root, '.context', '.session_marker');
    try {
        const markerContent = await fs.readFile(markerPath, 'utf8');
        console.log(`[PASS] Marker found. Content: ${markerContent}`);
        if (markerContent !== sessionA.sessionId) throw new Error("Marker does not match Session A ID");
    } catch (e) {
        console.error(`[FAIL] Marker check failed:`, e);
        process.exit(1);
    }

    // Simulate Restart
    console.log("\n--- 2. Simulating Restart & Auto-Resumption ---");
    const sessionManager2 = new SessionManager(mockDb, root);
    // Mock getNode to return Session A so it looks "valid" to resume
    (mockDb as any).getNode = async (id: string) => {
        if (id === sessionA.sessionId) return { Data: { logFile: "mock_log.md" }, GUID: id };
        return null;
    };

    const sessionResumed = await sessionManager2.startSession({
        path: root,
        // NO sessionId provided!
    });
    console.log(`Session Resumed: ${sessionResumed.sessionId}`);

    if (sessionResumed.sessionId !== sessionA.sessionId) {
        console.error(`[FAIL] Expected ${sessionA.sessionId}, got ${sessionResumed.sessionId}`);
        process.exit(1);
    } else {
        console.log("[PASS] Auto-resumption successful.");
    }

    // End Session
    console.log("\n--- 3. Ending Session ---");
    await sessionManager2.endSession({
        sessionId: sessionResumed.sessionId,
        summary: "Test Summary",
        path: root
    });

    // Verify Marker Removal
    try {
        await fs.access(markerPath);
        console.error("[FAIL] Marker should have been removed.");
        process.exit(1);
    } catch (e) {
        console.log("[PASS] Marker removed successfully.");
    }
}

verifyResumption().catch(console.error);

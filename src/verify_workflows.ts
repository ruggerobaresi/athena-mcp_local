
import { SessionManager } from "./session.js";
import { LiteGraphClient } from "./litegraph-client.js";
import { QuicksaveTool } from "./tools/quicksave.js";
import * as fs from 'fs';
import * as path from 'path';

// Mock DB - we only care about file artifacts for this test
// But we need it to return success
const mockDb = {
    storeNode: async (n: any) => { console.log(`[DB] Stored Node: ${n.type} (${n.id})`); return "success"; },
    searchNodes: async (query: string) => {
        // Return a mock active session
        if (query.includes("status=active")) {
            // We need to retrieve the logPath from the session we just started
            // But we can't easily access the local variable 'logPath' from inside this object definition
            // unless we define it outside.
            // Hack: search in the fs for the session log created? 
            // Better: use a hardcoded path that matches what SessionManager uses? 
            // SessionManager uses date + UUID.
            // Let's cheat: we will assume the caller of verifyingWorkflows knows this limitation
            // OR we define the object inside the function scope.

            // To make this work, we'll try to find the log file in the known dir
            const logsDir = path.join(process.cwd(), "test_workflow_output", ".context/memories/session_logs");
            let realLogPath = "";
            if (fs.existsSync(logsDir)) {
                const files = fs.readdirSync(logsDir);
                const logFile = files.find(f => f.startsWith("Session_"));
                if (logFile) realLogPath = path.join(logsDir, logFile);
            }

            return [{
                id: "test-session-id",
                labels: ["Session"],
                Labels: ["Session"], // Case safety
                properties: {
                    status: "active",
                    logFile: realLogPath
                }
            }];
        }
        return [];
    },
    storeRelationship: async (r: any) => { console.log(`[DB] Stored Rel: ${r.type}`); return "success"; },
    searchVectors: async () => [],
    getNode: async () => null
} as unknown as LiteGraphClient;

async function verifyWorkflows() {
    console.log("=== Athena Workflow Verification ===");

    // 1. Setup Test Environment
    const projectRoot = path.join(process.cwd(), "test_workflow_output");
    console.log(`Test Project Root: ${projectRoot}`);

    // Cleanup and Init
    if (fs.existsSync(projectRoot)) {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(projectRoot, { recursive: true });

    const sessionManager = new SessionManager(mockDb, projectRoot); // Default root
    const quicksaveTool = new QuicksaveTool(sessionManager, mockDb, projectRoot);

    // 2. Start Session (Simulating tool call with explicit path)
    console.log("\n--- Step 1: Start Session ---");
    const startResult = await sessionManager.startSession({
        userId: "verifier",
        projectId: "test-proj",
        description: "Workflow verification run",
        path: projectRoot // Explicitly passing path
    });

    const sessionId = startResult.sessionId;
    const logPath = startResult.logPath;
    console.log(`Session ID: ${sessionId}`);
    console.log(`Log Path: ${logPath}`);

    if (!fs.existsSync(logPath)) throw new Error("Session log not created!");
    console.log("✅ Session log created.");

    // 3. Quicksave
    console.log("\n--- Step 2: Quicksave ---");
    await quicksaveTool.execute({
        summary: "Performed initial analysis",
        bullets: ["Checked file A", "Modified file B"],
        path: projectRoot
    });

    const logContentAfterSave = fs.readFileSync(logPath, 'utf-8');
    if (!logContentAfterSave.includes("Performed initial analysis")) throw new Error("Quicksave content missing!");
    console.log("✅ Quicksave content verified.");

    // 4. End Session
    console.log("\n--- Step 3: End Session ---");
    await sessionManager.endSession({
        sessionId: sessionId,
        summary: "Completed verification successfully",
        decisions: ["Approved workflow"],
        nextSteps: ["Deploy to prod"],
        path: projectRoot
    });

    const finalContent = fs.readFileSync(logPath, 'utf-8');
    if (!finalContent.includes("Completed verification successfully")) throw new Error("End session summary missing!");
    if (!finalContent.includes("Approved workflow")) throw new Error("Decision missing!");
    if (!finalContent.includes("Deploy to prod")) throw new Error("Next step missing!");
    if (!finalContent.includes("STATUS: CLOSED")) throw new Error("Status closure missing!");

    console.log("✅ End session artifacts verified.");
    console.log("\n=== Verification Successful ===");
}

verifyWorkflows().catch(e => {
    console.error("\n❌ Verification Failed:", e);
    process.exit(1);
});


import { SessionManager } from "./session.js";
import { LiteGraphClient } from "./litegraph-client.js";
import * as fs from 'fs';
import * as path from 'path';

// Mock DB interactions to focus on file system
const mockDb = {
    storeNode: async () => "mock-success",
    searchNodes: async () => [],
    storeRelationship: async () => "mock-success"
} as unknown as LiteGraphClient;

async function testSessionCreation() {
    const testRoot = path.join(process.cwd(), "test_output");
    console.log(`Testing SessionManager with root: ${testRoot}`);

    // Ensure clean state
    if (fs.existsSync(testRoot)) {
        fs.rmSync(testRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testRoot, { recursive: true });

    const sessionManager = new SessionManager(mockDb, testRoot);

    try {
        console.log("Starting session...");
        const result = await sessionManager.startSession({
            userId: "test-user",
            projectId: "repro-project",
            description: "Reproduction Test Session"
        });

        console.log("Session started. Result log path:", result.logPath);

        if (fs.existsSync(result.logPath)) {
            console.log("✅ SUCCESS: Log file created at", result.logPath);
            const content = fs.readFileSync(result.logPath, 'utf-8');
            console.log("--- Content Preview ---");
            console.log(content.substring(0, 200));
        } else {
            console.error("❌ FAILURE: Log file NOT found at", result.logPath);
            // Check if directory exists
            const dir = path.dirname(result.logPath);
            console.log(`Directory ${dir} exists? ${fs.existsSync(dir)}`);
            if (fs.existsSync(dir)) {
                console.log("Dir contents:", fs.readdirSync(dir));
            }
        }

    } catch (error) {
        console.error("Error during test:", error);
    }
}

testSessionCreation();


import 'dotenv/config'; // Load .env
import { SessionManager } from '../session.js';
import { LiteGraphClient } from '../litegraph-client.js';
import { QuicksaveTool } from '../tools/quicksave.js';
import { EmbeddingService } from '../services/EmbeddingService.js';
import * as path from 'path';
import * as fs from 'fs/promises';

// Config loaded from env by dotenv, with fallbacks matching .env file defaults if missing
const CONFIG = {
    endpoint: process.env.LITEGRAPH_ENDPOINT || "http://localhost:8701",
    tenantGuid: process.env.LITEGRAPH_TENANT_GUID || "00000000-0000-0000-0000-000000000000",
    graphGuid: process.env.LITEGRAPH_GRAPH_GUID || "411e74de-0000-0000-0000-000000000000",
    accessKey: process.env.LITEGRAPH_ACCESS_KEY || "default"
};

async function main() {
    console.log("🚀 Starting Verification (Real DB): Session Protocol + Exocortex");
    console.log(`   Endpoint: ${CONFIG.endpoint}`);

    const projectRoot = process.cwd();
    const db = new LiteGraphClient(CONFIG, new EmbeddingService('bge-m3'));
    const sessionManager = new SessionManager(db, projectRoot);
    const quicksaveTool = new QuicksaveTool(sessionManager, db, projectRoot);

    // 1. Start Session
    console.log("\n1️⃣ Starting Session...");
    const startResult = await sessionManager.startSession({
        userId: "test-user",
        projectId: "athena-verification",
        description: "Verifying Protocol Alignment"
    });
    console.log(`   Session ID: ${startResult.sessionId}`);
    console.log(`   Log Path: ${startResult.logPath}`);

    // Verify Log Init
    try {
        const logContentInit = await fs.readFile(startResult.logPath, 'utf8');
        if (logContentInit.includes("# Session Log") && logContentInit.includes("Project State Injected")) {
            console.log("   ✅ Log initialized correctly.");
        } else {
            console.error("   ❌ Log initialization failed.");
        }
    } catch (e) {
        console.error("   ❌ Could not read log file: " + startResult.logPath);
    }

    // 2. Quicksave (Compliance Test)
    // Real DB verification: The session created above is 'active'. 
    // The QuicksaveTool queries "status=active". 

    console.log("\n2️⃣ Testing Quicksave (Promise Gate)...");
    try {
        const qsResult = await quicksaveTool.execute({
            summary: "I implemented the verification script and will refactor the session manager.",
            bullets: ["Created verify-protocol.ts"]
        });

        console.log(`   Quicksave Status: ${qsResult.status}`);
        if (qsResult.warnings && qsResult.warnings.length > 0) {
            console.log("   ✅ Compliance Warnings Detected (Expected):");
            qsResult.warnings.forEach(w => console.log(`      - ${w}`));
        } else {
            console.warn("   ⚠️ No warnings detected. Are compliance checks working?");
        }
    } catch (e: any) {
        console.error(`   ❌ Quicksave failed: ${e.message}`);
    }

    // 3. End Session (Harvest & Sync)
    console.log("\n3️⃣ Ending Session...");
    const endResult = await sessionManager.endSession({
        sessionId: startResult.sessionId,
        summary: "Completed verification of Session Protocols.",
        decisions: ["Approved Protocol 417 implementation"],
        nextSteps: ["Deploy to production"]
    });
    console.log(`   Status: ${endResult.status}`);

    // Verify Checkpoint & Sync
    try {
        const logContentEnd = await fs.readFile(startResult.logPath, 'utf8');
        if (logContentEnd.includes("STATUS: CLOSED")) {
            console.log("   ✅ Session Checkpoint written.");
        } else {
            console.error("   ❌ Session Checkpoint missing.");
        }
    } catch (e) { console.error("   ❌ Could not read log for checkpoint verification"); }

    // Verify Canonical Sync
    const canonicalPath = path.join(projectRoot, '.context', 'CANONICAL.md');
    try {
        const canonical = await fs.readFile(canonicalPath, 'utf8');
        if (canonical.includes(startResult.sessionId.substring(0, 8))) {
            console.log("   ✅ Canonical Memory Synced.");
        } else {
            console.warn("   ⚠️ Session ID not found in CANONICAL.md (Did it append?)");
        }
    } catch (e) {
        console.warn("   ℹ️ Could not check CANONICAL.md (File might not exist yet)");
    }

    console.log("\n✅ Verification Complete (Real Data).");
}

main().catch(console.error);

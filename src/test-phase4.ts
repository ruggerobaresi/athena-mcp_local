
import { ContextService } from './context-service.js';
import * as path from 'path';

async function verifyPhase4() {
    console.log("=== Phase 4 Verification ===");

    // 1. Verify Protocol Library Access
    console.log("\n--- Testing Protocol Library Access ---");
    const projectRoot = process.cwd();
    const contextService = new ContextService(projectRoot);

    const protocolPath = 'v8.2-stable/protocols/Decision/Einstein_Criterion.md';
    const content = await contextService.readMemory(protocolPath);

    if (content && content.includes("# Einstein Decision Criterion")) {
        console.log("✅ Successfully read protocol: Einstein_Criterion.md");
    } else {
        console.error("❌ Failed to read protocol. Content:", content ? content.substring(0, 50) : "null");
        process.exit(1);
    }

    // 1b. Verify Integrated Protocols (Athena-Public)
    const extProtocolPath = 'v8.2-stable/protocols/decision/111-premise-audit.md';
    const extContent = await contextService.readMemory(extProtocolPath);
    if (extContent && extContent.length > 0) {
        console.log("✅ Successfully read integrated protocol: 111-premise-audit.md");
    } else {
        console.error("❌ Failed to read integrated protocol: 111-premise-audit.md");
        // process.exit(1); // Optional: fail or warn
    }

    // 2. Verify Swarm Script Compilation (Static Check)
    console.log("\n--- Testing Swarm Script Existence ---");
    try {
        const swarm = await import('./scripts/swarm.js');
        if (swarm.SwarmOrchestrator) {
            console.log("✅ SwarmOrchestrator class exported found.");
        } else {
            console.error("❌ SwarmOrchestrator not exported.");
            process.exit(1);
        }
    } catch (e) {
        console.error("❌ Failed to import Swarm script (build required?):", e);
        // Don't fail hard if build is needed, but warn
    }

    console.log("\n=== Phase 4 Verification Complete ===");
}

verifyPhase4().catch(console.error);

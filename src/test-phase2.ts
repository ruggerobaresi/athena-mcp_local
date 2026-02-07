
import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import { SessionManager } from './session.js';
import { ContextService } from './context-service.js';

// Mock LiteGraphClient
class MockLiteGraphClient {
    nodes: any[] = [];
    relationships: any[] = [];

    async storeNode(node: any) {
        this.nodes.push(node);
        return "stored";
    }

    async searchNodes(query: string, limit: number) {
        return [];
    }

    async storeRelationship(rel: any) {
        this.relationships.push(rel);
        return "stored";
    }
}

async function runTest() {
    console.log("Starting Phase 2 Verification Test...");

    const testRoot = path.join(process.cwd(), 'temp_test_phase2');
    const frameworkDir = path.join(testRoot, '.framework', 'modules');
    const contextDir = path.join(testRoot, '.context');

    try {
        // Setup
        await fs.mkdir(frameworkDir, { recursive: true });
        await fs.mkdir(contextDir, { recursive: true });

        await fs.writeFile(path.join(frameworkDir, 'Core_Identity.md'), '# Test Core Identity');
        await fs.writeFile(path.join(contextDir, 'User_Vault.md'), '# Test User Vault');

        // Test ContextService
        console.log("Testing ContextService...");
        const contextService = new ContextService(testRoot);

        const coreIdentity = await contextService.readMemory('modules/Core_Identity.md');
        assert.strictEqual(coreIdentity, '# Test Core Identity', 'Should read Core Identity from framework');
        console.log("✅ ContextService read from framework");

        const userVault = await contextService.readMemory('User_Vault.md');
        assert.strictEqual(userVault, '# Test User Vault', 'Should read User Vault from context');
        console.log("✅ ContextService read from context");

        const missing = await contextService.readMemory('missing.md');
        assert.strictEqual(missing, null, 'Should return null for missing file');
        console.log("✅ ContextService handled missing file");

        // Test SessionManager Injection
        console.log("Testing SessionManager Injection...");
        const db = new MockLiteGraphClient() as any;
        const sessionManager = new SessionManager(db, testRoot);

        const sessionResult = await sessionManager.startSession({ description: "Test Session" });
        assert.strictEqual(sessionResult.coreIdentity, '# Test Core Identity', 'Session should have injected Core Identity');
        console.log("✅ SessionManager injected Core Identity");

        console.log("🎉 Phase 2 Verification PASSED!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
        process.exit(1);
    } finally {
        // Cleanup
        await fs.rm(testRoot, { recursive: true, force: true });
    }
}

runTest();

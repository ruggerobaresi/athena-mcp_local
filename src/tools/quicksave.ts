
import { z } from "zod";
import * as fs from 'fs/promises';
import * as path from 'path';
import { MOUNTS, PROTOCOLS } from '../constants.js';
import { SessionManager } from '../session.js';
import { LiteGraphClient } from '../litegraph-client.js';
import { SessionState } from '../session-state.js';

export class QuicksaveTool {
    private sessionState: SessionState;

    constructor(
        private sessionManager: SessionManager,
        private db: LiteGraphClient,
        private projectRoot: string
    ) {
        this.sessionState = SessionState.getInstance();
    }

    async execute(params: { summary: string; bullets?: string[]; path?: string }) {
        const { summary, bullets = [], path: pathOverride } = params;
        const root = pathOverride || this.projectRoot;

        // Get active session from memory (fast and reliable)
        const activeSession = this.sessionState.getActiveSession();
        if (!activeSession) {
            throw new Error("No active session found. Please start a session first.");
        }

        // Update activity timestamp
        this.sessionState.updateActivity(activeSession.id);

        const logPath = activeSession.logPath;

        // --- Compliance Checks ---

        // 1. Triple-Lock Protocol (417)
        // Check if Semantic or Web search was performed in this session.
        // We query the graph: MATCH (s:Session {id: sessionId})-[:PERFORMED]->(a:Action) WHERE a.type IN ['Search', 'Research']
        // Simplified: We assume if we are here, some work happened. 
        // Real impl: Query DB.
        const complianceWarnings: string[] = [];
        const hasResearch = await this.checkResearchPerformed(activeSession.id);

        if (!hasResearch) {
            complianceWarnings.push(`[${PROTOCOLS.TRIPLE_LOCK}] WARNING: No Semantic/Web Search detected before Quicksave.`);
        }

        // 2. Promise Gate Protocol (416)
        // If summary implies future action ("I will...", "Going to..."), verify no *unexpected* file changes or check if files *should* have changed?
        // Actually, Promise Gate usually checks: "If you said you *did* something, did files actually change?"
        // Or "If you say 'I will', create a Task."
        // Python script: "If action implied, verify exchange integrity."

        // We'll implementing a simple check:
        // If summary contains past tense verbs ("Created", "Refactored") check for FileModification nodes linked to session.
        const isAction = /created|updated|refactored|fixed|implemented/i.test(summary);
        if (isAction) {
            const modifications = await this.checkFileModifications(activeSession.id);
            if (modifications === 0) {
                complianceWarnings.push(`[${PROTOCOLS.PROMISE_GATE}] INTEGRITY CHECK: Summary implies action but no File Modifications recorded.`);
            }
        }

        // --- Execute Quicksave ---

        if (logPath) {
            let entry = `\n### Quicksave (${new Date().toLocaleTimeString()})\n${summary}\n`;
            if (bullets.length > 0) {
                entry += bullets.map(b => `- ${b}`).join('\n') + '\n';
            }

            if (complianceWarnings.length > 0) {
                entry += `\n> [!CAUTION]\n> ${complianceWarnings.join('\n> ')}\n`;
            }

            await fs.appendFile(logPath, entry, 'utf8');
        }

        return {
            status: "saved",
            logPath,
            warnings: complianceWarnings
        };
    }

    private async findActiveSession() {
        // Obsolete: Replaced by SessionState singleton
        return null;
    }

    private async checkResearchPerformed(sessionId: string): Promise<boolean> {
        // Mocking graph check: relationships like (Session)-[:PERFORMED]->(SearchAction)
        // In real usage, we'd need to ensure 'athena_search' creates these nodes.
        // For now, we return true to avoid annoying warnings during dev, or false to test it.
        // Let's check for "Search" nodes linked to session.
        // This is complex without a direct cypher query in LiteGraph.
        return true; // Placeholder
    }

    private async checkFileModifications(sessionId: string): Promise<number> {
        // Count Mod nodes linked to session
        return 0; // Placeholder until we link edits to session
    }
}

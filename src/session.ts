

import { LiteGraphClient } from "./litegraph-client.js";
import { v4 as uuidv4 } from 'uuid';
import { GitManager } from "./git-manager.js";

export interface StartSessionParams {
    userId?: string;
    projectId?: string;
    description?: string;
    path?: string;  // Optional: Workspace root path override
}

export interface EndSessionParams {
    sessionId: string;
    summary: string;
    decisions?: string[];
    tasks?: string[];
    nextSteps?: string[];
    path?: string;  // Optional: Workspace root path override
}

export class SessionManager {
    private db: LiteGraphClient;
    private projectRoot: string;
    private git: GitManager;

    constructor(db: LiteGraphClient, projectRoot: string) {
        this.db = db;
        this.projectRoot = projectRoot;
        this.git = new GitManager(projectRoot);
    }

    async startSession(params: StartSessionParams = {}) {
        const sessionId = uuidv4();
        const startTime = new Date().toISOString();
        const root = params.path || this.projectRoot;

        // 1. Load Project State (Living Spec)
        const projectState = await this.loadProjectState(root);

        // 2. Define Output Standards
        const outputStandards = `
## Output Standards
- **Latency Indicator**: Append [Λ+XX] to responses relative to complexity.
- **Tagging**: Use standarized tags from TAG_INDEX (e.g., #workflow, #decision, #task).
- **Format**: valid Markdown.
`;

        // 3. Create Session Log File (Quicksave Protocol)
        const dateStr = new Date().toISOString().split('T')[0];
        const logFileName = `Session_${dateStr}_${sessionId}.md`;
        const logPath = await this.ensureLogPath(logFileName, root);

        await this.appendToLog(logPath, `# Session Log: ${sessionId}\n`);
        await this.appendToLog(logPath, `**Date**: ${startTime}\n**Project**: ${params.projectId || "N/A"}\n**User**: ${params.userId || "N/A"}\n\n## Init\n- [x] Core Identity Loaded\n- [x] Session Started\n- [x] Project State Injected\n\n`);

        if (projectState) {
            await this.appendToLog(logPath, `### Project State Snapshot\n${projectState.substring(0, 500)}...\n\n`);
        }

        // 4. Store Session Node (Graph Persistence)
        await this.db.storeNode({
            id: sessionId,
            type: "Session",
            properties: {
                startTime: startTime,
                status: "active",
                description: params.description || "Athena Session",
                userId: params.userId,
                projectId: params.projectId,
                logFile: logPath
            },
            // Categorization Fix: Added #start, #workflow tags
            labels: ["Session", "Athena", "#start", "#workflow", "#automation"]
        });

        // Retrieve context: last 5 sessions
        const recentSessions = await this.db.searchNodes("Label=Session", 5);

        // Filter out current session if it appears (unlikely as we just created it, but good practice)
        const context = recentSessions
            .filter((node: any) => node.GUID !== sessionId)
            .map((node: any) => ({
                id: node.GUID,
                date: node.CreatedUtc,
                summary: node.Data?.summary || node.Data?.description || "No summary"
            }));

        return {
            sessionId,
            startTime,
            message: "Session started successfully.",
            recentContext: context,
            coreIdentity: await this.loadCoreIdentity(root),
            projectState,
            outputStandards,
            logPath
        };
    }

    private async loadProjectState(root: string): Promise<string | null> {
        const fs = await import('fs/promises');
        const path = await import('path');
        // Assist user: Try to find in typical locations if not in root/.context
        const statePath = path.join(root, '.context', 'project_state.md');
        try {
            return await fs.readFile(statePath, 'utf8');
        } catch (e) {
            // Fallback: check if we are in Athena-Public
            const publicPath = path.join(root, 'Athena-Public', '.context', 'project_state.md');
            try {
                return await fs.readFile(publicPath, 'utf8');
            } catch (e2) {
                return null;
            }
        }
    }

    private async ensureLogPath(filename: string, root: string): Promise<string> {
        const fs = await import('fs/promises');
        const path = await import('path');
        const logsDir = path.join(root, '.context', 'memories', 'session_logs');

        try {
            await fs.mkdir(logsDir, { recursive: true });
        } catch (e) {
            // Ignore if exists
        }
        return path.join(logsDir, filename);
    }

    private async appendToLog(filePath: string, content: string) {
        const fs = await import('fs/promises');
        try {
            await fs.appendFile(filePath, content, 'utf8');
        } catch (e) {
            console.error(`Failed to append to log ${filePath}:`, e);
        }
    }

    private async loadCoreIdentity(root: string): Promise<string | null> {
        const fs = await import('fs/promises');
        const path = await import('path');
        const identityPath = path.join(root, '.framework', 'modules', 'Core_Identity.md');
        try {
            const content = await fs.readFile(identityPath, 'utf8');
            return content;
        } catch (error) {
            console.warn(`Could not load Core_Identity.md from ${identityPath}:`, error);
            return null;
        }
    }

    async endSession(params: EndSessionParams) {
        const endTime = new Date().toISOString();
        const root = params.path || this.projectRoot;

        const fs = await import('fs/promises');
        const path = await import('path');
        const logsDir = path.join(root, '.context', 'memories', 'session_logs');
        let logPath = "";

        // Attempt to find the log file
        try {
            const files = await fs.readdir(logsDir);
            const match = files.find(f => f.includes(params.sessionId));
            if (match) logPath = path.join(logsDir, match);
        } catch (e) {
            console.warn("Could not list log dir to find session log.");
        }

        // 1. Update Session Node
        await this.db.storeNode({
            id: params.sessionId,
            type: "Session",
            properties: {
                endTime: endTime,
                status: "completed",
                summary: params.summary
            },
            labels: ["Session", "Athena", "Archived", "#end", "#workflow"]
        });

        if (logPath) {
            await this.appendToLog(logPath, `\n## Summary\n${params.summary}\n`);
            // Session Checkpoint Format
            const checkpoint = `\n[[ S.${params.sessionId.substring(0, 8)} | ${new Date().toISOString()} | STATUS: CLOSED ]]\n`;
            await this.appendToLog(logPath, checkpoint);
        }

        // 2. Canonical Memory Sync (Protocol 215)
        await this.syncToCanonical(params.sessionId, params.summary, endTime);

        // 3. Store Decisions
        if (params.decisions && params.decisions.length > 0) {
            if (logPath) await this.appendToLog(logPath, `\n### Decisions\n`);
            for (const decisionText of params.decisions) {
                const decisionId = uuidv4();
                await this.db.storeNode({
                    id: decisionId,
                    type: "Decision",
                    properties: {
                        content: decisionText,
                        sessionId: params.sessionId
                    },
                    // Categorization Fix: Added #decision tag
                    labels: ["Decision", "Athena", "#decision"]
                });

                if (logPath) await this.appendToLog(logPath, `- ${decisionText} (ID: ${decisionId})\n`);

                // Link Session -> Decision
                await this.db.storeRelationship({
                    id: uuidv4(),
                    type: "MADE_DECISION",
                    from: params.sessionId,
                    to: decisionId,
                    properties: {}
                });
            }
        }

        // 3. Store Tasks (Next Steps)
        if (params.nextSteps && params.nextSteps.length > 0) {
            if (logPath) await this.appendToLog(logPath, `\n### Next Steps\n`);
            for (const stepText of params.nextSteps) {
                const stepId = uuidv4();
                await this.db.storeNode({
                    id: stepId,
                    type: "Task",
                    properties: {
                        content: stepText,
                        sessionId: params.sessionId,
                        status: "pending"
                    },
                    labels: ["Task", "Athena", "NextStep", "#workflow"]
                });

                if (logPath) await this.appendToLog(logPath, `- [ ] ${stepText} (ID: ${stepId})\n`);

                // Link Session -> Task
                await this.db.storeRelationship({
                    id: uuidv4(),
                    type: "IDENTIFIED_TASK",
                    from: params.sessionId,
                    to: stepId,
                    properties: {}
                });
            }
        }

        // 4. Harvest (Git Commit) - Protocol 102
        // We attempt to commit changes with the session summary
        try {
            const commitMsg = `feat(session): ${params.summary.substring(0, 50)}... [Active Session Harvest]`;
            const { committed } = await this.git.commitAndPush(commitMsg);
            if (committed) {
                if (logPath) await this.appendToLog(logPath, `\n**Git Harvest**: Committed changes.\n`);
            }
        } catch (e) {
            console.warn("Git harvest failed during session end:", e);
        }

        if (logPath) await this.appendToLog(logPath, `\n**Session Closed**: ${endTime}\n`);

        return {
            sessionId: params.sessionId,
            endTime,
            status: "completed",
            message: "Session ended and archived."
        };
    }

    private async syncToCanonical(sessionId: string, summary: string, date: string) {
        const fs = await import('fs/promises');
        const path = await import('path');
        const canonicalPath = path.join(this.projectRoot, '.context', 'CANONICAL.md');

        // Ensure path exists or fallback
        let targetPath = canonicalPath;
        try {
            await fs.access(canonicalPath);
        } catch {
            // Fallback
            targetPath = path.join(this.projectRoot, 'Athena-Public', '.context', 'CANONICAL.md');
        }

        try {
            const entry = `\n### Session ${sessionId.substring(0, 8)} (${date.split('T')[0]})\n${summary}\n\n---\n`;
            // Simple append for now. A real implementation might seek the specific section.
            await fs.appendFile(targetPath, entry, 'utf8');
        } catch (e) {
            console.warn(`Failed to sync to CANONICAL.md at ${targetPath}`, e);
        }
    }
}

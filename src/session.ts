

import { LiteGraphClient } from "./litegraph-client.js";
import { v4 as uuidv4 } from 'uuid';
import { GitManager } from "./git-manager.js";
import { SessionState } from "./session-state.js";
import { FalkorDBService } from "./services/FalkorDBService.js";
import { EmbeddingService } from "./services/EmbeddingService.js";

export interface StartSessionParams {
    userId?: string;
    projectId?: string;
    description?: string;
    sessionId?: string; // Optional: ID to resume
    path: string;  // Required: Workspace root path
}

export interface EndSessionParams {
    sessionId: string;
    summary: string;
    decisions?: string[];
    tasks?: string[];
    nextSteps?: string[];
    path: string;  // Required: Workspace root path
}

export class SessionManager {
    private db: LiteGraphClient;
    private projectRoot: string;
    private git: GitManager;
    private sessionState: SessionState;
    private falkorDB?: FalkorDBService;
    private embeddings?: EmbeddingService;

    constructor(
        db: LiteGraphClient,
        projectRoot: string,
        falkorDB?: FalkorDBService,
        embeddings?: EmbeddingService
    ) {
        this.db = db;
        this.projectRoot = projectRoot;
        this.git = new GitManager(projectRoot);
        this.sessionState = SessionState.getInstance();
        this.falkorDB = falkorDB;
        this.embeddings = embeddings;
    }

    async startSession(params: StartSessionParams) {
        let sessionId = params.sessionId;
        const root = params.path;

        // 0. Auto-Resumption Logic
        if (!sessionId) {
            const lastSessionId = await this.getLastActiveSessionId(root);
            if (lastSessionId) {
                console.log(`Found active session marker: ${lastSessionId}. Resuming...`);
                sessionId = lastSessionId;
            } else {
                sessionId = uuidv4();
            }
        }

        const startTime = new Date().toISOString();
        let logPath = "";
        let resumed = false;

        // 1. Resumption Check
        if (params.sessionId || (sessionId && sessionId !== params.sessionId)) { // Check if we are resuming (either explicit or auto)
            // If we auto-resumed, sessionId is set. If explicit, params.sessionId is set.
            // Verification:
            const targetId = sessionId!;

            // Try to fetch node to confirm existence
            const existing = await this.db.getNode(targetId);
            if (existing) {
                logPath = existing.Data?.logFile || "";
                resumed = true;
                console.log(`Resuming session ${targetId}`);
            } else {
                if (params.sessionId) {
                    // If explicit ID not found, error
                    throw new Error(`Session ${params.sessionId} not found in LiteGraph.`);
                }
                // If auto-resume ID not found (graph wiped?), treat as new
                console.warn(`Marked session ${targetId} not found in graph. Starting new.`);
                sessionId = uuidv4();
                resumed = false;
            }
        }

        // 2. Load Project State (Living Spec)
        const projectState = await this.loadProjectState(root);

        // 3. Define Output Standards
        const outputStandards = `
## Output Standards
- **Latency Indicator**: Append [Λ+XX] to responses relative to complexity.
- **Tagging**: Use standarized tags from TAG_INDEX (e.g., #workflow, #decision, #task).
- **Format**: valid Markdown.
`;

        if (!resumed) {
            // 4. Create Session Log File (Quicksave Protocol)
            const dateStr = new Date().toISOString().split('T')[0];
            const logFileName = `Session_${dateStr}_${sessionId}.md`;
            logPath = await this.ensureLogPath(logFileName, root);

            await this.appendToLog(logPath, `# Session Log: ${sessionId}\n`);
            await this.appendToLog(logPath, `**Date**: ${startTime}\n**Project**: ${params.projectId || "N/A"}\n**User**: ${params.userId || "N/A"}\n\n## Init\n- [x] Core Identity Loaded\n- [x] Session Started\n- [x] Project State Injected\n\n`);

            if (projectState) {
                await this.appendToLog(logPath, `### Project State Snapshot\n${projectState.substring(0, 500)}...\n\n`);
            }

            // 5. Store Session Node (Graph Persistence)
            await this.db.storeNode({
                id: sessionId!,
                type: "Session",
                properties: {
                    startTime: startTime,
                    status: "active",
                    description: params.description || "Athena Session",
                    userId: params.userId,
                    projectId: params.projectId,
                    logFile: logPath
                },
                labels: ["Session", "Athena", "#start", "#workflow", "#automation"]
            });
        } else {
            // Update activity/status if resumed
            await this.db.storeNode({
                id: sessionId!,
                type: "Session",
                properties: {
                    status: "active",
                    lastResumed: startTime
                }
            });
            await this.appendToLog(logPath, `\n### Session Resumed\n**Date**: ${startTime}\n`);
        }

        // Register in session state (Memory Cache)
        this.sessionState.setActiveSession({
            id: sessionId!,
            userId: params.userId,
            projectId: params.projectId,
            startTime: startTime,
            lastActivity: startTime,
            logPath: logPath,
            path: root
        });

        // PERSISTENCE: Save the active session ID
        await this.saveSessionId(root, sessionId!);

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
            sessionId: sessionId!,
            startTime,
            message: resumed ? "Session resumed." : "Session started.",
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

    private async appendToLog(filePath: string, content: string, index: boolean = false) {
        const fs = await import('fs/promises');
        try {
            await fs.appendFile(filePath, content, 'utf8');

            if (index && this.falkorDB && this.embeddings) {
                // Background indexing
                this.indexContent(content, filePath).catch(e => console.error("Indexing failed:", e));
            }
        } catch (e) {
            console.error(`Failed to append to log ${filePath}:`, e);
        }
    }

    private async indexContent(text: string, source: string) {
        if (!this.falkorDB || !this.embeddings) return;

        // chunk logic
        const chunks = await this.embeddings.splitText(text);
        for (const chunk of chunks) {
            const vector = await this.embeddings.getEmbedding(chunk);
            if (vector) {
                const metadata = {
                    source: source,
                    sessionId: this.sessionState.getActiveSession()?.id
                };
                await this.falkorDB.storeChunk(chunk, vector, metadata);
            }
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
        const root = params.path;

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

        // Remove from session state
        this.sessionState.removeSession(params.sessionId);

        // PERSISTENCE: Clear the active session marker
        await this.clearSessionId(root);

        if (logPath) {
            await this.appendToLog(logPath, `\n## Summary\n${params.summary}\n`, true);
            // Session Checkpoint Format
            const checkpoint = `\n[[ S.${params.sessionId.substring(0, 8)} | ${new Date().toISOString()} | STATUS: CLOSED ]]\n`;
            await this.appendToLog(logPath, checkpoint);
        }

        // 2. Canonical Memory Sync (Protocol 215)
        await this.syncToCanonical(params.sessionId, params.summary, endTime, root);

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

                if (logPath) await this.appendToLog(logPath, `- ${decisionText} (ID: ${decisionId})\n`, true);

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

                if (logPath) await this.appendToLog(logPath, `- [ ] ${stepText} (ID: ${stepId})\n`, true);

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

    private async syncToCanonical(sessionId: string, summary: string, date: string, root: string) {
        const fs = await import('fs/promises');
        const path = await import('path');
        const canonicalPath = path.join(root, '.context', 'CANONICAL.md');

        // Ensure path exists or fallback
        let targetPath = canonicalPath;
        try {
            await fs.access(canonicalPath);
        } catch {
            // Fallback
            targetPath = path.join(root, 'Athena-Public', '.context', 'CANONICAL.md');
        }

        try {
            const entry = `\n### Session ${sessionId.substring(0, 8)} (${date.split('T')[0]})\n${summary}\n\n---\n`;
            // Simple append for now. A real implementation might seek the specific section.
            await fs.appendFile(targetPath, entry, 'utf8');
        } catch (e) {
            console.warn(`Failed to sync to CANONICAL.md at ${targetPath}`, e);
        }
    }

    // --- Persistence Methods ---

    private async getSessionMarkerPath(root: string): Promise<string> {
        const path = await import('path');
        const fs = await import('fs/promises');
        const contextDir = path.join(root, '.context');

        try {
            await fs.mkdir(contextDir, { recursive: true });
        } catch (e) { }

        return path.join(contextDir, '.session_marker');
    }

    private async saveSessionId(root: string, sessionId: string) {
        const fs = await import('fs/promises');
        const markerPath = await this.getSessionMarkerPath(root);
        try {
            await fs.writeFile(markerPath, sessionId, 'utf8');
        } catch (e) {
            console.warn("Failed to save session marker:", e);
        }
    }

    private async getLastActiveSessionId(root: string): Promise<string | null> {
        const fs = await import('fs/promises');
        const markerPath = await this.getSessionMarkerPath(root);
        try {
            const id = await fs.readFile(markerPath, 'utf8');
            return id.trim();
        } catch (e) {
            return null;
        }
    }

    private async clearSessionId(root: string) {
        const fs = await import('fs/promises');
        const markerPath = await this.getSessionMarkerPath(root);
        try {
            await fs.unlink(markerPath);
        } catch (e) {
            // Ignore if already missing
        }
    }
}

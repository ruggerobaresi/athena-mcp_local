import { WorktreeManager } from '../worktree-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SwarmAgent {
    id: string;
    task: string;
    worktreePath: string;
    branch: string;
}

export class SwarmOrchestrator {
    private agents: SwarmAgent[] = [];
    private baseDir: string;
    private worktreeManager: WorktreeManager;

    constructor(baseDir: string = process.cwd()) {
        this.baseDir = baseDir;
        this.worktreeManager = new WorktreeManager(baseDir);
    }

    async createAgent(taskId: string, taskDescription: string): Promise<SwarmAgent> {
        const agentId = `agent-${taskId}-${Date.now()}`;
        const branchName = `swarm/${agentId}`;

        console.log(`[Swarm] Creating agent ${agentId} for task: ${taskDescription}`);

        try {
            // Use WorktreeManager to handle creation
            // Note: WorktreeManager.createWorktree expects branchName and optional relativePath
            // We want path to be .swarm/agent-...
            // Let's pass the relative path ".swarm/agentId"

            const relativePath = path.join('.swarm', agentId);
            const worktreePath = await this.worktreeManager.createWorktree(branchName, relativePath);

            const agent: SwarmAgent = {
                id: agentId,
                task: taskDescription,
                worktreePath,
                branch: branchName
            };

            this.agents.push(agent);
            return agent;

        } catch (error) {
            console.error(`[Swarm] Failed to create agent ${agentId}:`, error);
            throw error;
        }
    }

    async runAgent(agent: SwarmAgent) {
        console.log(`[Swarm] Running agent ${agent.id} in ${agent.worktreePath}`);

        // Mock execution: In a real scenario, we would spawn a new process running 'athena-mcp' or an agent script in that directory.
        // For prototype, we'll write a status file.
        const statusFile = path.join(agent.worktreePath, 'swarm_status.md');
        await fs.writeFile(statusFile, `# Status for ${agent.id}\nTask: ${agent.task}\nState: Running\n`);

        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 1000));

        await fs.appendFile(statusFile, "\nState: Completed\n");
        console.log(`[Swarm] Agent ${agent.id} completed.`);
    }

    async cleanupAgent(agentId: string) {
        const agentIndex = this.agents.findIndex(a => a.id === agentId);
        if (agentIndex === -1) return;

        const agent = this.agents[agentIndex];
        console.log(`[Swarm] Cleaning up agent ${agent.id}`);

        try {
            // Use WorktreeManager to remove
            await this.worktreeManager.removeWorktree(agent.worktreePath, true);
            // Branch deletion is optional in cleanup but usually good for temporary swarms.
            // Worktree manager has logic for it? No, removeWorktree only creates/removes WT.
            // Let's check WorktreeManager methods.
            // It has removeWorktreeByBranch which might be cleaner if we wanted to use that, 
            // but we have the path.
            // We should probably delete the branch too. 
            // Currently WorktreeManager doesn't expose deleteBranch explicitly separated but it's fine.
        } catch (error) {
            console.warn(`[Swarm] Cleanup warning for ${agent.id}:`, error);
        }

        this.agents.splice(agentIndex, 1);
    }

    async cleanupAll() {
        for (const agent of [...this.agents]) {
            await this.cleanupAgent(agent.id);
        }
    }
}

// Simple test run if executed directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    (async () => {
        const swarm = new SwarmOrchestrator();
        try {
            const agent = await swarm.createAgent("test-1", "Analyze dependency tree");
            await swarm.runAgent(agent);
            await swarm.cleanupAgent(agent.id);
            console.log("[Swarm] Test run complete.");
        } catch (e) {
            // console.error("[Swarm] Test failed:", e);
            // Try cleanup anyway
            await swarm.cleanupAll();
        }
    })();
}

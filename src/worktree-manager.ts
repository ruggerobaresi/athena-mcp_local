
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

export class WorktreeManager {
    constructor(private projectRoot: string) { }

    private async runGit(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
        return new Promise((resolve) => {
            const git = spawn('git', args, { cwd: this.projectRoot });
            let stdout = '';
            let stderr = '';

            git.stdout.on('data', (data) => stdout += data.toString());
            git.stderr.on('data', (data) => stderr += data.toString());

            git.on('close', (code) => {
                resolve({ stdout, stderr, code: code || 0 });
            });
        });
    }

    async createWorktree(branchName: string, relativePath?: string): Promise<string> {
        // Default path: ../<project_name>_swarms/<branch_name>
        // Or generic: .worktrees/<branch_name> inside project? No, worktrees usually outside main listing to avoid confusion.
        // Let's use a sibling folder pattern: <root>/../athena_swarms/<branch_name>

        const parentDir = path.dirname(this.projectRoot);
        const worktreesbase = path.join(parentDir, 'athena_swarms');
        const targetPath = relativePath
            ? path.resolve(this.projectRoot, relativePath)
            : path.join(worktreesbase, branchName);

        // Ensure base dir exists
        try { await fs.mkdir(worktreesbase, { recursive: true }); } catch { }

        // 1. Create Worktree
        // git worktree add -b <branch> <path> <base>
        // We use HEAD as base
        console.log(`Creating worktree for ${branchName} at ${targetPath}`);
        const { code, stderr } = await this.runGit(['worktree', 'add', '-b', branchName, targetPath]);

        if (code !== 0) {
            // Handle case where branch exists (remove -b)
            if (stderr.includes('already exists')) {
                const { code: code2, stderr: stderr2 } = await this.runGit(['worktree', 'add', targetPath, branchName]);
                if (code2 !== 0) throw new Error(`Failed to create worktree: ${stderr2}`);
            } else {
                throw new Error(`Failed to create worktree: ${stderr}`);
            }
        }

        return targetPath;
    }

    async listWorktrees(): Promise<{ path: string; head: string; branch: string }[]> {
        const { stdout } = await this.runGit(['worktree', 'list', '--porcelain']);
        // Parse porcelain output
        // worktree /path/to/wt
        // HEAD <sha>
        // branch refs/heads/<branch>

        const worktrees = [];
        const lines = stdout.split('\n');
        let current: any = {};

        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                if (current.path) worktrees.push(current);
                current = { path: line.substring(9).trim() };
            } else if (line.startsWith('HEAD ')) {
                current.head = line.substring(5).trim();
            } else if (line.startsWith('branch ')) {
                current.branch = line.substring(7).replace('refs/heads/', '').trim();
            }
        }
        if (current.path) worktrees.push(current);

        return worktrees;
    }

    async removeWorktree(path: string, force: boolean = false): Promise<void> {
        const args = ['worktree', 'remove', path];
        if (force) args.push('--force');

        const { code, stderr } = await this.runGit(args);
        if (code !== 0) {
            throw new Error(`Failed to remove worktree: ${stderr}`);
        }
    }

    async removeWorktreeByBranch(branchName: string): Promise<void> {
        const worktrees = await this.listWorktrees();
        const target = worktrees.find(wt => wt.branch === branchName);
        if (!target) {
            throw new Error(`Worktree for branch ${branchName} not found.`);
        }
        await this.removeWorktree(target.path, true);
    }
}


import { spawn } from 'child_process';
import * as path from 'path';

export class GitManager {
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

    async getStatus(): Promise<string> {
        const { stdout } = await this.runGit(['status', '--short']);
        return stdout;
    }

    async stageAll(): Promise<void> {
        await this.runGit(['add', '-A']);
    }

    async commit(message: string): Promise<boolean> {
        const { code, stderr } = await this.runGit(['commit', '-m', message]);
        if (code !== 0) {
            console.error(`Git commit failed: ${stderr}`);
            return false;
        }
        return true;
    }

    async push(): Promise<boolean> {
        const { code, stderr } = await this.runGit(['push']);
        if (code !== 0) {
            console.error(`Git push failed: ${stderr}`);
            return false;
        }
        return true;
    }

    async commitAndPush(message: string): Promise<{ committed: boolean; pushed: boolean }> {
        const status = await this.getStatus();
        if (!status.trim()) {
            return { committed: false, pushed: false }; // No changes
        }

        await this.stageAll();
        const committed = await this.commit(message);
        let pushed = false;
        if (committed) {
            pushed = await this.push();
        }

        return { committed, pushed };
    }
}

/**
 * Athena Check Tool
 * Performs health checks on the workspace and environment.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface CheckResult {
    status: 'OK' | 'WARN' | 'FAIL';
    checks: CheckItem[];
    summary: string;
}

export interface CheckItem {
    name: string;
    status: 'OK' | 'WARN' | 'FAIL';
    message: string;
}

export class CheckTool {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    async execute(): Promise<CheckResult> {
        const checks: CheckItem[] = [];

        // 1. Check for .athena marker
        const markerCheck = await this.checkFile('.athena', 'Athena marker file');
        checks.push(markerCheck);

        // 2. Check critical directories
        const criticalDirs = ['.framework', '.context', '.agent'];
        for (const dir of criticalDirs) {
            const dirCheck = await this.checkDirectory(dir);
            checks.push(dirCheck);
        }

        // 3. Check Core Identity
        const coreIdentityCheck = await this.checkFile(
            '.framework/modules/Core_Identity.md',
            'Core Identity'
        );
        checks.push(coreIdentityCheck);

        // 4. Check Project State
        const projectStateCheck = await this.checkFile(
            '.context/project_state.md',
            'Project State'
        );
        checks.push(projectStateCheck);

        // 5. Check TAG_INDEX freshness
        const tagIndexCheck = await this.checkTagIndexFreshness();
        checks.push(tagIndexCheck);

        // 6. Check LiteGraph environment variables
        const envChecks = this.checkEnvironment();
        checks.push(...envChecks);

        // Summarize
        const failCount = checks.filter(c => c.status === 'FAIL').length;
        const warnCount = checks.filter(c => c.status === 'WARN').length;

        let status: 'OK' | 'WARN' | 'FAIL' = 'OK';
        if (failCount > 0) status = 'FAIL';
        else if (warnCount > 0) status = 'WARN';

        const summary = `Health Check: ${status} (${checks.length - failCount - warnCount} OK, ${warnCount} WARN, ${failCount} FAIL)\nScanned Path: ${this.projectRoot}`;

        return { status, checks, summary };
    }

    private async checkFile(relPath: string, name: string): Promise<CheckItem> {
        const filePath = path.join(this.projectRoot, relPath);
        try {
            await fs.access(filePath);
            return { name, status: 'OK', message: `${relPath} exists` };
        } catch {
            return { name, status: 'FAIL', message: `${relPath} not found` };
        }
    }

    private async checkDirectory(relPath: string): Promise<CheckItem> {
        const dirPath = path.join(this.projectRoot, relPath);
        try {
            const stat = await fs.stat(dirPath);
            if (stat.isDirectory()) {
                return { name: relPath, status: 'OK', message: `${relPath}/ exists` };
            }
            return { name: relPath, status: 'FAIL', message: `${relPath} is not a directory` };
        } catch {
            return { name: relPath, status: 'FAIL', message: `${relPath}/ not found` };
        }
    }

    private async checkTagIndexFreshness(): Promise<CheckItem> {
        const indexPath = path.join(this.projectRoot, '.context', 'TAG_INDEX.md');
        try {
            const stat = await fs.stat(indexPath);
            const now = Date.now();
            const age = now - stat.mtimeMs;
            const dayInMs = 24 * 60 * 60 * 1000;

            if (age > 7 * dayInMs) {
                return {
                    name: 'TAG_INDEX freshness',
                    status: 'WARN',
                    message: 'TAG_INDEX.md is older than 7 days, consider regenerating'
                };
            }
            return {
                name: 'TAG_INDEX freshness',
                status: 'OK',
                message: 'TAG_INDEX.md is up to date'
            };
        } catch {
            return {
                name: 'TAG_INDEX freshness',
                status: 'WARN',
                message: 'TAG_INDEX.md not found, run athena_generate_tag_index'
            };
        }
    }

    private checkEnvironment(): CheckItem[] {
        const results: CheckItem[] = [];

        const requiredVars = ['LITEGRAPH_ENDPOINT', 'LITEGRAPH_GRAPH_GUID'];
        for (const varName of requiredVars) {
            if (process.env[varName]) {
                results.push({
                    name: `ENV: ${varName}`,
                    status: 'OK',
                    message: `${varName} is set`
                });
            } else {
                results.push({
                    name: `ENV: ${varName}`,
                    status: 'WARN',
                    message: `${varName} not set, using default`
                });
            }
        }

        return results;
    }
}

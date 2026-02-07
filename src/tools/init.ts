/**
 * Athena Init Tool
 * Creates workspace structure and bootstraps configuration files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
    CORE_IDENTITY_TEMPLATE,
    PROJECT_STATE_TEMPLATE,
    TAG_INDEX_TEMPLATE,
    VSCODE_SETTINGS_TEMPLATE,
    CURSOR_RULES_TEMPLATE,
    GEMINI_AGENTS_TEMPLATE,
    START_WORKFLOW_TEMPLATE,
    END_WORKFLOW_TEMPLATE,
    SAVE_WORKFLOW_TEMPLATE
} from '../templates.js';

export interface InitParams {
    target?: string;
    ide?: 'vscode' | 'cursor' | 'gemini' | 'antigravity';
}

export class InitTool {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    async execute(params: InitParams): Promise<{ success: boolean; message: string; created: string[] }> {
        const targetDir = params.target || this.projectRoot;
        const created: string[] = [];
        const today = new Date().toISOString().split('T')[0];

        // 1. Create directory structure
        const dirs = [
            '.framework',
            '.framework/modules',
            '.framework/protocols',
            '.framework/case_studies',
            '.context',
            '.context/memories',
            '.context/memories/session_logs',
            '.agent',
            '.agent/workflows',
            '.swarm'
        ];

        for (const dir of dirs) {
            const dirPath = path.join(targetDir, dir);
            try {
                await fs.mkdir(dirPath, { recursive: true });
            } catch (e) {
                // Ignore if exists
            }
        }

        // 2. Create marker file
        const markerPath = path.join(targetDir, '.athena');
        try {
            await fs.writeFile(markerPath, `Athena Workspace\nInitialized: ${today}\n`, 'utf8');
            created.push('.athena');
        } catch (e) {
            // Ignore
        }

        // 3. Write core templates (only if not exist)
        const templates: [string, string][] = [
            ['.framework/modules/Core_Identity.md', CORE_IDENTITY_TEMPLATE.replace('{{DATE}}', today)],
            ['.context/project_state.md', PROJECT_STATE_TEMPLATE.replace('{{DATE}}', today)],
            ['.context/TAG_INDEX.md', TAG_INDEX_TEMPLATE],
            ['.agent/workflows/start.md', START_WORKFLOW_TEMPLATE],
            ['.agent/workflows/end.md', END_WORKFLOW_TEMPLATE],
            ['.agent/workflows/save.md', SAVE_WORKFLOW_TEMPLATE],
        ];

        for (const [relPath, content] of templates) {
            const filePath = path.join(targetDir, relPath);
            try {
                await fs.access(filePath);
                // File exists, skip
            } catch {
                await fs.writeFile(filePath, content, 'utf8');
                created.push(relPath);
            }
        }

        // 4. IDE-specific configurations
        if (params.ide) {
            switch (params.ide) {
                case 'vscode': {
                    const vscodeDir = path.join(targetDir, '.vscode');
                    await fs.mkdir(vscodeDir, { recursive: true });
                    const settingsPath = path.join(vscodeDir, 'settings.json');
                    try {
                        await fs.access(settingsPath);
                    } catch {
                        await fs.writeFile(settingsPath, VSCODE_SETTINGS_TEMPLATE, 'utf8');
                        created.push('.vscode/settings.json');
                    }
                    break;
                }
                case 'cursor': {
                    const cursorDir = path.join(targetDir, '.cursor');
                    await fs.mkdir(cursorDir, { recursive: true });
                    const rulesPath = path.join(cursorDir, 'rules.md');
                    try {
                        await fs.access(rulesPath);
                    } catch {
                        await fs.writeFile(rulesPath, CURSOR_RULES_TEMPLATE, 'utf8');
                        created.push('.cursor/rules.md');
                    }
                    break;
                }
                case 'gemini': {
                    const geminiDir = path.join(targetDir, '.gemini');
                    await fs.mkdir(geminiDir, { recursive: true });
                    const agentsPath = path.join(geminiDir, 'AGENTS.md');
                    try {
                        await fs.access(agentsPath);
                    } catch {
                        await fs.writeFile(agentsPath, GEMINI_AGENTS_TEMPLATE, 'utf8');
                        created.push('.gemini/AGENTS.md');
                    }
                    break;
                }
                case 'antigravity': {
                    const agentsPath = path.join(targetDir, 'AGENTS.md');
                    try {
                        await fs.access(agentsPath);
                    } catch {
                        await fs.writeFile(agentsPath, GEMINI_AGENTS_TEMPLATE, 'utf8');
                        created.push('AGENTS.md');
                    }
                    break;
                }
            }
        }

        return {
            success: true,
            message: `Athena workspace initialized at ${targetDir}`,
            created
        };
    }
}

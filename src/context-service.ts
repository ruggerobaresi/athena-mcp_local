export class ContextService {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    async readMemory(memoryPath: string, projectRootOverride?: string): Promise<string | null> {
        const fs = await import('fs/promises');
        const path = await import('path');
        const root = projectRootOverride || this.projectRoot;
        const fullPath = path.join(root, '.context', memoryPath);
        const frameworkPath = path.join(root, '.framework', memoryPath);
        const protocolPath = path.join(root, '.framework', 'protocols', memoryPath);

        // Try .context first
        try {
            return await fs.readFile(fullPath, 'utf-8');
        } catch (e) {
            // Try .framework
            try {
                return await fs.readFile(frameworkPath, 'utf-8');
            } catch (e2) {
                // Try .framework/protocols (if user just passed "research_protocol.md")
                try {
                    return await fs.readFile(protocolPath, 'utf-8');
                } catch (e3) {
                    return null;
                }
            }
        }
    }
}


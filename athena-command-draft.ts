
import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { InitTool, SessionManager, QuicksaveTool, LiteGraphClient } from "athena-mcp-server/lib"
import { UI } from "../ui"
import path from "path"

export const AthenaCommand = cmd({
    command: "athena <command>",
    describe: "Manage Athena workspace and sessions",
    builder: (yargs: Argv) => {
        return yargs
            .command(
                "init",
                "Initialize a new Athena workspace",
                (yargs) => yargs.option("ide", { type: "string", choices: ["vscode", "cursor", "gemini", "antigravity"] }),
                async (argv) => {
                    const tool = new InitTool(process.cwd());
                    const result = await tool.execute({ ide: argv.ide as any });
                    if (result.success) {
                        UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Athena Workspace Initialized")
                        result.created.forEach(f => UI.println(UI.Style.TEXT_DIM + `+ ${f}`))
                    }
                }
            )
            .command(
                "start",
                "Start a new session",
                (yargs) => yargs,
                async (argv) => {
                    const db = new LiteGraphClient(process.cwd()); // This might need a real DB path/config
                    const manager = new SessionManager(db, process.cwd());
                    const result = await manager.startSession();
                    UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Session Started: ${result.sessionId}`)
                }
            )
            .command(
                "end",
                "End the current session",
                (yargs) => yargs.option("summary", { type: "string", demandOption: true }),
                async (argv) => {
                    const db = new LiteGraphClient(process.cwd());
                    const manager = new SessionManager(db, process.cwd());
                    // We need to know the session ID. The tool implies we might need to find it or pass it.
                    // For CLI convenience, maybe we find the active one?
                    // The library SessionManager.endSession REQUIRES sessionId.
                    // We might need a helper to find the active session if not provided, or strict requirement.
                    // Let's assume for now we might need to pass it or look it up.
                    // Re-checking athena-cli-tools shows it had logic to find active session? 
                    // No, finding active session was in QuickSave.
                }
            )
        // ... Add other commands
    },
    handler: async (args) => {
        // Top level handler
    },
})

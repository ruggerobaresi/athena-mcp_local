
export interface ActiveSession {
    id: string;
    userId?: string;
    projectId?: string;
    startTime: string;
    lastActivity: string;
    logPath: string;
    path: string; // Workspace root path
}

export class SessionState {
    private static instance: SessionState;
    private activeSessions: Map<string, ActiveSession> = new Map();

    private constructor() { }

    static getInstance(): SessionState {
        if (!SessionState.instance) {
            SessionState.instance = new SessionState();
        }
        return SessionState.instance;
    }

    setActiveSession(session: ActiveSession): void {
        this.activeSessions.set(session.id, session);
    }

    getActiveSession(sessionId?: string): ActiveSession | null {
        if (sessionId) {
            return this.activeSessions.get(sessionId) || null;
        }
        // Return most recent if no ID specified
        const sessions = Array.from(this.activeSessions.values());
        if (sessions.length === 0) return null;

        return sessions.sort((a, b) =>
            new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
        )[0];
    }

    updateActivity(sessionId: string): void {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date().toISOString();
        }
    }

    removeSession(sessionId: string): void {
        this.activeSessions.delete(sessionId);
    }

    listActiveSessions(): ActiveSession[] {
        return Array.from(this.activeSessions.values());
    }
}

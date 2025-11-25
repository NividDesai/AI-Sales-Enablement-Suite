import { logger } from "../../utils/logger";
import { v4 as uuidv4 } from "uuid";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  emotion?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Session {
  id: string;
  persona_id: string;
  user_id?: string;
  messages: Message[];
  context: Record<string, any>;
  created_at: string;
  last_activity: string;
  is_active: boolean;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private sessionTimeoutMs: number = 30 * 60 * 1000; // 30 minutes

  async createSession(
    personaId: string,
    userId?: string,
    initialContext?: Record<string, any>
  ): Promise<Session> {
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const session: Session = {
      id: sessionId,
      persona_id: personaId,
      user_id: userId,
      messages: [],
      context: initialContext || {},
      created_at: now,
      last_activity: now,
      is_active: true,
    };

    this.sessions.set(sessionId, session);
    logger.info("avatar:session:created", { sessionId, personaId });
    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check if expired
    const lastActivity = new Date(session.last_activity).getTime();
    const now = Date.now();
    if (now - lastActivity > this.sessionTimeoutMs) {
      logger.info("avatar:session:expired", { sessionId });
      session.is_active = false;
      return null;
    }

    // Update last activity
    session.last_activity = new Date().toISOString();
    return session;
  }

  async addMessage(sessionId: string, message: Omit<Message, "timestamp">): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    const fullMessage: Message = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    session.messages.push(fullMessage);
    session.last_activity = new Date().toISOString();

    logger.info("avatar:session:message:added", { sessionId, role: message.role });
    return true;
  }

  async getConversationHistory(sessionId: string, limit?: number): Promise<Message[]> {
    const session = await this.getSession(sessionId);
    if (!session) return [];

    let messages = session.messages;
    if (limit) {
      messages = messages.slice(-limit);
    }

    return messages;
  }

  async updateContext(sessionId: string, contextUpdates: Record<string, any>): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    session.context = { ...session.context, ...contextUpdates };
    session.last_activity = new Date().toISOString();
    return true;
  }

  async endSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.is_active = false;
    logger.info("avatar:session:ended", { sessionId });
    return true;
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const expired: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastActivity = new Date(session.last_activity).getTime();
      if (now - lastActivity > this.sessionTimeoutMs) {
        expired.push(sessionId);
      }
    }

    for (const sessionId of expired) {
      this.sessions.delete(sessionId);
    }

    if (expired.length > 0) {
      logger.info("avatar:session:cleanup", { count: expired.length });
    }
  }

  async getActiveSessionsCount(): Promise<number> {
    await this.cleanup();
    return Array.from(this.sessions.values()).filter((s) => s.is_active).length;
  }
}


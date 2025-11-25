import { logger } from "../../utils/logger";
import { config } from "../../config";
import { DocumentStore, Document } from "./documentStore";
import * as fs from "fs/promises";
import * as path from "path";

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  persona_ids: string[];
  document_count: number;
  vector_store_id?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ContextResult {
  content: string;
  metadata?: Record<string, any>;
}

export class RAGSystem {
  private knowledgeBases: Map<string, KnowledgeBase> = new Map();
  private embeddings: any = null; // Simplified - can be enhanced with actual vector DB
  private documentStore: DocumentStore;
  private kbDir: string;

  constructor() {
    this.documentStore = new DocumentStore();
    this.kbDir = path.join(process.cwd(), "data", "knowledge_bases");
  }

  async initialize(): Promise<void> {
    logger.info("avatar:rag:init");
    await fs.mkdir(this.kbDir, { recursive: true });
    await this.documentStore.initialize();
    await this.loadKnowledgeBases();
  }

  private async loadKnowledgeBases(): Promise<void> {
    try {
      const files = await fs.readdir(this.kbDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const filePath = path.join(this.kbDir, file);
            const content = await fs.readFile(filePath, "utf-8");
            const kb: KnowledgeBase = JSON.parse(content);
            this.knowledgeBases.set(kb.id, kb);
          } catch (error: any) {
            logger.error("avatar:rag:kb:load:error", { file, error: error?.message });
          }
        }
      }
    } catch (error: any) {
      logger.warn("avatar:rag:kb:load:dir:error", { error: error?.message });
    }
  }

  private async saveKnowledgeBase(kb: KnowledgeBase): Promise<void> {
    try {
      const filePath = path.join(this.kbDir, `${kb.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(kb, null, 2), "utf-8");
    } catch (error: any) {
      logger.error("avatar:rag:kb:save:error", { error: error?.message });
      throw error;
    }
  }

  async getRelevantContext(
    query: string,
    personaId: string,
    topK: number = 5
  ): Promise<ContextResult[]> {
    // Get knowledge bases for this persona
    const kbs = Array.from(this.knowledgeBases.values()).filter((kb) =>
      kb.persona_ids.includes(personaId)
    );

    if (kbs.length === 0) {
      return [];
    }

    // Search documents in all knowledge bases for this persona
    const allResults: ContextResult[] = [];
    for (const kb of kbs) {
      const docs = await this.documentStore.searchDocuments(kb.id, query, topK);
      for (const doc of docs) {
        allResults.push({
          content: doc.content,
          metadata: {
            title: doc.title,
            source: doc.source,
            kb_id: kb.id,
            kb_name: kb.name,
          },
        });
      }
    }

    // Return top K results
    return allResults.slice(0, topK);
  }

  async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    return Array.from(this.knowledgeBases.values());
  }

  async getKnowledgeBase(kbId: string): Promise<KnowledgeBase | null> {
    return this.knowledgeBases.get(kbId) || null;
  }

  async createKnowledgeBase(
    name: string,
    description?: string,
    personaIds: string[] = []
  ): Promise<KnowledgeBase> {
    const kb: KnowledgeBase = {
      id: `kb_${Date.now()}`,
      name,
      description,
      persona_ids: personaIds,
      document_count: 0,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.saveKnowledgeBase(kb);
    this.knowledgeBases.set(kb.id, kb);
    logger.info("avatar:rag:kb:created", { id: kb.id, name });
    return kb;
  }

  async updateKnowledgeBase(kbId: string, updates: Partial<KnowledgeBase>): Promise<KnowledgeBase | null> {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) return null;

    const updated: KnowledgeBase = {
      ...kb,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await this.saveKnowledgeBase(updated);
    this.knowledgeBases.set(kbId, updated);
    return updated;
  }

  async deleteKnowledgeBase(kbId: string): Promise<boolean> {
    const kb = this.knowledgeBases.get(kbId);
    if (!kb) return false;

    try {
      const filePath = path.join(this.kbDir, `${kbId}.json`);
      await fs.unlink(filePath);
    } catch (error: any) {
      logger.warn("avatar:rag:kb:delete:file:error", { error: error?.message });
    }

    // Delete all documents in this KB
    const docs = await this.documentStore.getDocumentsByKB(kbId);
    for (const doc of docs) {
      await this.documentStore.deleteDocument(doc.id);
    }

    this.knowledgeBases.delete(kbId);
    logger.info("avatar:rag:kb:deleted", { id: kbId });
    return true;
  }

  getDocumentStore(): DocumentStore {
    return this.documentStore;
  }
}


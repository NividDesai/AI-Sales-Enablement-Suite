import { logger } from "../../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";

export interface Document {
  id: string;
  kb_id: string;
  title: string;
  content: string;
  source: string;
  metadata: Record<string, any>;
  created_at: string;
}

export class DocumentStore {
  private documentsDir: string;
  private documents: Map<string, Document> = new Map();

  constructor(documentsDir: string = path.join(process.cwd(), "data", "documents")) {
    this.documentsDir = documentsDir;
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.documentsDir, { recursive: true });
      await this.loadDocuments();
      logger.info("avatar:documents:initialized", { count: this.documents.size });
    } catch (error: any) {
      logger.error("avatar:documents:init:error", { error: error?.message });
    }
  }

  private async loadDocuments(): Promise<void> {
    try {
      const files = await fs.readdir(this.documentsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const filePath = path.join(this.documentsDir, file);
            const content = await fs.readFile(filePath, "utf-8");
            const doc: Document = JSON.parse(content);
            this.documents.set(doc.id, doc);
          } catch (error: any) {
            logger.error("avatar:documents:load:error", { file, error: error?.message });
          }
        }
      }
    } catch (error: any) {
      logger.warn("avatar:documents:load:dir:error", { error: error?.message });
    }
  }

  async addDocument(
    kbId: string,
    title: string,
    content: string,
    source: string = "manual"
  ): Promise<Document> {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const doc: Document = {
      id: docId,
      kb_id: kbId,
      title,
      content,
      source,
      metadata: {},
      created_at: new Date().toISOString(),
    };

    await this.saveDocument(doc);
    this.documents.set(docId, doc);
    logger.info("avatar:documents:added", { id: docId, kbId, title });
    return doc;
  }

  async getDocumentsByKB(kbId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter((doc) => doc.kb_id === kbId);
  }

  async deleteDocument(docId: string): Promise<boolean> {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    try {
      const filePath = path.join(this.documentsDir, `${docId}.json`);
      await fs.unlink(filePath);
    } catch (error: any) {
      logger.warn("avatar:documents:delete:file:error", { error: error?.message });
    }

    this.documents.delete(docId);
    logger.info("avatar:documents:deleted", { id: docId });
    return true;
  }

  async searchDocuments(kbId: string, query: string, limit: number = 5): Promise<Document[]> {
    const kbDocs = await this.getDocumentsByKB(kbId);
    const queryLower = query.toLowerCase();

    // Simple text search - can be enhanced with vector search
    const results = kbDocs
      .filter((doc) => {
        const content = doc.content.toLowerCase();
        const title = doc.title.toLowerCase();
        return content.includes(queryLower) || title.includes(queryLower);
      })
      .slice(0, limit);

    return results;
  }

  private async saveDocument(doc: Document): Promise<void> {
    try {
      const filePath = path.join(this.documentsDir, `${doc.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(doc, null, 2), "utf-8");
    } catch (error: any) {
      logger.error("avatar:documents:save:error", { error: error?.message });
      throw error;
    }
  }
}


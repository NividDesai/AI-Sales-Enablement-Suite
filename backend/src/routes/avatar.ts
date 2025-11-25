import { Router } from "express";
import { logger } from "../utils/logger";
import { CreatePersonaRequest } from "../services/avatar/personaManager";
import * as path from "path";
import * as fs from "fs/promises";
import multer from "multer";
import {
  getPersonaManager,
  getSessionManager,
  getLLMService,
  getTTSService,
  getRAGSystem,
  getPhonemeService,
  initializeAvatarServices,
  getAvatarCache,
} from "../services/avatar/websocketHandler";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Ensure services are initialized (they should be from index.ts, but double-check)
let servicesReady = false;
async function ensureServicesReady() {
  if (servicesReady) return;
  try {
    await initializeAvatarServices();
    servicesReady = true;
  } catch (error: any) {
    logger.error("avatar:routes:init:error", { error: error?.message });
  }
}

// Auto-initialize on route load
ensureServicesReady();

// Health check
router.get("/health", async (_req, res) => {
  await ensureServicesReady();
  res.json({ status: "healthy", initialized: servicesReady });
});

// Persona endpoints
router.get("/personas", async (_req, res) => {
  try {
    await ensureServicesReady();
    const personaManager = getPersonaManager();
    const personas = await personaManager.listPersonas();
    res.json(personas);
  } catch (error: any) {
    logger.error("avatar:personas:list:error", { error: error?.message });
    res.status(500).json({ error: error?.message || "Failed to fetch personas" });
  }
});

router.get("/personas/:id", async (req, res) => {
  try {
    await ensureServicesReady();
    const personaManager = getPersonaManager();
    const persona = await personaManager.getPersona(req.params.id);
    if (!persona) {
      return res.status(404).json({ error: "Persona not found" });
    }
    res.json(persona);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to fetch persona" });
  }
});

router.post("/personas", async (req, res) => {
  try {
    await ensureServicesReady();
    const personaManager = getPersonaManager();
    const avatarCache = getAvatarCache();
    
    const request: CreatePersonaRequest = req.body;
    
    // If avatar_url is provided, cache it first
    if (request.avatar_url && request.avatar_url.startsWith("http")) {
      try {
        const localUrl = await avatarCache.getLocalUrl(request.avatar_url);
        request.avatar_url = localUrl;
      } catch (error: any) {
        logger.warn("avatar:personas:create:cache:error", { error: error?.message });
      }
    }
    
    const persona = await personaManager.createPersona(request);
    res.json(persona);
  } catch (error: any) {
    logger.error("avatar:personas:create:error", { error: error?.message });
    res.status(500).json({ error: error?.message || "Failed to create persona" });
  }
});

// Upload avatar file for persona
router.post("/personas/:id/avatar", upload.single("avatar"), async (req, res) => {
  try {
    await ensureServicesReady();
    const personaManager = getPersonaManager();
    const avatarCache = getAvatarCache();
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Save uploaded file temporarily and get URL
    const tempPath = path.join(process.cwd(), "data", "avatars", `temp_${Date.now()}_${req.file.originalname}`);
    await fs.writeFile(tempPath, req.file.buffer);
    
    // For now, we'll use the file path as the URL
    // In production, you might want to upload to a CDN or use a file serving endpoint
    const avatarUrl = `/api/avatar/assets/${path.basename(tempPath)}`;
    
    const persona = await personaManager.updatePersona(req.params.id, {
      avatar_url: avatarUrl,
    });
    
    if (!persona) {
      return res.status(404).json({ error: "Persona not found" });
    }
    
    res.json(persona);
  } catch (error: any) {
    logger.error("avatar:personas:avatar:upload:error", { error: error?.message });
    res.status(500).json({ error: error?.message || "Failed to upload avatar" });
  }
});

router.put("/personas/:id", async (req, res) => {
  try {
    await ensureServicesReady();
    const personaManager = getPersonaManager();
    const persona = await personaManager.updatePersona(req.params.id, req.body);
    if (!persona) {
      return res.status(404).json({ error: "Persona not found" });
    }
    res.json(persona);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update persona" });
  }
});

router.delete("/personas/:id", async (req, res) => {
  try {
    await ensureServicesReady();
    const personaManager = getPersonaManager();
    const success = await personaManager.deletePersona(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Persona not found" });
    }
    res.json({ message: "Persona deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete persona" });
  }
});

// Create persona from lead data
router.post("/personas/from-lead", async (req, res) => {
  try {
    await ensureServicesReady();
    const personaManager = getPersonaManager();
    const lead = req.body;

    const name = lead.name || "Unknown Lead";
    const title = lead.title || lead.position || "Professional";
    const company = lead.company || lead.companyDomain || "Company";
    const bio = lead.bio || lead.description || "";
    const personalitySummary = lead.personalitySummary || "";
    const strengths = Array.isArray(lead.strengths) ? lead.strengths.join(", ") : lead.strengths || "";
    const weaknesses = Array.isArray(lead.weaknesses) ? lead.weaknesses.join(", ") : lead.weaknesses || "";
    const talkingPoints = Array.isArray(lead.talkingPoints) ? lead.talkingPoints.join(" ") : lead.talkingPoints || "";

    let description = `You are ${name}, ${title} at ${company}.`;
    if (bio) description += ` ${bio}`;
    if (personalitySummary) description += `\n\nPersonality: ${personalitySummary}`;
    if (strengths) description += `\n\nStrengths: ${strengths}`;
    if (weaknesses) description += `\n\nAreas of focus: ${weaknesses}`;
    if (talkingPoints) description += `\n\nKey talking points: ${talkingPoints}`;

    const personaRequest: CreatePersonaRequest = {
      name: name,
      role: title,
      description: description,
      speaking_style: "professional, authentic, and engaging",
      avatar_id: "rpm_default",
      voice_id: "alloy",
      knowledge_base_ids: [],
      personality_traits: {
        empathy: 0.7,
        formality: 0.6,
        enthusiasm: 0.6,
        humor: 0.4,
        patience: 0.7,
        assertiveness: 0.6,
      },
    };

    const persona = await personaManager.createPersona(personaRequest);

    logger.info("avatar:persona:created-from-lead", {
      personaId: persona.id,
      leadName: name,
    });

    res.json(persona);
  } catch (error: any) {
    logger.error("avatar:persona:create-from-lead:error", { error: error?.message });
    res.status(500).json({ error: error?.message || "Failed to create persona from lead" });
  }
});

// Session endpoints
router.post("/session/create", async (req, res) => {
  try {
    await ensureServicesReady();
    const personaManager = getPersonaManager();
    const sessionManager = getSessionManager();
    const { persona_id, user_id, initial_context } = req.body;

    const persona = await personaManager.getPersona(persona_id);
    if (!persona) {
      return res.status(404).json({ error: "Persona not found" });
    }

    const session = await sessionManager.createSession(persona_id, user_id, initial_context);
    // Include persona info with avatar_url in response
    res.json({
      ...session,
      persona: {
        id: persona.id,
        name: persona.name,
        role: persona.role,
        description: persona.description,
        avatar_url: persona.avatar_url || 
          (persona.avatar_id === "nivid_tech_guy" 
            ? "https://models.readyplayer.me/691384f1bafdabd2bace9f19.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024"
            : "https://models.readyplayer.me/69134f5c786317131cefca4d.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024"),
      },
    });
  } catch (error: any) {
    logger.error("avatar:session:create:error", { error: error?.message });
    res.status(500).json({ error: error?.message || "Failed to create session" });
  }
});

router.get("/session/:id", async (req, res) => {
  try {
    await ensureServicesReady();
    const sessionManager = getSessionManager();
    const session = await sessionManager.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found or expired" });
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get session" });
  }
});

router.get("/session/:id/history", async (req, res) => {
  try {
    await ensureServicesReady();
    const sessionManager = getSessionManager();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const history = await sessionManager.getConversationHistory(req.params.id, limit);
    res.json({ messages: history });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get session history" });
  }
});

router.post("/session/:id/end", async (req, res) => {
  try {
    await ensureServicesReady();
    const sessionManager = getSessionManager();
    const success = await sessionManager.endSession(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({ message: "Session ended successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to end session" });
  }
});

// Process message endpoint (for HTTP fallback)
router.post("/session/:id/message", async (req, res) => {
  try {
    await ensureServicesReady();
    const personaManager = getPersonaManager();
    const sessionManager = getSessionManager();
    const ragSystem = getRAGSystem();
    const llmService = getLLMService();
    const ttsService = getTTSService();
    const phonemeService = getPhonemeService();

    const { message } = req.body;
    const sessionId = req.params.id;

    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const persona = await personaManager.getPersona(session.persona_id);
    if (!persona) {
      return res.status(404).json({ error: "Persona not found" });
    }

    // Add user message
    await sessionManager.addMessage(sessionId, {
      role: "user",
      content: message,
    });

    // Get context from RAG
    const context = await ragSystem.getRelevantContext(message, persona.id, 5);

    // Generate response
    const responseText = await llmService.generateResponse(message, persona, context, sessionId);

    // Detect emotion
    const emotion = llmService.detectEmotion(responseText);

    // Generate speech
    const audioData = await ttsService.generateSpeech(responseText, persona, emotion);

    // Extract phonemes
    const phonemes = await phonemeService.extractPhonemes(audioData.path);

    // Add assistant message
    await sessionManager.addMessage(sessionId, {
      role: "assistant",
      content: responseText,
      emotion: emotion,
    });

    // Get avatar URL - persona.avatar_url should already be cached/local URL from getPersona
    let avatarUrl = persona.avatar_url;
    if (!avatarUrl) {
      if (persona.avatar_id === "nivid_tech_guy") {
        avatarUrl = "https://models.readyplayer.me/691384f1bafdabd2bace9f19.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024";
      } else if (persona.avatar_id === "shreya" || persona.id === "shreya" || persona.name?.toLowerCase() === "shreya") {
        avatarUrl = "https://models.readyplayer.me/69171434786317131c414282.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024";
      } else {
        avatarUrl = "https://models.readyplayer.me/69134f5c786317131cefca4d.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024";
      }
    }
    
    // Ensure avatar URL has ARKit parameters for lip sync
    // If it's a local URL without query params, add them
    if (avatarUrl.startsWith("/api/avatar/assets/") && !avatarUrl.includes("morphTargets=ARKit")) {
      avatarUrl += "?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024";
    }
    
    // If it's still a remote URL, cache it (this preserves query params)
    if (avatarUrl.startsWith("http")) {
      try {
        const avatarCache = getAvatarCache();
        const localUrl = await avatarCache.getLocalUrl(avatarUrl);
        // Update persona with cached URL for future use (preserves query params)
        persona.avatar_url = localUrl;
        avatarUrl = localUrl;
      } catch (error: any) {
        logger.warn("avatar:message:cache:error", { error: error?.message });
      }
    }

    res.json({
      text: responseText,
      audio_url: audioData.url,
      avatar_url: avatarUrl,
      phonemes: phonemes,
      emotion: emotion,
      status: "ready",
    });
  } catch (error: any) {
    logger.error("avatar:message:error", { error: error?.message });
    res.status(500).json({ error: error?.message || "Failed to process message" });
  }
});

// Avatar assets serving endpoint (for cached GLB files)
router.get("/assets/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const avatarPath = path.join(process.cwd(), "data", "avatars", filename);
    
    try {
      await fs.access(avatarPath);
      const stat = await fs.stat(avatarPath);
      
      if (stat.size === 0) {
        return res.status(404).json({ error: "Avatar file is empty" });
      }

      res.setHeader("Content-Type", "model/gltf-binary");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Length", stat.size.toString());

      const fileStream = await fs.readFile(avatarPath);
      res.send(fileStream);
    } catch (error: any) {
      // File doesn't exist, try to download it from remote URL
      logger.warn("avatar:assets:file:not:found", { filename, error: error?.message });
      
      try {
        await ensureServicesReady();
        const avatarCache = getAvatarCache();
        
        // Try to determine the remote URL from filename
        // For nivid avatar: 691384f1bafdabd2bace9f19.glb
        const remoteUrl = `https://models.readyplayer.me/${filename}?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024`;
        
        logger.info("avatar:assets:downloading:on:demand", { filename, remoteUrl });
        const localPath = await avatarCache.downloadAndCache(remoteUrl);
        
        // Verify the downloaded file
        const stat = await fs.stat(localPath);
        if (stat.size === 0) {
          throw new Error("Downloaded file is empty");
        }

        // Serve the newly downloaded file
        res.setHeader("Content-Type", "model/gltf-binary");
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Content-Length", stat.size.toString());

        const fileStream = await fs.readFile(localPath);
        res.send(fileStream);
      } catch (downloadError: any) {
        logger.error("avatar:assets:download:failed", { filename, error: downloadError?.message });
        // Return 404 with proper content type for binary requests
        res.status(404).type("application/json").json({ error: "Avatar file not found and could not be downloaded" });
      }
    }
  } catch (error: any) {
    logger.error("avatar:assets:serve:error", { error: error?.message });
    res.status(500).type("application/json").json({ error: error?.message || "Failed to serve avatar" });
  }
});

// Audio serving endpoint
router.get("/audio/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const audioPath = path.join(process.cwd(), "data", "audio", filename);
    
    try {
      await fs.access(audioPath);
      const stat = await fs.stat(audioPath);
      
      if (stat.size === 0) {
        return res.status(404).json({ error: "Audio file is empty" });
      }

      res.setHeader("Content-Type", filename.endsWith(".mp3") ? "audio/mpeg" : "audio/wav");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Length", stat.size.toString());

      const fileStream = await fs.readFile(audioPath);
      res.send(fileStream);
    } catch (error: any) {
      logger.error("avatar:audio:serve:error", { filename, error: error?.message });
      res.status(404).json({ error: "Audio file not found" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to serve audio" });
  }
});

// Knowledge base endpoints
router.get("/knowledge", async (_req, res) => {
  try {
    await ensureServicesReady();
    const ragSystem = getRAGSystem();
    const kbs = await ragSystem.listKnowledgeBases();
    res.json(kbs);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to fetch knowledge bases" });
  }
});

router.get("/knowledge/:id", async (req, res) => {
  try {
    await ensureServicesReady();
    const ragSystem = getRAGSystem();
    const kb = await ragSystem.getKnowledgeBase(req.params.id);
    if (!kb) {
      return res.status(404).json({ error: "Knowledge base not found" });
    }
    res.json(kb);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to fetch knowledge base" });
  }
});

router.post("/knowledge/create", async (req, res) => {
  try {
    await ensureServicesReady();
    const ragSystem = getRAGSystem();
    const { name, description, persona_ids } = req.body;
    const kb = await ragSystem.createKnowledgeBase(name, description, persona_ids || []);
    res.json(kb);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create knowledge base" });
  }
});

router.put("/knowledge/:id", async (req, res) => {
  try {
    await ensureServicesReady();
    const ragSystem = getRAGSystem();
    const kb = await ragSystem.updateKnowledgeBase(req.params.id, req.body);
    if (!kb) {
      return res.status(404).json({ error: "Knowledge base not found" });
    }
    res.json(kb);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update knowledge base" });
  }
});

router.delete("/knowledge/:id", async (req, res) => {
  try {
    await ensureServicesReady();
    const ragSystem = getRAGSystem();
    const success = await ragSystem.deleteKnowledgeBase(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Knowledge base not found" });
    }
    res.json({ message: "Knowledge base deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete knowledge base" });
  }
});

// Document endpoints
router.post("/knowledge/:kbId/documents", async (req, res) => {
  try {
    await ensureServicesReady();
    const ragSystem = getRAGSystem();
    const { title, content, source } = req.body;
    
    const kb = await ragSystem.getKnowledgeBase(req.params.kbId);
    if (!kb) {
      return res.status(404).json({ error: "Knowledge base not found" });
    }

    const docStore = ragSystem.getDocumentStore();
    const doc = await docStore.addDocument(req.params.kbId, title, content, source || "manual");
    
    // Update KB document count
    await ragSystem.updateKnowledgeBase(req.params.kbId, {
      document_count: kb.document_count + 1,
    });

    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to add document" });
  }
});

router.get("/knowledge/:kbId/documents", async (req, res) => {
  try {
    await ensureServicesReady();
    const ragSystem = getRAGSystem();
    const kb = await ragSystem.getKnowledgeBase(req.params.kbId);
    if (!kb) {
      return res.status(404).json({ error: "Knowledge base not found" });
    }

    const docStore = ragSystem.getDocumentStore();
    const docs = await docStore.getDocumentsByKB(req.params.kbId);
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to fetch documents" });
  }
});

router.delete("/knowledge/:kbId/documents/:docId", async (req, res) => {
  try {
    await ensureServicesReady();
    const ragSystem = getRAGSystem();
    const kb = await ragSystem.getKnowledgeBase(req.params.kbId);
    if (!kb) {
      return res.status(404).json({ error: "Knowledge base not found" });
    }

    const docStore = ragSystem.getDocumentStore();
    const success = await docStore.deleteDocument(req.params.docId);
    if (!success) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update KB document count
    await ragSystem.updateKnowledgeBase(req.params.kbId, {
      document_count: Math.max(0, kb.document_count - 1),
    });

    res.json({ message: "Document deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete document" });
  }
});

// Upload document file to knowledge base
router.post("/knowledge/:kbId/documents/upload", upload.single("file"), async (req, res) => {
  try {
    await ensureServicesReady();
    const ragSystem = getRAGSystem();
    const kb = await ragSystem.getKnowledgeBase(req.params.kbId);
    if (!kb) {
      return res.status(404).json({ error: "Knowledge base not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Extract text from file (simplified - handles text files)
    let content = "";
    if (req.file.mimetype.startsWith("text/") || req.file.originalname.endsWith(".txt") || req.file.originalname.endsWith(".md")) {
      content = req.file.buffer.toString("utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type. Please upload .txt or .md files" });
    }

    const docStore = ragSystem.getDocumentStore();
    const doc = await docStore.addDocument(req.params.kbId, req.file.originalname, content, req.file.originalname);
    
    // Update KB document count
    await ragSystem.updateKnowledgeBase(req.params.kbId, {
      document_count: kb.document_count + 1,
    });

    res.json(doc);
  } catch (error: any) {
    logger.error("avatar:knowledge:documents:upload:error", { error: error?.message });
    res.status(500).json({ error: error?.message || "Failed to upload document" });
  }
});

// Stats endpoint
router.get("/stats", async (_req, res) => {
  try {
    await ensureServicesReady();
    const personaManager = getPersonaManager();
    const sessionManager = getSessionManager();
    const ragSystem = getRAGSystem();

    const personas = await personaManager.listPersonas();
    const activeSessions = await sessionManager.getActiveSessionsCount();
    const kbs = await ragSystem.listKnowledgeBases();

    res.json({
      personas: {
        total: personas.length,
        list: personas.map((p) => ({ id: p.id, name: p.name, role: p.role })),
      },
      sessions: {
        active: activeSessions,
        total: activeSessions, // Simplified
      },
      knowledge_bases: {
        total: kbs.length,
        total_documents: kbs.reduce((sum, kb) => sum + kb.document_count, 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get stats" });
  }
});

export default router;

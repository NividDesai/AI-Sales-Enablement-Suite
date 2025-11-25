import { WebSocketServer, WebSocket as WS } from "ws";
import { logger } from "../../utils/logger";
import { PersonaManager } from "./personaManager";
import { SessionManager } from "./sessionManager";
import { LLMService } from "./llmService";
import { TTSService } from "./ttsService";
import { RAGSystem } from "./ragSystem";
import { PhonemeService } from "./phonemeService";
import { AvatarCache } from "./avatarCache";

// Global service instances (will be initialized)
let personaManager: PersonaManager;
let sessionManager: SessionManager;
let llmService: LLMService;
let ttsService: TTSService;
let ragSystem: RAGSystem;
let phonemeService: PhonemeService;
let avatarCache: AvatarCache;
let servicesInitialized = false;

// Initialize all avatar services
export async function initializeAvatarServices(): Promise<void> {
  if (servicesInitialized) {
    return;
  }

  logger.info("avatar:services:initializing");
  
  // Create service instances
  avatarCache = new AvatarCache();
  await avatarCache.initialize();
  
  personaManager = new PersonaManager(undefined, avatarCache);
  sessionManager = new SessionManager();
  ragSystem = new RAGSystem();
  await ragSystem.initialize(); // Initialize RAG system (loads KBs and documents)
  llmService = new LLMService(sessionManager);
  ttsService = new TTSService();
  phonemeService = new PhonemeService();

  // Initialize services
  try {
    await Promise.all([
      personaManager.initialize(),
      ragSystem.initialize(),
      ttsService.initialize(),
    ]);
    
    servicesInitialized = true;
    logger.info("avatar:services:initialized", {
      personas: (await personaManager.listPersonas()).length,
    });
  } catch (error: any) {
    logger.error("avatar:services:init:error", { error: error?.message });
    throw error;
  }
}

// Get service instances (for use in routes)
export function getPersonaManager(): PersonaManager {
  if (!personaManager) {
    throw new Error("Avatar services not initialized. Call initializeAvatarServices() first.");
  }
  return personaManager;
}

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    throw new Error("Avatar services not initialized. Call initializeAvatarServices() first.");
  }
  return sessionManager;
}

export function getLLMService(): LLMService {
  if (!llmService) {
    throw new Error("Avatar services not initialized. Call initializeAvatarServices() first.");
  }
  return llmService;
}

export function getTTSService(): TTSService {
  if (!ttsService) {
    throw new Error("Avatar services not initialized. Call initializeAvatarServices() first.");
  }
  return ttsService;
}

export function getRAGSystem(): RAGSystem {
  if (!ragSystem) {
    throw new Error("Avatar services not initialized. Call initializeAvatarServices() first.");
  }
  return ragSystem;
}

export function getPhonemeService(): PhonemeService {
  if (!phonemeService) {
    throw new Error("Avatar services not initialized. Call initializeAvatarServices() first.");
  }
  return phonemeService;
}

export function getAvatarCache(): AvatarCache {
  if (!avatarCache) {
    throw new Error("Avatar services not initialized. Call initializeAvatarServices() first.");
  }
  return avatarCache;
}

export function setupAvatarWebSocket(wss: WebSocketServer) {
  // Services should already be initialized, but ensure they are
  if (!servicesInitialized) {
    initializeAvatarServices().catch((error: any) => {
      logger.error("avatar:websocket:init:error", { error: error?.message });
    });
  }

  wss.on("connection", (ws: WS, req) => {
    // Extract session ID from path: /api/avatar/ws/chat/:sessionId or /ws/chat/:sessionId
    const urlPath = req.url || "";
    
    // Handle different path formats
    let sessionId = "";
    if (urlPath.includes("/api/avatar/ws/chat/")) {
      sessionId = urlPath.split("/api/avatar/ws/chat/")[1] || "";
    } else if (urlPath.includes("/ws/chat/")) {
      sessionId = urlPath.split("/ws/chat/")[1] || "";
    } else {
      // Try to get from query params as fallback
      try {
        const url = new URL(urlPath, `http://${req.headers.host}`);
        sessionId = url.searchParams.get("sessionId") || "";
      } catch {
        // If URL parsing fails, try to extract from path
        const parts = urlPath.split("/");
        sessionId = parts[parts.length - 1] || "";
      }
    }

    if (!sessionId) {
      logger.warn("avatar:websocket:no-session-id", { url: urlPath });
      ws.close(1008, "Session ID required");
      return;
    }

    logger.info("avatar:websocket:connect", { sessionId, url: urlPath });

    // Verify session exists and send confirmation
    sessionManager.getSession(sessionId).then((session) => {
      if (!session) {
        logger.warn("avatar:websocket:invalid-session", { sessionId });
        ws.close(1008, "Invalid session ID");
        return;
      }

      // Send connection confirmation
      ws.send(JSON.stringify({ type: "connected", sessionId }));
    }).catch((error) => {
      logger.error("avatar:websocket:session-check:error", { error: error?.message });
      ws.close(1011, "Session check failed");
    });

    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, sessionId, message);
      } catch (error: any) {
        logger.error("avatar:websocket:message:error", { error: error?.message });
        ws.send(JSON.stringify({ type: "error", message: error?.message || "Invalid message" }));
      }
    });

    ws.on("close", () => {
      logger.info("avatar:websocket:disconnect", { sessionId });
    });

    ws.on("error", (error) => {
      logger.error("avatar:websocket:error", { error: error?.message });
    });
  });
}

async function handleWebSocketMessage(ws: WS, sessionId: string, message: any) {
  const messageType = message.type;

  switch (messageType) {
    case "user_message": {
      const userMessage = message.message;
      await processUserMessage(ws, sessionId, userMessage);
      break;
    }

    case "ping": {
      ws.send(JSON.stringify({ type: "pong" }));
      break;
    }

    default: {
      logger.warn("avatar:websocket:unknown:type", { type: messageType });
      ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${messageType}` }));
    }
  }
}

async function processUserMessage(ws: WS, sessionId: string, userMessage: string) {
  try {
    // Ensure services are initialized
    if (!servicesInitialized) {
      await initializeAvatarServices();
    }

    // Send processing status
    ws.send(JSON.stringify({ type: "processing", message: "Processing your message..." }));

    // Get session
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      ws.send(JSON.stringify({ type: "error", message: "Session not found or expired" }));
      return;
    }

    // Get persona
    const persona = await personaManager.getPersona(session.persona_id);
    if (!persona) {
      ws.send(JSON.stringify({ type: "error", message: "Persona not found" }));
      return;
    }

    // Add user message
    await sessionManager.addMessage(sessionId, {
      role: "user",
      content: userMessage,
    });

    // Get context from RAG
    const context = await ragSystem.getRelevantContext(userMessage, persona.id, 5);

    // Generate response
    const responseText = await llmService.generateResponse(userMessage, persona, context, sessionId);

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
        const localUrl = await avatarCache.getLocalUrl(avatarUrl);
        avatarUrl = localUrl; // getLocalUrl now preserves query params
      } catch (error: any) {
        logger.warn("avatar:websocket:cache:error", { error: error?.message });
      }
    }

    // Send response
    ws.send(
      JSON.stringify({
        type: "avatar_response",
        text: responseText,
        audio_url: audioData.url,
        avatar_url: avatarUrl,
        phonemes: phonemes,
        emotion: emotion,
        status: "ready",
      })
    );

    logger.info("avatar:websocket:response:sent", { sessionId });
  } catch (error: any) {
    logger.error("avatar:websocket:process:error", { error: error?.message });
    ws.send(JSON.stringify({ type: "error", message: `Failed to process message: ${error?.message}` }));
  }
}


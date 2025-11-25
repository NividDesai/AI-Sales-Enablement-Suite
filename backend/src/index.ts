import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import leadsRouter from "./routes/leads";
import docsRouter from "./routes/docs";
import avatarRouter from "./routes/avatar";
import { config } from "./config";
import { logger } from "./utils/logger";
import { setupAvatarWebSocket, initializeAvatarServices } from "./services/avatar/websocketHandler";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Initialize avatar services on startup (before server starts)
let avatarServicesReady = false;
initializeAvatarServices()
  .then(() => {
    avatarServicesReady = true;
    logger.info("avatar:services:startup:complete");
  })
  .catch((error: any) => {
    logger.error("avatar:services:startup:error", { error: error?.message });
    // Continue startup even if avatar services fail (non-critical)
  });

app.use((req, _res, next) => {
  const start = Date.now();
  logger.info("request", { method: req.method, path: req.path, query: req.query, body: req.body });
  const resAny = (req as any).res as import("express").Response;
  resAny.on("finish", () => {
    const ms = Date.now() - start;
    logger.info("response", { method: req.method, path: req.path, status: resAny.statusCode, durationMs: ms });
  });
  next();
});

app.get("/health", (_req, res) => {
  logger.info("healthcheck");
  res.json({ ok: true });
});

app.use("/api", leadsRouter);
app.use("/api/docs", docsRouter);
app.use("/api/avatar", avatarRouter);

// Create HTTP server
const server = createServer(app);

// Setup WebSocket server for avatar chat
// Handle all WebSocket connections and route based on path
const wss = new WebSocketServer({ 
  server,
  verifyClient: (info: any) => {
    // Only allow connections to avatar chat paths
    const path = info.req.url || "";
    if (path.includes("/api/avatar/ws/chat/") || path.includes("/ws/chat/")) {
      return true;
    }
    return false;
  }
});

setupAvatarWebSocket(wss);

server.listen(config.port, () => {
  logger.info(`listening`, { port: config.port });
  logger.info("providers:keys", {
    hunter: Boolean(config.hunterApiKey),
    apollo: Boolean(config.apolloApiKey),
    openai: Boolean(config.openaiApiKey),
    budgetUsd: config.runBudgetUsd,
  });
  logger.info("avatar:status", { 
    ready: avatarServicesReady,
    note: avatarServicesReady ? "Avatar services initialized" : "Avatar services initializing..."
  });
});



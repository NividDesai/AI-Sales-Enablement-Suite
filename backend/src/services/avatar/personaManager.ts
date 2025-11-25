import { logger } from "../../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { AvatarCache } from "./avatarCache";

export interface PersonalityTraits {
  empathy: number;
  formality: number;
  enthusiasm: number;
  humor: number;
  patience: number;
  assertiveness: number;
}

export interface VoiceSettings {
  voice_id: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  description?: string;
  personality_traits: PersonalityTraits;
  speaking_style: string;
  system_prompt?: string;
  avatar_id: string;
  avatar_url?: string;
  voice_settings: VoiceSettings;
  knowledge_base_ids: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonaRequest {
  name: string;
  role: string;
  description?: string;
  personality_traits?: PersonalityTraits;
  speaking_style?: string;
  avatar_id: string;
  avatar_url?: string;
  voice_id: string;
  knowledge_base_ids?: string[];
}

export class PersonaManager {
  private personas: Map<string, Persona> = new Map();
  private personasDir: string;
  private avatarCache: AvatarCache | null = null;

  constructor(
    personasDir: string = path.join(process.cwd(), "data", "personas"),
    avatarCache?: AvatarCache
  ) {
    this.personasDir = personasDir;
    this.avatarCache = avatarCache || null;
  }

  setAvatarCache(cache: AvatarCache): void {
    this.avatarCache = cache;
  }

  async initialize(): Promise<void> {
    logger.info("avatar:persona:init");
    await this.ensureDirectory();
    await this.loadAllPersonas();

    if (this.personas.size === 0) {
      await this.createDefaultPersonas();
    }

    // Preload avatar URLs
    if (this.avatarCache) {
      const avatarUrls = Array.from(this.personas.values())
        .map((p) => p.avatar_url)
        .filter((url): url is string => Boolean(url));
      
      if (avatarUrls.length > 0) {
        await this.avatarCache.preloadAvatars(avatarUrls).catch((error: any) => {
          logger.warn("avatar:persona:preload:error", { error: error?.message });
        });
      }
    }

    logger.info("avatar:persona:loaded", { count: this.personas.size });
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.personasDir, { recursive: true });
    } catch (error: any) {
      logger.error("avatar:persona:mkdir:error", { error: error?.message });
    }
  }

  private async loadAllPersonas(): Promise<void> {
    try {
      const files = await fs.readdir(this.personasDir);
      const nameMap = new Map<string, Persona>(); // Track personas by name to deduplicate
      
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const filePath = path.join(this.personasDir, file);
            const content = await fs.readFile(filePath, "utf-8");
            const persona: Persona = JSON.parse(content);
            
            // Check for duplicates by name (case-insensitive)
            const nameKey = persona.name.toLowerCase().trim();
            const existing = nameMap.get(nameKey);
            
            if (existing) {
              // Keep the one with avatar_url or the most recent one
              const keepExisting = existing.avatar_url && !persona.avatar_url;
              const keepNew = persona.avatar_url && !existing.avatar_url;
              const keepNewer = !keepExisting && !keepNew && 
                new Date(persona.updated_at || persona.created_at) > 
                new Date(existing.updated_at || existing.created_at);
              
              if (keepNew || keepNewer) {
                // Remove old one and add new one
                this.personas.delete(existing.id);
                nameMap.set(nameKey, persona);
                this.personas.set(persona.id, persona);
                logger.info("avatar:persona:dedup:replaced", { 
                  oldId: existing.id, 
                  newId: persona.id, 
                  name: persona.name 
                });
                
                // Optionally delete the old file
                try {
                  const oldFilePath = path.join(this.personasDir, `${existing.id}.json`);
                  await fs.unlink(oldFilePath);
                  logger.info("avatar:persona:dedup:deleted", { file: `${existing.id}.json` });
                } catch (deleteError: any) {
                  logger.warn("avatar:persona:dedup:delete:error", { 
                    error: deleteError?.message 
                  });
                }
              } else {
                // Keep existing, skip this one
                logger.info("avatar:persona:dedup:skipped", { 
                  id: persona.id, 
                  name: persona.name,
                  reason: "duplicate"
                });
                
                // Optionally delete the duplicate file
                try {
                  await fs.unlink(filePath);
                  logger.info("avatar:persona:dedup:deleted", { file });
                } catch (deleteError: any) {
                  logger.warn("avatar:persona:dedup:delete:error", { 
                    error: deleteError?.message 
                  });
                }
              }
            } else {
              // New unique persona
              nameMap.set(nameKey, persona);
              this.personas.set(persona.id, persona);
              logger.info("avatar:persona:loaded", { id: persona.id, name: persona.name });
            }
          } catch (error: any) {
            logger.error("avatar:persona:load:error", { file, error: error?.message });
          }
        }
      }
    } catch (error: any) {
      logger.warn("avatar:persona:load:dir:error", { error: error?.message });
    }
  }

  async getPersona(personaId: string): Promise<Persona | null> {
    const persona = this.personas.get(personaId);
    if (!persona) return null;

    // Ensure avatar_url has ARKit parameters for lip sync
    let avatarUrl = persona.avatar_url;
    if (!avatarUrl) {
      // Fallback based on avatar_id
      if (persona.avatar_id === "nivid_tech_guy") {
        avatarUrl = "https://models.readyplayer.me/691384f1bafdabd2bace9f19.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024";
      } else if (persona.avatar_id === "shreya" || persona.id === "shreya" || persona.name?.toLowerCase() === "shreya") {
        avatarUrl = "https://models.readyplayer.me/69171434786317131c414282.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024";
      } else {
        avatarUrl = "https://models.readyplayer.me/69134f5c786317131cefca4d.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024";
      }
    } else if (!avatarUrl.includes("morphTargets=ARKit")) {
      // Add ARKit parameters if missing
      if (avatarUrl.startsWith("/api/avatar/assets/")) {
        avatarUrl += "?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024";
      } else if (avatarUrl.startsWith("http") && !avatarUrl.includes("?")) {
        avatarUrl += "?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024";
      } else if (avatarUrl.startsWith("http") && avatarUrl.includes("?")) {
        avatarUrl += "&morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024";
      }
    }

    // If avatar_url exists and cache is available, get local URL (preserves query params)
    if (avatarUrl && this.avatarCache) {
      try {
        const localUrl = await this.avatarCache.getLocalUrl(avatarUrl);
        return {
          ...persona,
          avatar_url: localUrl, // getLocalUrl now preserves query params
        };
      } catch (error: any) {
        logger.warn("avatar:persona:cache:error", {
          personaId,
          error: error?.message,
        });
        // Return persona with URL that has ARKit params
        return {
          ...persona,
          avatar_url: avatarUrl,
        };
      }
    }

    return {
      ...persona,
      avatar_url: avatarUrl,
    };
  }

  async listPersonas(): Promise<Persona[]> {
    const personas = Array.from(this.personas.values());
    
    // If cache is available, update avatar URLs to local paths
    if (this.avatarCache) {
      const updatedPersonas = await Promise.all(
        personas.map(async (persona) => {
          if (persona.avatar_url) {
            try {
              const localUrl = await this.avatarCache!.getLocalUrl(persona.avatar_url);
              return {
                ...persona,
                avatar_url: localUrl,
              };
            } catch (error: any) {
              logger.warn("avatar:persona:list:cache:error", {
                personaId: persona.id,
                error: error?.message,
              });
              return persona;
            }
          }
          return persona;
        })
      );
      return updatedPersonas;
    }

    return personas;
  }

  async createPersona(request: CreatePersonaRequest): Promise<Persona> {
    const personaId = uuidv4();
    const now = new Date().toISOString();

    const personalityTraits: PersonalityTraits = request.personality_traits || {
      empathy: 0.7,
      formality: 0.6,
      enthusiasm: 0.6,
      humor: 0.4,
      patience: 0.7,
      assertiveness: 0.6,
    };

    const systemPrompt = this.generateSystemPrompt(request, personalityTraits);

    const persona: Persona = {
      id: personaId,
      name: request.name,
      role: request.role,
      description: request.description,
      personality_traits: personalityTraits,
      speaking_style: request.speaking_style || "professional and friendly",
      system_prompt: systemPrompt,
      avatar_id: request.avatar_id,
      // Use provided avatar_url, or default based on avatar_id
      avatar_url: request.avatar_url || 
        (request.avatar_id === "nivid_tech_guy" 
          ? "https://models.readyplayer.me/691384f1bafdabd2bace9f19.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024"
          : request.avatar_id === "shreya" || request.name?.toLowerCase() === "shreya"
          ? "https://models.readyplayer.me/69171434786317131c414282.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024"
          : request.avatar_id === "rpm_default"
          ? "https://models.readyplayer.me/69134f5c786317131cefca4d.glb?morphTargets=ARKit&textureSizeLimit=1024&textureAtlas=1024"
          : undefined),
      voice_settings: {
        voice_id: request.voice_id,
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.5,
        use_speaker_boost: true,
      },
      knowledge_base_ids: request.knowledge_base_ids || [],
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    await this.savePersona(persona);
    this.personas.set(personaId, persona);

    logger.info("avatar:persona:created", { id: personaId, name: persona.name });
    return persona;
  }

  async updatePersona(personaId: string, updates: Partial<Persona>): Promise<Persona | null> {
    const persona = this.personas.get(personaId);
    if (!persona) return null;

    const updated: Persona = {
      ...persona,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await this.savePersona(updated);
    this.personas.set(personaId, updated);

    logger.info("avatar:persona:updated", { id: personaId });
    return updated;
  }

  async deletePersona(personaId: string): Promise<boolean> {
    const persona = this.personas.get(personaId);
    if (!persona) return false;

    try {
      const filePath = path.join(this.personasDir, `${personaId}.json`);
      await fs.unlink(filePath);
    } catch (error: any) {
      logger.warn("avatar:persona:delete:file:error", { error: error?.message });
    }

    this.personas.delete(personaId);
    logger.info("avatar:persona:deleted", { id: personaId });
    return true;
  }

  private async savePersona(persona: Persona): Promise<void> {
    try {
      const filePath = path.join(this.personasDir, `${persona.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(persona, null, 2), "utf-8");
    } catch (error: any) {
      logger.error("avatar:persona:save:error", { error: error?.message });
      throw error;
    }
  }

  private generateSystemPrompt(request: CreatePersonaRequest, traits: PersonalityTraits): string {
    const traitDesc = (value: number, high: string, low: string): string => {
      if (value >= 0.8) return `Very ${high}`;
      if (value >= 0.6) return `Moderately ${high}`;
      if (value >= 0.4) return "Balanced";
      if (value >= 0.2) return `Moderately ${low}`;
      return `Very ${low}`;
    };

    return `You are ${request.name}, a ${request.role}.

Your personality traits:
- Empathy: ${traitDesc(traits.empathy, "empathetic", "analytical")}
- Formality: ${traitDesc(traits.formality, "formal", "casual")}
- Enthusiasm: ${traitDesc(traits.enthusiasm, "enthusiastic", "reserved")}
- Humor: ${traitDesc(traits.humor, "humorous", "serious")}
- Patience: ${traitDesc(traits.patience, "patient", "direct")}
- Assertiveness: ${traitDesc(traits.assertiveness, "assertive", "accommodating")}

Speaking style: ${request.speaking_style || "professional and friendly"}

${request.description || ""}

Guidelines:
1. Stay in character at all times
2. Respond naturally and conversationally
3. Use your knowledge base to provide accurate information
4. Express appropriate emotions through your language
5. Be helpful and engaging
6. Keep responses concise but informative (2-4 sentences typically)`;
  }

  private async createDefaultPersonas(): Promise<void> {
    const defaults: CreatePersonaRequest[] = [
      {
        name: "Dr. Sarah Johnson",
        role: "Medical Advisor",
        description: "A compassionate medical professional with 15 years of experience",
        personality_traits: {
          empathy: 0.9,
          formality: 0.7,
          enthusiasm: 0.6,
          humor: 0.3,
          patience: 0.9,
          assertiveness: 0.5,
        },
        speaking_style: "professional, warm, and reassuring",
        avatar_id: "rpm_default",
        voice_id: "alloy",
      },
      {
        name: "Alex Chen",
        role: "Tech Support Specialist",
        description: "Friendly and knowledgeable technology expert",
        personality_traits: {
          empathy: 0.7,
          formality: 0.4,
          enthusiasm: 0.8,
          humor: 0.6,
          patience: 0.8,
          assertiveness: 0.5,
        },
        speaking_style: "casual, friendly, and clear",
        avatar_id: "rpm_default",
        voice_id: "echo",
      },
    ];

    for (const defaultPersona of defaults) {
      await this.createPersona(defaultPersona);
    }
  }
}


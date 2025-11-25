import { logger } from "../../utils/logger";
import { config } from "../../config";
import { Persona } from "./personaManager";
import { EmotionType } from "./llmService";
import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

export interface AudioData {
  id: string;
  path: string;
  url: string;
  format: string;
  emotion: string;
}

export class TTSService {
  private outputDir: string;

  constructor(outputDir: string = path.join(process.cwd(), "data", "audio")) {
    this.outputDir = outputDir;
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      logger.info("avatar:tts:init", { dir: this.outputDir });
    } catch (error: any) {
      logger.error("avatar:tts:init:error", { error: error?.message });
    }
  }

  async generateSpeech(text: string, persona: Persona, emotion: EmotionType): Promise<AudioData> {
    try {
      // Use OpenAI TTS API
      if (config.openaiApiKey) {
        return await this.generateOpenAITTS(text, persona, emotion);
      }

      // Fallback: create placeholder
      return await this.createPlaceholderAudio();
    } catch (error: any) {
      logger.error("avatar:tts:error", { error: error?.message });
      return await this.createPlaceholderAudio();
    }
  }

  private async generateOpenAITTS(
    text: string,
    persona: Persona,
    emotion: EmotionType
  ): Promise<AudioData> {
    if (!config.openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const voiceId = persona.voice_settings.voice_id || "alloy";
    const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
    const voice = validVoices.includes(voiceId) ? voiceId : "alloy";

    const audioId = uuidv4();
    const audioPath = path.join(this.outputDir, `${audioId}.mp3`);

    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: voice,
          input: text.substring(0, 4000), // Limit text length
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI TTS error: ${error}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(audioPath, Buffer.from(buffer));

      logger.info("avatar:tts:generated", { audioId, size: buffer.byteLength });

      return {
        id: audioId,
        path: audioPath,
        url: `/api/avatar/audio/${audioId}.mp3`,
        format: "mp3",
        emotion: emotion,
      };
    } catch (error: any) {
      logger.error("avatar:tts:openai:error", { error: error?.message });
      throw error;
    }
  }

  private async createPlaceholderAudio(): Promise<AudioData> {
    // Create a minimal silent audio file
    const audioId = uuidv4();
    const audioPath = path.join(this.outputDir, `${audioId}.mp3`);

    // For now, return a placeholder - in production, generate actual silent audio
    logger.warn("avatar:tts:placeholder", { audioId });

    return {
      id: audioId,
      path: audioPath,
      url: `/api/avatar/audio/${audioId}.mp3`,
      format: "mp3",
      emotion: "neutral",
    };
  }
}


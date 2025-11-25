import { logger } from "../../utils/logger";
import { config } from "../../config";
import { Persona } from "./personaManager";
import { SessionManager, Message } from "./sessionManager";

export type EmotionType = "neutral" | "happy" | "sad" | "excited" | "concerned" | "thoughtful" | "empathetic" | "confident";

export class LLMService {
  private sessionManager: SessionManager;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  async generateResponse(
    userMessage: string,
    persona: Persona,
    context: Array<{ content: string; metadata?: Record<string, any> }>,
    sessionId: string
  ): Promise<string> {
    try {
      const contextText = this.formatContext(context);
      const history = await this.sessionManager.getConversationHistory(sessionId, 10);
      const messages = this.buildMessages(persona, contextText, history, userMessage);

      const response = await this.callOpenAI(messages);
      logger.info("avatar:llm:response:generated", { sessionId });
      return response;
    } catch (error: any) {
      logger.error("avatar:llm:error", { error: error?.message });
      throw error;
    }
  }

  private async callOpenAI(messages: Array<{ role: string; content: string }>): Promise<string> {
    if (!config.openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  }

  private buildMessages(
    persona: Persona,
    contextText: string,
    history: Message[],
    userMessage: string
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    let systemPrompt = persona.system_prompt || "";
    if (contextText) {
      systemPrompt += `\n\nRelevant information from knowledge base:\n${contextText}`;
    }

    messages.push({
      role: "system",
      content: systemPrompt,
    });

    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    messages.push({
      role: "user",
      content: userMessage,
    });

    return messages;
  }

  private formatContext(context: Array<{ content: string; metadata?: Record<string, any> }>): string {
    if (!context || context.length === 0) return "";

    return context
      .map((ctx, i) => {
        let text = `[${i + 1}] ${ctx.content}`;
        if (ctx.metadata?.source) {
          text += `\n   Source: ${ctx.metadata.source}`;
        }
        return text;
      })
      .join("\n\n");
  }

  detectEmotion(text: string): EmotionType {
    const textLower = text.toLowerCase();

    if (/\b(sorry|unfortunately|concern|worry)\b/.test(textLower)) {
      return "concerned";
    } else if (/\b(great|excellent|wonderful|fantastic|!)\b/.test(textLower)) {
      return "excited";
    } else if (/\b(understand|feel|empathize)\b/.test(textLower)) {
      return "empathetic";
    } else if (/\b(think|consider|perhaps|maybe)\b/.test(textLower)) {
      return "thoughtful";
    } else if (/\b(happy|glad|pleased|:\))\b/.test(textLower)) {
      return "happy";
    } else if (/\b(definitely|certainly|absolutely)\b/.test(textLower)) {
      return "confident";
    }

    return "neutral";
  }
}


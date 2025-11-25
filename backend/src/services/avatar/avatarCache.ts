import { logger } from "../../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";

export class AvatarCache {
  private cacheDir: string;
  private cache: Map<string, string> = new Map(); // URL -> local path mapping

  constructor(cacheDir: string = path.join(process.cwd(), "data", "avatars")) {
    this.cacheDir = cacheDir;
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadCacheIndex();
      logger.info("avatar:cache:initialized", { dir: this.cacheDir });
    } catch (error: any) {
      logger.error("avatar:cache:init:error", { error: error?.message });
    }
  }

  private async loadCacheIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.cacheDir, "index.json");
      try {
        const content = await fs.readFile(indexPath, "utf-8");
        const index = JSON.parse(content);
        this.cache = new Map(Object.entries(index));
        logger.info("avatar:cache:index:loaded", { count: this.cache.size });
      } catch {
        // Index doesn't exist yet, that's okay
        this.cache = new Map();
      }
    } catch (error: any) {
      logger.warn("avatar:cache:index:load:error", { error: error?.message });
    }
  }

  private async saveCacheIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.cacheDir, "index.json");
      const index = Object.fromEntries(this.cache);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");
    } catch (error: any) {
      logger.error("avatar:cache:index:save:error", { error: error?.message });
    }
  }

  private getCacheKey(url: string): string {
    // Create a safe filename from URL
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      const filename = pathParts[pathParts.length - 1] || "avatar.glb";
      // Extract model ID if available
      const modelIdMatch = url.match(/\/([a-f0-9]+)\.glb/);
      if (modelIdMatch) {
        return `${modelIdMatch[1]}.glb`;
      }
      return filename;
    } catch {
      // Fallback to hash of URL
      return `avatar_${this.hashString(url)}.glb`;
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  async getCachedPath(url: string): Promise<string | null> {
    // Check if already cached
    if (this.cache.has(url)) {
      const localPath = this.cache.get(url)!;
      try {
        // Verify file exists
        await fs.access(localPath);
        return localPath;
      } catch {
        // File doesn't exist, remove from cache
        this.cache.delete(url);
        await this.saveCacheIndex();
      }
    }
    return null;
  }

  async downloadAndCache(url: string): Promise<string> {
    // Check if already cached
    const cached = await this.getCachedPath(url);
    if (cached) {
      logger.info("avatar:cache:using:cached", { url: url.substring(0, 50), path: cached });
      return cached;
    }

    logger.info("avatar:cache:downloading", { url: url.substring(0, 50) });

    try {
      const filename = this.getCacheKey(url);
      const localPath = path.join(this.cacheDir, filename);

      // Download the file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download avatar: ${response.status} ${response.statusText}`);
      }

      // Download and save the file
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(localPath, buffer);

      // Verify file was written
      const stats = await fs.stat(localPath);
      if (stats.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      // Add to cache
      this.cache.set(url, localPath);
      await this.saveCacheIndex();

      logger.info("avatar:cache:downloaded", {
        url: url.substring(0, 50),
        path: localPath,
        size: stats.size,
      });

      return localPath;
    } catch (error: any) {
      logger.error("avatar:cache:download:error", {
        url: url.substring(0, 50),
        error: error?.message,
      });
      throw error;
    }
  }

  async getLocalUrl(url: string): Promise<string> {
    const localPath = await this.downloadAndCache(url);
    // Return a path relative to the data directory for serving
    const relativePath = path.relative(path.join(process.cwd(), "data"), localPath);
    const filename = path.basename(localPath);
    
    // Preserve query parameters from original URL (especially morphTargets=ARKit for lip sync)
    try {
      const urlObj = new URL(url);
      const queryString = urlObj.search;
      // If original URL had morphTargets=ARKit, preserve it
      if (queryString && queryString.includes('morphTargets=ARKit')) {
        return `/api/avatar/assets/${filename}${queryString}`;
      }
    } catch {
      // URL parsing failed, just return filename
    }
    
    return `/api/avatar/assets/${filename}`;
  }

  async preloadAvatars(urls: string[]): Promise<void> {
    logger.info("avatar:cache:preload:start", { count: urls.length });
    const results = await Promise.allSettled(
      urls.map((url) => this.downloadAndCache(url))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    logger.info("avatar:cache:preload:complete", { successful, failed });
  }

  async clearCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith(".glb") || file === "index.json") {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }
      this.cache.clear();
      await this.saveCacheIndex();
      logger.info("avatar:cache:cleared");
    } catch (error: any) {
      logger.error("avatar:cache:clear:error", { error: error?.message });
    }
  }
}


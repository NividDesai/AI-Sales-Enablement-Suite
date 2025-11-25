import { config } from "../config";
import fetch from "node-fetch";

export async function fetchFrameImage(fileKey: string, nodeId: string, format: "png"|"pdf" = "png", scale = 2): Promise<Buffer> {
  if (!config.figmaToken) throw new Error("FIGMA_TOKEN missing");
  const u = new URL(`https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}`);
  u.searchParams.set("ids", nodeId);
  u.searchParams.set("format", format);
  if (format === "png") u.searchParams.set("scale", String(scale));
  const r = await fetch(u.toString(), { headers: { authorization: `Bearer ${config.figmaToken}` } as any });
  if (!r.ok) throw new Error(`figma images api http ${r.status}`);
  const j: any = await r.json();
  const url = j?.images?.[nodeId];
  if (!url) throw new Error("figma returned no image url");
  const img = await fetch(url);
  if (!img.ok) throw new Error(`cdn http ${img.status}`);
  const ab = await img.arrayBuffer();
  return Buffer.from(new Uint8Array(ab));
}

export async function fetchNodeTree(fileKey: string, nodeId: string): Promise<any> {
  if (!config.figmaToken) throw new Error("FIGMA_TOKEN missing");
  const u = new URL(`https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/nodes`);
  u.searchParams.set("ids", nodeId);
  const r = await fetch(u.toString(), { headers: { authorization: `Bearer ${config.figmaToken}` } as any });
  if (!r.ok) throw new Error(`figma nodes api http ${r.status}`);
  const j: any = await r.json();
  return j;
}

export type Slot = { name: string; x: number; y: number; width: number; height: number };
export type SlotMap = { frame: { width: number; height: number }; slots: Record<string, Slot> };

export function extractSlots(nodeTree: any, nodeId: string): SlotMap {
  // nodeTree: { nodes: { [nodeId]: { document: {...} } } }
  const entry = nodeTree?.nodes?.[nodeId];
  const root = entry?.document;
  if (!root) return { frame: { width: 1200, height: 1600 }, slots: {} };
  const frameBox = root?.absoluteBoundingBox || { width: 1200, height: 1600 };
  const slots: Record<string, Slot> = {};

  const visit = (n: any) => {
    const name: string = String(n?.name || "");
    if (/^slot:/i.test(name) && n?.absoluteBoundingBox) {
      const bb = n.absoluteBoundingBox;
      slots[name.toLowerCase()] = { name: name.toLowerCase(), x: bb.x, y: bb.y, width: bb.width, height: bb.height };
    }
    if (Array.isArray(n?.children)) n.children.forEach(visit);
  };
  visit(root);
  // Normalize coordinates relative to frame origin
  const originX = root?.absoluteBoundingBox?.x || 0;
  const originY = root?.absoluteBoundingBox?.y || 0;
  for (const k of Object.keys(slots)) {
    slots[k].x -= originX;
    slots[k].y -= originY;
  }
  return { frame: { width: frameBox.width, height: frameBox.height }, slots };
}

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import dayjs from "dayjs";
import type { ContentFile, ContentFilter, ContentPiece, ContentStatus } from "../types/index.js";
import { getContentDir } from "./config.js";

const STATUS_DIRS: Record<ContentStatus, string> = {
  draft: "drafts",
  approved: "approved",
  published: "published",
  rejected: "rejected",
};

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function listContent(status: ContentStatus, filter?: ContentFilter): ContentFile[] {
  const dir = getContentDir(STATUS_DIRS[status]);
  ensureDir(dir);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  let results: ContentFile[] = [];

  for (const file of files) {
    const filepath = path.join(dir, file);
    try {
      const content = readContent(filepath);
      results.push(content);
    } catch {
      // Skip malformed files
    }
  }

  if (filter) {
    if (filter.channel) results = results.filter((c) => c.frontmatter.channel === filter.channel);
    if (filter.type) results = results.filter((c) => c.frontmatter.type === filter.type);
    if (filter.week) results = results.filter((c) => c.frontmatter.calendar_week === filter.week);
    if (filter.tags?.length) {
      results = results.filter((c) =>
        filter.tags!.some((t) => c.frontmatter.tags.includes(t))
      );
    }
  }

  // Sort by scheduled_for date, then by created_at
  results.sort((a, b) => {
    const dateA = a.frontmatter.scheduled_for ?? a.frontmatter.created_at ?? "";
    const dateB = b.frontmatter.scheduled_for ?? b.frontmatter.created_at ?? "";
    return dateA.localeCompare(dateB);
  });

  return results;
}

export function readContent(filepath: string): ContentFile {
  const raw = fs.readFileSync(filepath, "utf-8");
  const { data, content } = matter(raw);
  return {
    frontmatter: data as ContentPiece,
    body: content.trim(),
    filepath,
  };
}

export function generateFilename(piece: Pick<ContentPiece, "scheduled_for" | "created_at" | "channel" | "title">): string {
  const date = dayjs(piece.scheduled_for ?? piece.created_at).format("YYYY-MM-DD");
  const slug = piece.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${date}-${piece.channel}-${slug}.md`;
}

export function writeContent(status: ContentStatus, piece: ContentPiece, body: string): string {
  const dir = getContentDir(STATUS_DIRS[status]);
  ensureDir(dir);

  const filename = generateFilename(piece);
  const filepath = path.join(dir, filename);

  const content = matter.stringify(body, piece as unknown as Record<string, unknown>);
  fs.writeFileSync(filepath, content, "utf-8");

  return filepath;
}

export function moveContent(filepath: string, toStatus: ContentStatus, updates?: Partial<ContentPiece>): string {
  const { frontmatter, body } = readContent(filepath);

  const updated: ContentPiece = {
    ...frontmatter,
    ...updates,
    status: toStatus,
    updated_at: dayjs().toISOString(),
  };

  const newFilepath = writeContent(toStatus, updated, body);

  // Remove the original file
  fs.unlinkSync(filepath);

  return newFilepath;
}

export function updateFrontmatter(filepath: string, updates: Partial<ContentPiece>): void {
  const { frontmatter, body } = readContent(filepath);

  const updated: ContentPiece = {
    ...frontmatter,
    ...updates,
    updated_at: dayjs().toISOString(),
  };

  const content = matter.stringify(body, updated as unknown as Record<string, unknown>);
  fs.writeFileSync(filepath, content, "utf-8");
}

export function updateBody(filepath: string, newBody: string): void {
  const { frontmatter } = readContent(filepath);

  const updated: ContentPiece = {
    ...frontmatter,
    updated_at: dayjs().toISOString(),
  };

  const content = matter.stringify(newBody, updated as unknown as Record<string, unknown>);
  fs.writeFileSync(filepath, content, "utf-8");
}

export function countByStatus(): Record<ContentStatus, number> {
  return {
    draft: listContent("draft").length,
    approved: listContent("approved").length,
    published: listContent("published").length,
    rejected: listContent("rejected").length,
  };
}

export function findContentById(id: string): ContentFile | null {
  for (const status of ["draft", "approved", "published", "rejected"] as ContentStatus[]) {
    const items = listContent(status);
    const found = items.find((c) => c.frontmatter.id === id);
    if (found) return found;
  }
  return null;
}

export function contentExists(id: string): boolean {
  return findContentById(id) !== null;
}

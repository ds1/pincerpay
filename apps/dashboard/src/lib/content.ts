import fs from "fs";
import path from "path";
import matter from "gray-matter";

const contentDir = path.join(process.cwd(), "content");

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
  section: string;
}

export interface BlogMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
}

export interface ContentItem<T> {
  meta: T;
  content: string;
}

function readMarkdownDir<T>(
  subdir: string,
  defaults: Partial<T>,
): ContentItem<T>[] {
  const dir = path.join(contentDir, subdir);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((filename) => {
      const slug = filename.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(dir, filename), "utf-8");
      const { data, content } = matter(raw);
      return {
        meta: { slug, ...defaults, ...data } as T,
        content,
      };
    });
}

export function getAllDocs(): ContentItem<DocMeta>[] {
  return readMarkdownDir<DocMeta>("docs", {
    title: "",
    description: "",
    order: 99,
    section: "General",
  }).sort((a, b) => a.meta.order - b.meta.order);
}

export function getDoc(slug: string): ContentItem<DocMeta> | undefined {
  return getAllDocs().find((d) => d.meta.slug === slug);
}

export function getAllBlogPosts(): ContentItem<BlogMeta>[] {
  return readMarkdownDir<BlogMeta>("blog", {
    title: "",
    description: "",
    date: "",
    author: "PincerPay Team",
    tags: [],
  }).sort(
    (a, b) =>
      new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime(),
  );
}

export function getBlogPost(slug: string): ContentItem<BlogMeta> | undefined {
  return getAllBlogPosts().find((p) => p.meta.slug === slug);
}

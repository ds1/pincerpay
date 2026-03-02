# Blog Post Template

The blog lives in the pincerpay repo at `apps/dashboard/content/blog/{slug}.md`.
Posts are rendered by the Next.js dashboard at `https://pincerpay.com/blog/{slug}`.

## Frontmatter Format (must match site exactly)

```yaml
---
title: "Post Title"
description: "150-160 char meta description for SEO"
date: "YYYY-MM-DD"
author: "PincerPay Team"
tags: [tag1, tag2, tag3]
---
```

**Required fields:** title, description, date, author, tags
**Slug:** derived from filename (e.g., `why-we-built-pincerpay.md` → `/blog/why-we-built-pincerpay`)

## Body Format

```markdown
# [Title]

[Opening paragraph — state thesis directly. No preamble.]

## [Section 1 Header]

[Content with code examples where relevant]

## [Section 2 Header]

[Content]

## Conclusion / What's Next

[1-2 sentences + one concrete CTA: try the demo, read docs, join Discord]
```

## Important Notes

- Do NOT include the internal marketing automation frontmatter (id, status, metrics, etc.) in the published version
- The site uses gray-matter + remark + rehype for rendering — standard markdown + GFM tables + code blocks with syntax highlighting are all supported
- Links to docs should use `https://pincerpay.com/docs/{slug}` format
- Links to other blog posts should use `https://pincerpay.com/blog/{slug}` format

## Length Guidelines

- Announcements: 500-800 words
- Tutorials: 1000-1500 words
- Deep dives: 1500-2500 words
- Opinion pieces: 800-1500 words

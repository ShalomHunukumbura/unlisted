# Blog content

## A post

Add a Markdown file to `blog/`. The file name is the URL: `blog/my-post.md` is
`/blog/my-post`.

```markdown
---
title: How to find remote jobs you can actually do from Sri Lanka
description: One or two sentences. Shown under the title, in lists and in search results.
date: 2026-10-08
category: Remote          # Report, Guide, Remote, Companies, Tech or Market
chips: ["Remote · anywhere", "Remote · APAC", "Remote · US only"]   # up to 3, drawn on the banner
draft: true               # optional: hides the post until removed
---

The post, in Markdown. `## Headings` become the "In this post" list.
```

The banner is drawn from the title, category, date and chips, so there's no
image to make. Preview at `/blog/<slug>/banner`.

## The weekly report

Each week's report publishes itself on Monday, from the numbers saved after
every sync. To add your own words above the charts, create
`reports/<the Monday the week started>.md`, e.g. `reports/2026-10-05.md`:

```markdown
Two or three paragraphs: what stood out this week, and why it matters.
```

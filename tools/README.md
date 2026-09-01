# tools

`data/` is the single source of truth. Everything between
`<!-- generated:*:start -->` markers in the HTML is produced from it, and
content outside those markers is never read or touched.

No dependencies. No `npm install`. Node 20+ and the standard library.

| | |
|---|---|
| `npm run post` | Register a post, scaffold `posts/<slug>.html` if absent. |
| `npm run build` | Render `data/` into the HTML. `-- --check` diffs without writing. |
| `npm run check` | Validate everything. Exits 1 on error. |
| `npm run site` | build then check. |
| `npm run dev` | Local server on :8080. |

## What is generated

| File | Markers |
|---|---|
| `index.html` | `intro`, `writing`, `work`, `lifts`, `socials` |
| `blogs.html` | `blog-cards`, `socials` |
| `posts/*.html` | `post-meta`, `post-nav`, `socials` |

Also generated: `feed.xml`, `sitemap.xml`, and the `?v=` hash on `style.css`.

## Rules the tooling enforces

**Nothing is typed twice.** Reading time and size come from the article body,
never from the file on disk: the build injects into those same files, so a
disk-size reading would change every run and the build would never converge.
Prev/next links are derived from the sorted manifest.

**The build is deterministic.** Dates render absolute, never relative, so the
same data always produces byte-identical HTML. That is what makes
`build --check` trustworthy as a guard against shipping stale markup.

**Markers are exact.** A missing, duplicated or out-of-order pair is an error
that writes nothing. The build never guesses a location and never inserts
markers for you.

**External posts** carry an `external` URL instead of a local file. They are
skipped by the file-existence check, the sitemap, and prev/next, and they link
out with the host named in the row.

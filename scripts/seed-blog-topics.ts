import { execSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { getSeedTopics, normalizeTopic } from "./blog-topic-seed-data"

function sqlQuote(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function run() {
  const rows = getSeedTopics()
  if (!rows.length) {
    console.log("No seed topics found.")
    return
  }

  const values = rows
    .map((topic, index) => {
      const status = topic.prePosted ? "'posted'" : "'pending'"
      const notes = topic.prePosted ? "'Already struck in source PDF.'" : "null"
      const postedAt = topic.prePosted ? "now()" : "null"
      return `(${sqlQuote(topic.title)}, ${sqlQuote(normalizeTopic(topic.title))}, 'pdf_seed', ${status}, ${index + 1}, ${notes}, ${postedAt})`
    })
    .join(",\n")

  const sql = `
insert into public.blog_topics (
  title,
  normalized_title,
  source,
  status,
  sort_order,
  notes,
  posted_at
)
values
${values}
on conflict (normalized_title) do update set
  title = excluded.title,
  source = excluded.source,
  status = excluded.status,
  sort_order = excluded.sort_order,
  notes = excluded.notes,
  posted_at = excluded.posted_at;
`

  const tempDir = mkdtempSync(join(tmpdir(), "finboom-blog-topics-"))
  const sqlFile = join(tempDir, "seed.sql")
  writeFileSync(sqlFile, sql, "utf8")

  const command = `npx supabase db query --linked --file ${JSON.stringify(sqlFile)}`
  execSync(command, { stdio: "inherit" })
  rmSync(tempDir, { recursive: true, force: true })
  console.log(`Seeded ${rows.length} topics into public.blog_topics.`)
}

run()


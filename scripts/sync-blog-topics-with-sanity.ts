import { execSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createClient } from "next-sanity"
import { normalizeTopic } from "../src/lib/blog/topic-utils"

type SanityPost = {
  title: string
}

function sqlQuote(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

async function run() {
  const client = createClient({
    projectId: "ra4szzqu",
    dataset: "production",
    apiVersion: "2024-01-01",
    useCdn: false,
  })

  const posts = await client.fetch<SanityPost[]>(
    `*[_type == "post"]{ title }`
  )

  const normalized = [...new Set(posts.map((post) => normalizeTopic(post.title)).filter(Boolean))]
  if (!normalized.length) {
    console.log("No Sanity post titles found to sync.")
    return
  }

  const inClause = normalized.map(sqlQuote).join(", ")
  const sql = `
update public.blog_topics
set
  status = 'posted',
  posted_at = coalesce(posted_at, now())
where normalized_title in (${inClause});
`

  const tempDir = mkdtempSync(join(tmpdir(), "finboom-blog-sync-"))
  const sqlFile = join(tempDir, "sync.sql")
  writeFileSync(sqlFile, sql, "utf8")

  const command = `npx supabase db query --linked --file ${JSON.stringify(sqlFile)}`
  execSync(command, { stdio: "inherit" })

  rmSync(tempDir, { recursive: true, force: true })
  console.log(`Synced posted statuses from ${normalized.length} Sanity titles.`)
}

run()


/**
 * Stamps the service worker with a unique build ID so the browser
 * detects a new version on each deploy and triggers the update flow.
 */
import { readFileSync, writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const swPath = resolve(__dirname, "../public/sw.js")

const buildId = Date.now().toString(36)
let sw = readFileSync(swPath, "utf-8")

// Replace the SW_VERSION line with the new build ID
sw = sw.replace(
  /const SW_VERSION = "[^"]*"/,
  `const SW_VERSION = "${buildId}"`
)

writeFileSync(swPath, sw, "utf-8")
console.log(`[stamp-sw] SW_VERSION → ${buildId}`)

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { generateParsedJson } from "@/lib/ai/json"
import {
  IMPORT_FIELD_LABELS,
  type ColumnMapping,
  type ImportField,
} from "@/lib/import/column-mapper"

const ALLOWED_FIELDS = Object.keys(IMPORT_FIELD_LABELS) as ImportField[]

// AI fallback for the smart importer: when client-side heuristics can't
// confidently map an unknown statement's columns, the client sends ONLY the
// header names + a few sample rows (never the full statement) and we ask the
// model to infer the column->field mapping. Sample-only by design for privacy.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { headers?: unknown; sampleRows?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const headers = Array.isArray(body.headers)
    ? body.headers.filter((h): h is string => typeof h === "string").slice(0, 40)
    : []
  if (headers.length === 0) {
    return NextResponse.json({ error: "No headers provided" }, { status: 400 })
  }

  // Keep the sample tiny - enough to infer layout, not the whole portfolio.
  const sampleRows = Array.isArray(body.sampleRows)
    ? body.sampleRows.slice(0, 5)
    : []

  const fieldList = ALLOWED_FIELDS.map((f) => `"${f}" (${IMPORT_FIELD_LABELS[f]})`).join(", ")

  const prompt = `You map spreadsheet columns from an investment/holdings statement to known fields.

Allowed target fields: ${fieldList}.
Use "none" for columns that don't fit any field. Map at most ONE column to each field (pick the best).

Return ONLY valid JSON of the form:
{ "mapping": { "<exact header text>": "<field>", ... } }

COLUMN HEADERS:
${JSON.stringify(headers)}

SAMPLE ROWS (header -> value):
${JSON.stringify(sampleRows)}`

  try {
    const parsed = await generateParsedJson<{ mapping?: Record<string, string> }>(prompt, {
      temperature: 0.1,
      maxOutputTokens: 1024,
    })

    const raw = parsed.mapping ?? {}
    const mapping: ColumnMapping = {}
    const usedFields = new Set<ImportField>()
    for (const header of headers) {
      const candidate = raw[header]
      const field = (ALLOWED_FIELDS as string[]).includes(candidate) ? (candidate as ImportField) : "none"
      // Enforce one-column-per-field even if the model duplicated.
      if (field !== "none" && usedFields.has(field)) {
        mapping[header] = "none"
      } else {
        mapping[header] = field
        if (field !== "none") usedFields.add(field)
      }
    }

    return NextResponse.json({ mapping })
  } catch (err) {
    // No AI keys / provider outage -> client falls back to heuristics.
    console.error("Import AI mapping failed:", err)
    return NextResponse.json({ mapping: null, error: "AI mapping unavailable" }, { status: 200 })
  }
}

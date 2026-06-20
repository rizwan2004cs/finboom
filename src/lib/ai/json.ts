// Shared, provider-agnostic "prompt -> parsed JSON" helper.
//
// The multi-provider fallback chain (Gemini -> Groq -> OpenAI) lives in the
// blog generation module; this re-export gives non-blog callers (e.g. the
// smart asset importer) a neutral import path without duplicating the logic.
export {
  generateParsedJson,
  type GenerateOptions,
} from "@/lib/blog/ai-generation"

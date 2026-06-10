// Local harness for the AI generation pipeline. Generates a post
// (Gemini chain -> Groq fallback) without publishing anything.
// Usage: npx -y tsx --env-file=.env.local scripts/debug-blog-gen.ts "Topic here"
import { generateBlogFromTopic } from "../src/lib/blog/ai-generation"

const topic = process.argv[2] || "How to ladder fixed deposits for steady income"

generateBlogFromTopic(topic)
  .then((post) => {
    console.log("SUCCESS")
    console.log("title:   ", post.title)
    console.log("category:", post.category)
    console.log("excerpt: ", post.excerpt)
    console.log("content: ", post.content.length, "chars,", post.content.split(/\s+/).length, "words")
  })
  .catch((err) => {
    console.error("FAILED:", err instanceof Error ? err.message : err)
    process.exit(1)
  })

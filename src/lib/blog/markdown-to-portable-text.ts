// Strip inline markdown markers so they don't render literally inside
// plain-text contexts like table cells and the key-takeaways callout.
function stripMarks(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim()
}

// A markdown table delimiter row, e.g. |---|---| or | :--- | ---: |.
function isTableSeparator(line: string): boolean {
  const t = line.trim()
  return t.includes("|") && t.includes("-") && /^[-:|\s]+$/.test(t)
}

// Split one table row into clean cell text, tolerating optional/missing
// outer pipes (LLMs often omit the trailing pipe, e.g. "| a | b").
function splitTableRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith("|")) t = t.slice(1)
  if (t.endsWith("|")) t = t.slice(0, -1)
  return t.split("|").map((cell) => stripMarks(cell))
}

export function markdownToPortableText(markdown: string) {
  const lines = markdown.split("\n")
  const blocks: Array<Record<string, unknown>> = []
  let keyCounter = 0
  let listItems: Array<Record<string, unknown>> = []

  function nextKey() {
    return `k${++keyCounter}`
  }

  function parseInline(text: string) {
    const spans: Array<Record<string, unknown>> = []
    const regex = /\*\*(.+?)\*\*|__(.+?)__|`(.+?)`/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        spans.push({ _type: "span", _key: nextKey(), text: text.slice(lastIndex, match.index), marks: [] })
      }
      if (match[1] || match[2]) {
        spans.push({ _type: "span", _key: nextKey(), text: match[1] || match[2], marks: ["strong"] })
      } else if (match[3]) {
        spans.push({ _type: "span", _key: nextKey(), text: match[3], marks: ["code"] })
      }
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      spans.push({ _type: "span", _key: nextKey(), text: text.slice(lastIndex), marks: [] })
    }

    if (spans.length === 0) {
      spans.push({ _type: "span", _key: nextKey(), text, marks: [] })
    }

    return spans
  }

  function flushList() {
    if (listItems.length > 0) {
      blocks.push(...listItems)
      listItems = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim() === "") {
      flushList()
      continue
    }

    if (line.trim() === "```mermaid") {
      flushList()
      const mermaidLines: string[] = []
      let j = i + 1
      while (j < lines.length && lines[j].trim() !== "```") {
        mermaidLines.push(lines[j])
        j++
      }
      if (mermaidLines.length > 0) {
        blocks.push({
          _type: "mermaid",
          _key: nextKey(),
          code: mermaidLines.join("\n"),
        })
      }
      i = j
      continue
    }

    // A ```keypoints fenced block becomes the brief "Key takeaways" callout.
    if (/^```\s*keypoints\s*$/i.test(line.trim())) {
      flushList()
      const items: string[] = []
      let j = i + 1
      while (j < lines.length && lines[j].trim() !== "```") {
        const raw = lines[j].trim().replace(/^[-*]\s+/, "")
        const clean = stripMarks(raw)
        if (clean) items.push(clean)
        j++
      }
      if (items.length > 0) {
        blocks.push({ _type: "callout", _key: nextKey(), style: "keypoints", items })
      }
      i = j
      continue
    }

    // Table: a run of rows that each start with "|" (the trailing "|" is
    // optional - LLMs frequently drop it). The |---|---| separator row, if
    // present, is dropped; the first remaining row becomes the header.
    if (line.trim().startsWith("|")) {
      flushList()
      const tableRows: string[][] = []
      let j = i
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        if (!isTableSeparator(lines[j])) {
          tableRows.push(splitTableRow(lines[j]))
        }
        j++
      }
      if (tableRows.length > 0) {
        blocks.push({
          _type: "table",
          _key: nextKey(),
          rows: tableRows.map((cells, rowIndex) => ({
            _type: "tableRow",
            _key: nextKey(),
            isHeader: rowIndex === 0,
            cells: cells.map((cell) => ({
              _type: "tableCell",
              _key: nextKey(),
              text: cell,
            })),
          })),
        })
      }
      i = j - 1
      continue
    }

    const imageMatch = line.match(/^!\[(.*)\]\((.+)\)$/)
    if (imageMatch) {
      flushList()
      blocks.push({
        _type: "externalImage",
        _key: nextKey(),
        url: imageMatch[2].trim(),
        alt: imageMatch[1].trim() || "",
      })
      continue
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      const style = level === 3 ? "h3" : "h2"
      blocks.push({
        _type: "block",
        _key: nextKey(),
        style,
        markDefs: [],
        children: [{ _type: "span", _key: nextKey(), text: headingMatch[2].trim(), marks: [] }],
      })
      continue
    }

    if (line.startsWith("> ")) {
      flushList()
      blocks.push({
        _type: "block",
        _key: nextKey(),
        style: "blockquote",
        markDefs: [],
        children: parseInline(line.slice(2).trim()),
      })
      continue
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)/)
    if (bulletMatch) {
      listItems.push({
        _type: "block",
        _key: nextKey(),
        style: "normal",
        listItem: "bullet",
        level: 1,
        markDefs: [],
        children: parseInline(bulletMatch[1].trim()),
      })
      continue
    }

    const numberMatch = line.match(/^\d+\.\s+(.+)/)
    if (numberMatch) {
      listItems.push({
        _type: "block",
        _key: nextKey(),
        style: "normal",
        listItem: "number",
        level: 1,
        markDefs: [],
        children: parseInline(numberMatch[1].trim()),
      })
      continue
    }

    flushList()
    blocks.push({
      _type: "block",
      _key: nextKey(),
      style: "normal",
      markDefs: [],
      children: parseInline(line.trim()),
    })
  }

  flushList()
  return blocks
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

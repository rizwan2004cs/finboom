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

    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList()
      const tableRows: string[][] = []
      let j = i
      while (j < lines.length && lines[j].trim().startsWith("|") && lines[j].trim().endsWith("|")) {
        const row = lines[j].trim().slice(1, -1).split("|").map((cell) => cell.trim())
        if (!row.every((cell) => /^[-:]+$/.test(cell))) {
          tableRows.push(row)
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

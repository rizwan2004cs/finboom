export function normalizeTopic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`~]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}


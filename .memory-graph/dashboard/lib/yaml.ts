/**
 * Simple YAML parser for memory-graph config and state files.
 * Exact port of scan.py:_parse_simple_yaml and _strip_quotes.
 */

export function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

export function parseSimpleYaml(text: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = text.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    // Skip indented lines (they're only consumed as block items)
    if (line.length > 0 && (line[0] === " " || line[0] === "\t")) {
      i++;
      continue;
    }

    // Skip lines with no colon
    if (!trimmed.includes(":")) {
      i++;
      continue;
    }

    // Split on first colon
    const colonIdx = trimmed.indexOf(":");
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    if (value === "") {
      // Open a block list
      const blockItems: string[] = [];
      let j = i + 1;

      while (j < lines.length) {
        const blockLine = lines[j];
        const blockTrimmed = blockLine.trim();

        // Check for list item: "  - item"
        const match = blockTrimmed.match(/^-\s*(.*)$/);
        if (match) {
          blockItems.push(stripQuotes(match[1]));
          j++;
          continue;
        }

        // Check for empty array marker: "  []"
        if (blockTrimmed === "[]") {
          j++;
          continue;
        }

        // Anything else stops the block
        break;
      }

      result[key] = blockItems;
      i = j;
    } else if (value.startsWith("[")) {
      // Try to parse as JSON array
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = [];
      }
      i++;
    } else {
      // Regular scalar value
      result[key] = stripQuotes(value);
      i++;
    }
  }

  return result;
}

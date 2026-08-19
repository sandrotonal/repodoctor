import chalk from "chalk";

export type RGB = [number, number, number];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function gradient(text: string, from: RGB, to: RGB): string {
  const chars = [...text];
  const last = Math.max(chars.length - 1, 1);
  return chars
    .map((char, index) => {
      const t = index / last;
      const r = Math.round(from[0] + (to[0] - from[0]) * t);
      const g = Math.round(from[1] + (to[1] - from[1]) * t);
      const b = Math.round(from[2] + (to[2] - from[2]) * t);
      return chalk.rgb(r, g, b)(char);
    })
    .join("");
}

export function visibleLength(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

export function centerText(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - visibleLength(text)) / 2));
  return " ".repeat(pad) + text;
}

export function segmentBar(ratio: number, width = 24): string {
  const filled = Math.round(clamp(ratio, 0, 1) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function wordWrap(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line.length > 0 && line.length + word.length + 1 > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = line.length > 0 ? `${line} ${word}` : word;
    }
  }
  if (line.length > 0) {
    lines.push(line);
  }
  return lines;
}
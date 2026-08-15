/**
 * Minimal ANSI SGR tokenizer for build logs.
 *
 * Supports the subset that shows up in Lagoon build output: reset, bold,
 * standard + bright foreground colors (30–37, 90–97), standard backgrounds
 * (40–47), and 256-color foregrounds (38;5;n, approximated to the nearest
 * base color). Every other escape sequence (cursor movement, erase, OSC
 * titles, …) is stripped.
 */

export interface AnsiSpan {
  text: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
}

interface SgrState {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
}

// Terminal-ish palette tuned to stay readable on both light and dark surfaces.
const FG_COLORS: Record<number, string> = {
  30: '#616e7c', // black → gray so it never vanishes on dark backgrounds
  31: '#e5484d',
  32: '#30a46c',
  33: '#b58a00',
  34: '#3b82f6',
  35: '#b558c8',
  36: '#0e9888',
  37: '#8a959f',
  90: '#78838d',
  91: '#ff6369',
  92: '#3dd68c',
  93: '#d5a021',
  94: '#60a5fa',
  95: '#d864ec',
  96: '#22b8a8',
  97: '#a5b0ba',
};

const BG_COLORS: Record<number, string> = {
  40: '#00000033',
  41: '#e5484d33',
  42: '#30a46c33',
  43: '#b58a0033',
  44: '#3b82f633',
  45: '#b558c833',
  46: '#0e988833',
  47: '#8a959f33',
};

/** Map a 256-color index to the closest base color we support. */
function xterm256ToFg(n: number): string | undefined {
  if (n >= 0 && n <= 7) return FG_COLORS[30 + n];
  if (n >= 8 && n <= 15) return FG_COLORS[90 + (n - 8)];
  // Cube/grayscale: approximate by luminance bucket into gray/white tones.
  if (n >= 232) return n < 244 ? FG_COLORS[90] : FG_COLORS[97];
  return undefined; // color cube — leave default rather than guess badly
}

function applySgr(state: SgrState, params: number[]): SgrState {
  const next = { ...state };
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (p === 0) {
      delete next.color;
      delete next.backgroundColor;
      delete next.bold;
    } else if (p === 1) {
      next.bold = true;
    } else if (p === 22) {
      delete next.bold;
    } else if (p === 39) {
      delete next.color;
    } else if (p === 49) {
      delete next.backgroundColor;
    } else if (FG_COLORS[p]) {
      next.color = FG_COLORS[p];
    } else if (BG_COLORS[p]) {
      next.backgroundColor = BG_COLORS[p];
    } else if (p === 38 && params[i + 1] === 5) {
      const color = xterm256ToFg(params[i + 2] ?? -1);
      if (color) next.color = color;
      i += 2;
    } else if (p === 48 && params[i + 1] === 5) {
      i += 2; // 256-color backgrounds: strip
    } else if ((p === 38 || p === 48) && params[i + 1] === 2) {
      i += 4; // truecolor: strip
    }
    // anything else: ignore
  }
  return next;
}

const ANSI_PATTERN = /\x1b(?:\[([0-9;]*)m|\[[0-9;?]*[A-Za-ln-z]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g;

/** Tokenize one line of log text into styled spans. */
export function tokenizeAnsiLine(line: string, initialState: SgrState = {}): {
  spans: AnsiSpan[];
  endState: SgrState;
} {
  const spans: AnsiSpan[] = [];
  let state = initialState;
  let lastIndex = 0;

  ANSI_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANSI_PATTERN.exec(line)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: line.slice(lastIndex, match.index), ...state });
    }
    if (match[1] !== undefined) {
      const params = match[1] === '' ? [0] : match[1].split(';').map((n) => parseInt(n, 10) || 0);
      state = applySgr(state, params);
    }
    // Non-SGR sequences are stripped with no state change.
    lastIndex = ANSI_PATTERN.lastIndex;
  }
  if (lastIndex < line.length) {
    spans.push({ text: line.slice(lastIndex), ...state });
  }
  return { spans, endState: state };
}

export interface AnsiLine {
  key: number;
  spans: AnsiSpan[];
}

/**
 * Tokenize a whole log into per-line spans, carrying SGR state across
 * newlines (colors in build logs frequently span many lines).
 */
export function tokenizeAnsiLog(text: string): AnsiLine[] {
  const lines = text.split('\n');
  const result: AnsiLine[] = new Array(lines.length);
  let state: SgrState = {};
  for (let i = 0; i < lines.length; i++) {
    const { spans, endState } = tokenizeAnsiLine(lines[i], state);
    result[i] = { key: i, spans };
    state = endState;
  }
  return result;
}

/** Strip all ANSI escapes (for copy-to-clipboard). */
export function stripAnsi(text: string): string {
  ANSI_PATTERN.lastIndex = 0;
  return text.replace(ANSI_PATTERN, '');
}

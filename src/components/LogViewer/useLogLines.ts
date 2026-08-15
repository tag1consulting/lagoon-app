import { useEffect, useRef, useState } from 'react';

import { AnsiLine, tokenizeAnsiLine } from '@/utils/ansi';

/** Lines tokenized per chunk before yielding back to the JS event loop. */
const CHUNK_SIZE = 2000;

interface LogLinesState {
  raw: string | null | undefined;
  lines: AnsiLine[];
  parsing: boolean;
}

/**
 * Tokenize a (possibly multi-MB) log into styled lines without blocking the
 * JS thread: work happens in CHUNK_SIZE slices scheduled with setTimeout.
 * Re-runs only when the raw string identity changes.
 */
export function useLogLines(raw: string | null | undefined): {
  lines: AnsiLine[];
  parsing: boolean;
} {
  const [state, setState] = useState<LogLinesState>({ raw, lines: [], parsing: Boolean(raw) });
  const generation = useRef(0);

  // Render-phase reset when the log text changes identity — avoids a
  // synchronous setState inside the effect below.
  if (state.raw !== raw) {
    setState({ raw, lines: [], parsing: Boolean(raw) });
  }

  useEffect(() => {
    const gen = ++generation.current;
    if (!raw) return;

    const rawLines = raw.split('\n');
    const lines: AnsiLine[] = new Array(rawLines.length);
    let index = 0;
    let sgrState: Parameters<typeof tokenizeAnsiLine>[1] = {};

    const processChunk = () => {
      if (generation.current !== gen) return; // superseded by newer log text
      const end = Math.min(index + CHUNK_SIZE, rawLines.length);
      for (; index < end; index++) {
        const { spans, endState } = tokenizeAnsiLine(rawLines[index], sgrState);
        lines[index] = { key: index, spans };
        sgrState = endState;
      }
      if (index < rawLines.length) {
        setTimeout(processChunk, 0);
      } else {
        setState({ raw, lines, parsing: false });
      }
    };
    const timer = setTimeout(processChunk, 0);

    return () => {
      clearTimeout(timer);
      generation.current = gen + 1; // invalidate in-flight chunks
    };
  }, [raw]);

  return { lines: state.lines, parsing: state.parsing };
}

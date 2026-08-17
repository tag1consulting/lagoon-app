import { stripAnsi, tokenizeAnsiLine, tokenizeAnsiLog } from '@/utils/ansi';

const ESC = '\x1b';

describe('tokenizeAnsiLine', () => {
  it('passes through plain text', () => {
    expect(tokenizeAnsiLine('hello world').spans).toEqual([{ text: 'hello world' }]);
  });

  it('colors text after an SGR sequence', () => {
    const { spans } = tokenizeAnsiLine(`${ESC}[32mok${ESC}[0m done`);
    expect(spans).toEqual([
      { text: 'ok', color: '#30a46c' },
      { text: ' done' },
    ]);
  });

  it('handles bold + color combos and 22 (bold off)', () => {
    const { spans } = tokenizeAnsiLine(`${ESC}[1;31mERROR${ESC}[22m still red`);
    expect(spans[0]).toEqual({ text: 'ERROR', color: '#e5484d', bold: true });
    expect(spans[1]).toEqual({ text: ' still red', color: '#e5484d' });
  });

  it('treats an empty SGR as reset', () => {
    const { spans } = tokenizeAnsiLine(`${ESC}[33mwarn${ESC}[mplain`);
    expect(spans).toEqual([{ text: 'warn', color: '#b58a00' }, { text: 'plain' }]);
  });

  it('maps bright and 256-color foregrounds', () => {
    expect(tokenizeAnsiLine(`${ESC}[92mgreen`).spans[0].color).toBe('#3dd68c');
    expect(tokenizeAnsiLine(`${ESC}[38;5;2mgreen`).spans[0].color).toBe('#30a46c');
    expect(tokenizeAnsiLine(`${ESC}[38;5;10mbright`).spans[0].color).toBe('#3dd68c');
  });

  it('strips truecolor sequences without corrupting following params', () => {
    const { spans } = tokenizeAnsiLine(`${ESC}[38;2;255;0;0mtext`);
    expect(spans).toEqual([{ text: 'text' }]);
  });

  it('strips cursor movement and OSC sequences', () => {
    const { spans } = tokenizeAnsiLine(`${ESC}[2K${ESC}]0;title\x07visible${ESC}[1A`);
    expect(spans).toEqual([{ text: 'visible' }]);
  });
});

describe('tokenizeAnsiLog', () => {
  it('carries color state across lines', () => {
    const lines = tokenizeAnsiLog(`${ESC}[31mline one\nline two${ESC}[0m\nline three`);
    expect(lines[0].spans[0]).toEqual({ text: 'line one', color: '#e5484d' });
    expect(lines[1].spans[0]).toEqual({ text: 'line two', color: '#e5484d' });
    expect(lines[2].spans[0]).toEqual({ text: 'line three' });
  });

  it('handles a realistic Lagoon build log snippet', () => {
    const log = [
      `${ESC}[0;33mSTEP${ESC}[0m Build`,
      `##############################################`,
      `${ESC}[0;32mSTEP Complete: 12s${ESC}[0m`,
      `podman push --tls-verify=false`,
    ].join('\n');
    const lines = tokenizeAnsiLog(log);
    expect(lines).toHaveLength(4);
    expect(lines[0].spans[0]).toEqual({ text: 'STEP', color: '#b58a00' });
    expect(lines[0].spans[1]).toEqual({ text: ' Build' });
    expect(lines[2].spans[0]).toEqual({ text: 'STEP Complete: 12s', color: '#30a46c' });
    expect(lines[3].spans[0]).toEqual({ text: 'podman push --tls-verify=false' });
  });
});

describe('stripAnsi', () => {
  it('removes every escape sequence', () => {
    expect(stripAnsi(`${ESC}[1;31mERROR${ESC}[0m ok ${ESC}[2K`)).toBe('ERROR ok ');
  });
});

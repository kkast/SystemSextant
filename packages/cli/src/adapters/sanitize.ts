import stripAnsi from 'strip-ansi';

const unsafeControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export function sanitizeTerminalText(value: string): string {
  return stripAnsi(value).replace(unsafeControlCharacters, '');
}

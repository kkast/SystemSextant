import process from 'node:process';
import clipboard from 'clipboardy';

// OSC 52 lets the terminal itself place text on the local clipboard. It is the
// only clipboard path that works over plain SSH without X11/Wayland, so it is
// the fallback when clipboardy cannot reach a display server. Terminals vary,
// but ~100 KB is the widely accepted safe ceiling before base64 blows budgets.
const OSC_52_MAX_BYTES = 100_000;

export interface Clipboard {
  write(value: string): Promise<void>;
}

export function createClipboard(
  systemClipboard: Pick<typeof clipboard, 'write'> = clipboard,
  output: NodeJS.WritableStream = process.stdout,
): Clipboard {
  return {
    async write(value: string) {
      try {
        await systemClipboard.write(value);
      } catch {
        if (Buffer.byteLength(value, 'utf8') > OSC_52_MAX_BYTES) {
          throw new Error(
            'Clipboard unavailable and content is too large for the terminal fallback. ' +
              'Copy it from the view screen instead.',
          );
        }
        const encoded = Buffer.from(value, 'utf8').toString('base64');
        output.write(`\x1b]52;c;${encoded}\x07`);
      }
    },
  };
}

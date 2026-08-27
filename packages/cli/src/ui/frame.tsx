import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

interface FrameProps {
  readonly title?: string | undefined;
  readonly subtitle?: string | undefined;
  readonly error?: string | undefined;
  readonly notice?: string | undefined;
  readonly children: ReactNode;
}

export function Frame({ title, subtitle, error, notice, children }: FrameProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyanBright">
        SystemSextant{title ? ` · ${title}` : ''}
      </Text>
      {subtitle ? <Text dimColor>{subtitle}</Text> : null}
      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}
      {notice ? (
        <Box marginTop={1}>
          <Text color="green">{notice}</Text>
        </Box>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

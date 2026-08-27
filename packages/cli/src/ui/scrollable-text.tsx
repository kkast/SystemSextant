import { Box, Text, useInput } from 'ink';
import { useMemo, useState } from 'react';

interface ScrollableTextProps {
  readonly title: string;
  readonly content: string;
  readonly onBack: () => void;
  readonly height?: number;
}

export function ScrollableText({ title, content, onBack, height = 20 }: ScrollableTextProps) {
  const lines = useMemo(() => content.split('\n'), [content]);
  const maxOffset = Math.max(0, lines.length - height);
  const [offset, setOffset] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setOffset((current) => Math.max(0, current - 1));
    } else if (key.downArrow || input === 'j') {
      setOffset((current) => Math.min(maxOffset, current + 1));
    } else if (key.pageUp) {
      setOffset((current) => Math.max(0, current - height));
    } else if (key.pageDown || input === ' ') {
      setOffset((current) => Math.min(maxOffset, current + height));
    } else if (key.escape || input === 'q') {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {title}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {lines.slice(offset, offset + height).map((line, index) => (
          <Text key={`${offset + index}-${line}`}>{line || ' '}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Lines {Math.min(offset + 1, lines.length)}–{Math.min(offset + height, lines.length)} of{' '}
          {lines.length} · ↑/↓ scroll · PgUp/PgDn · Esc back
        </Text>
      </Box>
    </Box>
  );
}

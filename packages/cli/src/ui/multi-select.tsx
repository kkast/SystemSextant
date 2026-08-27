import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { QuestionOption } from '@systemsextant/core';

interface MultiSelectProps {
  readonly options: readonly QuestionOption[];
  readonly initialValues: readonly string[];
  readonly onSubmit: (values: string[]) => void;
  readonly onCancel: () => void;
}

export function MultiSelect({ options, initialValues, onSubmit, onCancel }: MultiSelectProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selected, setSelected] = useState(() => new Set(initialValues));

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex((current) => (current >= options.length - 1 ? 0 : current + 1));
    } else if (input === ' ') {
      const option = options[selectedIndex];
      if (!option) return;
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(option.value)) next.delete(option.value);
        else next.add(option.value);
        return next;
      });
    } else if (key.return) {
      onSubmit(options.filter(({ value }) => selected.has(value)).map(({ value }) => value));
    } else if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column">
      {options.map((option, index) => {
        const focused = index === selectedIndex;
        return (
          <Text key={option.value} color={focused ? 'cyan' : 'white'} bold={focused}>
            {focused ? '›' : ' '} [{selected.has(option.value) ? 'x' : ' '}] {option.label}
          </Text>
        );
      })}
      <Box marginTop={1}>
        <Text dimColor>↑/↓ select · Space toggle · Enter confirm · Esc back</Text>
      </Box>
    </Box>
  );
}

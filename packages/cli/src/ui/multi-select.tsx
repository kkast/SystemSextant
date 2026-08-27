import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { QuestionOption } from '@systemsextant/core';

interface MultiSelectProps {
  readonly options: readonly QuestionOption[];
  readonly initialValues: readonly string[];
  readonly minimumSelections?: number;
  readonly onSubmit: (values: string[]) => void;
  readonly onCancel: () => void;
}

export function MultiSelect({
  options,
  initialValues,
  minimumSelections = 0,
  onSubmit,
  onCancel,
}: MultiSelectProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selected, setSelected] = useState(() => new Set(initialValues));
  const [error, setError] = useState<string>();

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
        setError(undefined);
        return next;
      });
    } else if (key.return) {
      const values = options.filter(({ value }) => selected.has(value)).map(({ value }) => value);
      if (values.length < minimumSelections) {
        setError(
          minimumSelections === 1
            ? 'Choose at least one option.'
            : `Choose at least ${minimumSelections} options.`,
        );
        return;
      }
      onSubmit(values);
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
      {error ? <Text color="red">{error}</Text> : null}
    </Box>
  );
}

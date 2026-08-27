import { Box, Text, useInput } from 'ink';
import { useEffect, useMemo, useState } from 'react';

export interface MenuOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly description?: string | undefined;
}

interface MenuProps<T extends string> {
  readonly options: readonly MenuOption<T>[];
  readonly onSelect: (value: T) => void;
  readonly onCancel?: (() => void) | undefined;
  readonly initialValue?: T | undefined;
  readonly help?: string | undefined;
  /** Use when each option's description is part of the information being reviewed. */
  readonly showDescriptions?: boolean | undefined;
}

export function Menu<T extends string>({
  options,
  onSelect,
  onCancel,
  initialValue,
  help,
  showDescriptions = false,
}: MenuProps<T>) {
  const optionSignature = options.map(({ value }) => value).join('\u0000');
  const initialIndex = useMemo(() => {
    const found = initialValue ? options.findIndex(({ value }) => value === initialValue) : -1;
    return found >= 0 ? found : 0;
  }, [initialValue, optionSignature]);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex, optionSignature]);

  useInput((input, key) => {
    if (options.length === 0) {
      if (key.escape) onCancel?.();
      return;
    }
    if (key.upArrow || input === 'k') {
      setSelectedIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex((current) => (current >= options.length - 1 ? 0 : current + 1));
    } else if (key.return) {
      const selected = options[selectedIndex];
      if (selected) onSelect(selected.value);
    } else if (key.escape) {
      onCancel?.();
    }
  });

  return (
    <Box flexDirection="column">
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <Box key={option.value} flexDirection="column">
            <Text color={selected ? 'cyan' : 'white'} bold={selected}>
              {selected ? '› ' : '  '}
              {option.label}
            </Text>
            {option.description && (showDescriptions || selected) ? (
              <Text dimColor> {option.description}</Text>
            ) : null}
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text dimColor>{help ?? '↑/↓ select · Enter confirm · Esc back'}</Text>
      </Box>
    </Box>
  );
}

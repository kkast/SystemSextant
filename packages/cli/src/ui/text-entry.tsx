import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

interface TextEntryProps {
  readonly initialValue?: string | undefined;
  readonly placeholder?: string | undefined;
  readonly multilineHint?: boolean | undefined;
  readonly validate?: ((value: string) => string | undefined) | undefined;
  readonly onSubmit: (value: string) => void;
  readonly onCancel: () => void;
}

export function TextEntry({
  initialValue = '',
  placeholder,
  multilineHint,
  validate,
  onSubmit,
  onCancel,
}: TextEntryProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string>();

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.return) {
      const validationError = validate?.(value);
      if (validationError) {
        setError(validationError);
      } else {
        onSubmit(value);
      }
      return;
    }
    if (key.backspace || key.delete) {
      setValue((current) => [...current].slice(0, -1).join(''));
      setError(undefined);
      return;
    }
    if (key.ctrl && input === 'u') {
      setValue('');
      setError(undefined);
      return;
    }
    if (!key.ctrl && !key.meta && input) {
      setValue((current) => `${current}${input}`);
      setError(undefined);
    }
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">› </Text>
        <Text>{value || <Text dimColor>{placeholder}</Text>}</Text>
        <Text color="cyan">▌</Text>
      </Box>
      {error ? <Text color="red">{error}</Text> : null}
      <Box marginTop={1}>
        <Text dimColor>
          {multilineHint
            ? 'Enter confirm · Esc back · keep the description concise'
            : 'Enter confirm · Esc back'}
        </Text>
      </Box>
    </Box>
  );
}

import { Text } from 'ink';
import { useState } from 'react';
import type { SessionRecord } from '@systemsextant/core';
import {
  ExportConflictError,
  exportSessionArtifacts,
  type ExportSelection,
} from '../adapters/export-artifacts.js';
import { resolveUserPath } from '../adapters/paths.js';
import { sanitizeTerminalText } from '../adapters/sanitize.js';
import { Frame } from '../ui/frame.js';
import { Menu } from '../ui/menu.js';
import { TextEntry } from '../ui/text-entry.js';

interface ExportScreenProps {
  readonly record: SessionRecord;
  readonly selection: ExportSelection;
  readonly onComplete: (message: string) => void;
  readonly onCancel: () => void;
}

type ExportStage = 'directory' | 'confirm' | 'overwrite';

export function ExportScreen({ record, selection, onComplete, onCancel }: ExportScreenProps) {
  const [stage, setStage] = useState<ExportStage>('directory');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const execute = (overwrite: boolean) => {
    setBusy(true);
    setError(undefined);
    void exportSessionArtifacts(record, selection, destination, overwrite)
      .then((paths) => onComplete(`Exported ${paths.join(', ')}`))
      .catch((reason: unknown) => {
        setBusy(false);
        if (reason instanceof ExportConflictError) {
          setError(`Existing files: ${reason.conflictingPaths.join(', ')}`);
          setStage('overwrite');
        } else {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
  };

  if (stage === 'directory') {
    return (
      <Frame title="Export artifacts" error={error}>
        <Text>Destination directory</Text>
        <TextEntry
          placeholder="/path/to/destination"
          validate={(value) => (value.trim() ? undefined : 'Enter a destination directory.')}
          onSubmit={(value) => {
            const resolved = resolveUserPath(sanitizeTerminalText(value));
            setDestination(resolved);
            setStage('confirm');
          }}
          onCancel={onCancel}
        />
      </Frame>
    );
  }

  if (busy) {
    return (
      <Frame title="Export artifacts">
        <Text>Exporting…</Text>
      </Frame>
    );
  }

  if (stage === 'overwrite') {
    return (
      <Frame title="Overwrite existing files?" error={error}>
        <Menu
          options={[
            { value: 'overwrite', label: 'Overwrite' },
            { value: 'cancel', label: 'Cancel' },
          ]}
          onSelect={(value) => {
            if (value === 'overwrite') execute(true);
            else onCancel();
          }}
          onCancel={onCancel}
        />
      </Frame>
    );
  }

  return (
    <Frame title="Confirm export" error={error}>
      <Text>{destination}</Text>
      <Menu
        options={[
          { value: 'export', label: 'Export' },
          { value: 'change', label: 'Choose another directory' },
          { value: 'cancel', label: 'Cancel' },
        ]}
        onSelect={(value) => {
          if (value === 'export') execute(false);
          else if (value === 'change') setStage('directory');
          else onCancel();
        }}
        onCancel={onCancel}
      />
    </Frame>
  );
}

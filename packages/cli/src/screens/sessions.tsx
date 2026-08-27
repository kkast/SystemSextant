import { Text } from 'ink';
import { useEffect, useState } from 'react';
import {
  backendLabels,
  frontendLabels,
  type SessionMetadataV1,
  type SessionRecord,
  type SessionRepository,
} from '@systemsextant/core';
import { Frame } from '../ui/frame.js';
import { Menu, type MenuOption } from '../ui/menu.js';

interface SessionsScreenProps {
  readonly repository: SessionRepository;
  readonly refreshKey: number;
  readonly onOpen: (record: SessionRecord) => void;
  readonly onBack: () => void;
}

export function SessionsScreen({ repository, refreshKey, onOpen, onBack }: SessionsScreenProps) {
  const [sessions, setSessions] = useState<readonly SessionMetadataV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    void repository
      .list()
      .then((items) => {
        if (active) setSessions(items);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository, refreshKey]);

  const options: MenuOption<string>[] = sessions.map((session) => ({
    value: session.id,
    label: session.title,
    description: `${frontendLabels[session.frontend]} + ${backendLabels[session.backend]} · ${new Date(session.createdAt).toLocaleString()}`,
  }));
  options.push({ value: '__back__', label: 'Back' });

  const select = (sessionId: string) => {
    if (sessionId === '__back__') {
      onBack();
      return;
    }
    setLoading(true);
    setError(undefined);
    void repository
      .get(sessionId)
      .then((record) => {
        if (!record) throw new Error('The selected session no longer exists.');
        onOpen(record);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
        setLoading(false);
      });
  };

  return (
    <Frame title="Past sessions" error={error}>
      {loading ? (
        <Text>Loading sessions…</Text>
      ) : sessions.length === 0 ? (
        <>
          <Text dimColor>No completed sessions yet.</Text>
          <Menu options={[{ value: 'back', label: 'Back' }]} onSelect={onBack} onCancel={onBack} />
        </>
      ) : (
        <Menu options={options} onSelect={select} onCancel={onBack} />
      )}
    </Frame>
  );
}

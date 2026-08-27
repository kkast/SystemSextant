import { Text } from 'ink';
import { useEffect, useState } from 'react';
import type { TemplateRecord, TemplateRepository, TemplateMetadataV1 } from '@systemsextant/core';
import { Frame } from '../ui/frame.js';
import { Menu, type MenuOption } from '../ui/menu.js';

export function TemplatesScreen({ repository, refreshKey, onOpen, onBack }: {
  readonly repository: TemplateRepository;
  readonly refreshKey: number;
  readonly onOpen: (record: TemplateRecord) => void;
  readonly onBack: () => void;
}) {
  const [templates, setTemplates] = useState<readonly TemplateMetadataV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true; setLoading(true); setError(undefined);
    void repository.list().then((items) => { if (active) setTemplates(items); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository, refreshKey]);
  const open = (id: string) => {
    if (id === '__back__') { onBack(); return; }
    void repository.get(id).then((record) => { if (!record) throw new Error('The selected template no longer exists.'); onOpen(record); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  };
  const options: MenuOption<string>[] = templates.map((template) => ({ value: template.id, label: template.title, description: template.description || 'No template description' }));
  options.push({ value: '__back__', label: 'Back' });
  return <Frame title="Templates" error={error}>{loading ? <Text>Loading templates…</Text> : templates.length === 0 ? <><Text dimColor>No templates yet. Save one from an artifact preview.</Text><Menu options={[{ value: 'back', label: 'Back' }]} onSelect={onBack} onCancel={onBack} /></> : <Menu options={options} onSelect={open} onCancel={onBack} />}</Frame>;
}

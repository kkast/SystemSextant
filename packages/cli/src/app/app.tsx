import { Text, useApp } from 'ink';
import { useRef, useState } from 'react';
import {
  ensureCompletedSession,
  formatAnswer,
  generateArtifacts,
  getQuestionSequence,
  normalizeProjectConfig,
  renderSupportedStackCatalog,
  type ArtifactBundle,
  type Clock,
  type DraftQuestionnaireAnswers,
  type IdGenerator,
  type ProjectConfig,
  type ProjectConfigV2,
  type QuestionId,
  type SessionRecord,
  type SessionRepository,
  architectureDraftFromConfig,
  isProjectConfigV2,
  prepareTemplate,
  type ArchitectureDraft,
  type TemplateRecord,
  type TemplateRepository,
} from '@systemsextant/core';
import type { ExportSelection } from '../adapters/export-artifacts.js';
import { sanitizeTerminalText } from '../adapters/sanitize.js';
import { ExportScreen } from '../screens/export.js';
import { QuestionnaireScreen } from '../screens/questionnaire.js';
import { ArchitectureBuilderScreen } from '../screens/architecture-builder.js';
import { SessionsScreen } from '../screens/sessions.js';
import { TemplatesScreen } from '../screens/templates.js';
import { Frame } from '../ui/frame.js';
import { Menu, type MenuOption } from '../ui/menu.js';
import { ScrollableText } from '../ui/scrollable-text.js';
import { TextEntry } from '../ui/text-entry.js';

type Screen =
  | 'home'
  | 'questionnaire'
  | 'architecture'
  | 'review'
  | 'preview'
  | 'sessions'
  | 'templates'
  | 'template-detail'
  | 'template-name'
  | 'template-delete'
  | 'detail'
  | 'view'
  | 'export'
  | 'delete';

interface ClipboardAdapter {
  write(value: string): Promise<void>;
}

export interface AppProps {
  readonly repository: SessionRepository;
  readonly templateRepository?: TemplateRepository;
  readonly clipboard: ClipboardAdapter;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly generatorVersion: string;
  readonly dataDirectory: string;
}

interface ViewState {
  readonly title: string;
  readonly content: string;
  readonly returnTo: 'preview' | 'detail' | 'home';
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function App({
  repository,
  templateRepository,
  clipboard,
  clock,
  generatorVersion,
  dataDirectory,
}: AppProps) {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('home');
  const [answers, setAnswers] = useState<DraftQuestionnaireAnswers>({});
  const [architectureDraft, setArchitectureDraft] = useState<ArchitectureDraft>();
  const [editQuestionId, setEditQuestionId] = useState<QuestionId>();
  const [config, setConfig] = useState<ProjectConfig>();
  const [previewArtifacts, setPreviewArtifacts] = useState<ArtifactBundle>();
  const [selectedRecord, setSelectedRecord] = useState<SessionRecord>();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRecord>();
  const [view, setView] = useState<ViewState>();
  const [exportSelection, setExportSelection] = useState<ExportSelection>('both');
  const [refreshKey, setRefreshKey] = useState(0);
  const [templateRefreshKey, setTemplateRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [templateName, setTemplateName] = useState('');
  const templateSaveInFlight = useRef(false);

  const goHome = () => {
    setError(undefined);
    setNotice(undefined);
    setScreen('home');
  };

  const startNewSession = () => {
    setAnswers({});
    setArchitectureDraft(undefined);
    setEditQuestionId(undefined);
    setConfig(undefined);
    setPreviewArtifacts(undefined);
    setSelectedRecord(undefined);
    setError(undefined);
    setNotice(undefined);
    setScreen('architecture');
  };

  const openPastSessions = () => {
    setError(undefined);
    setNotice(undefined);
    setRefreshKey((value) => value + 1);
    setScreen('sessions');
  };

  const openTemplates = () => {
    if (!templateRepository) return;
    setTemplateRefreshKey((value) => value + 1);
    setError(undefined);
    setNotice(undefined);
    setScreen('templates');
  };

  const showPreviewAndAutoSave = (nextConfig: ProjectConfig) => {
    const artifacts = generateArtifacts(nextConfig);
    setConfig(nextConfig);
    setPreviewArtifacts(artifacts);
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    setScreen('preview');
    void ensureCompletedSession(repository, nextConfig, { clock, generatorVersion })
      .then(({ record, created }) => {
        setSelectedRecord(record);
        setNotice(created ? 'Session saved automatically.' : 'Session was already saved.');
      })
      .catch((reason: unknown) => setError(`Session auto-save failed: ${errorMessage(reason)}`))
      .finally(() => setBusy(false));
  };

  const preparePreview = () => {
    try { showPreviewAndAutoSave(normalizeProjectConfig(answers as never)); }
    catch (reason) { setError(errorMessage(reason)); }
  };

  const openView = (title: string, content: string, returnTo: ViewState['returnTo']) => {
    setView({ title, content: sanitizeTerminalText(content), returnTo });
    setScreen('view');
  };

  const copyArtifact = (kind: 'prompt' | 'yaml') => {
    if (!selectedRecord) return;
    const content =
      kind === 'prompt'
        ? selectedRecord.artifacts.agentPrompt
        : selectedRecord.artifacts.projectYaml;
    setError(undefined);
    void clipboard
      .write(content)
      .then(() => setNotice(kind === 'prompt' ? 'Prompt copied.' : 'YAML copied.'))
      .catch((reason: unknown) => setError(`Clipboard unavailable: ${errorMessage(reason)}`));
  };

  const copyPreviewArtifact = (kind: 'prompt' | 'yaml') => {
    if (!previewArtifacts) return;
    const content = kind === 'prompt' ? previewArtifacts.agentPrompt : previewArtifacts.projectYaml;
    setError(undefined);
    void clipboard.write(content)
      .then(() => setNotice(kind === 'prompt' ? 'Complete prompt copied.' : 'Complete YAML copied.'))
      .catch((reason: unknown) => setError(`Clipboard unavailable: ${errorMessage(reason)}`));
  };

  if (screen === 'questionnaire') {
    const props = editQuestionId ? { editQuestionId } : {};
    return (
      <QuestionnaireScreen
        key={editQuestionId ?? 'new'}
        answers={answers}
        onAnswersChange={setAnswers}
        onReview={() => {
          setEditQuestionId(undefined);
          setError(undefined);
          setScreen('review');
        }}
        onCancel={editQuestionId ? () => setScreen('review') : goHome}
        {...props}
      />
    );
  }

  if (screen === 'architecture') {
    return (
      <ArchitectureBuilderScreen
        {...(architectureDraft ? { initialDraft: architectureDraft } : {})}
        onGenerate={(nextConfig: ProjectConfigV2, draft) => {
          setArchitectureDraft(draft);
          showPreviewAndAutoSave(nextConfig);
        }}
        onCancel={goHome}
      />
    );
  }

  if (screen === 'templates' && templateRepository) {
    return <TemplatesScreen repository={templateRepository} refreshKey={templateRefreshKey} onOpen={(record) => { setSelectedTemplate(record); setScreen('template-detail'); }} onBack={goHome} />;
  }

  if (screen === 'template-detail' && selectedTemplate && templateRepository) {
    return <Frame title={selectedTemplate.metadata.title} subtitle={selectedTemplate.metadata.description} error={error}>
      <Menu options={[{ value: 'use', label: 'Use template', shortcut: 'u' }, { value: 'delete', label: 'Delete template', shortcut: 'd' }, { value: 'back', label: 'Back' }]} onSelect={(value) => {
        if (value === 'use') {
          if (!isProjectConfigV2(selectedTemplate.config)) { setError('This legacy template cannot be edited as a multi-component template.'); return; }
          setArchitectureDraft(architectureDraftFromConfig(selectedTemplate.config)); setScreen('architecture');
        } else if (value === 'delete') setScreen('template-delete');
        else openTemplates();
      }} onCancel={openTemplates} />
    </Frame>;
  }

  if (screen === 'template-delete' && selectedTemplate && templateRepository) {
    return <Frame title="Delete template?" error={error}><Text>This permanently removes “{selectedTemplate.metadata.title}”.</Text><Menu options={[{ value: 'delete', label: 'Delete permanently' }, { value: 'cancel', label: 'Cancel' }]} onSelect={(value) => {
      if (value === 'cancel') { setScreen('template-detail'); return; }
      void templateRepository.delete(selectedTemplate.metadata.id).then(() => { setSelectedTemplate(undefined); openTemplates(); }).catch((reason: unknown) => setError(errorMessage(reason)));
    }} onCancel={() => setScreen('template-detail')} /></Frame>;
  }

  if (screen === 'template-name' && templateRepository && config && previewArtifacts) {
    return <Frame title="Save as template" error={error}>
      <Text bold>Template name</Text>
      {busy ? <Text>Saving template…</Text> : <TextEntry initialValue={templateName} placeholder={config.name} validate={(value) => {
        const clean = sanitizeTerminalText(value).trim();
        if (!clean) return 'Template name is required.';
        if (clean.length > 100) return 'Use 100 characters or fewer.';
        return undefined;
      }} onSubmit={(value) => {
        if (templateSaveInFlight.current) return;
        templateSaveInFlight.current = true;
        const title = sanitizeTerminalText(value).trim();
        setTemplateName(title);
        setBusy(true);
        setError(undefined);
        void templateRepository.list()
          .then((templates) => {
            const duplicate = templates.find((template) => template.projectConfigHash === previewArtifacts.projectConfigHash);
            if (duplicate) throw new Error(`This configuration is already saved as “${duplicate.title}”.`);
            return templateRepository.create(prepareTemplate(config, {
              id: `template-${previewArtifacts.projectConfigHash}`,
              title,
              description: config.product.summary,
              now: clock.now(),
            }));
          })
          .then(() => { setNotice(`Template “${title}” saved.`); setScreen('preview'); })
          .catch((reason: unknown) => setError(errorMessage(reason)))
          .finally(() => { templateSaveInFlight.current = false; setBusy(false); });
      }} onCancel={() => setScreen('preview')} />}
    </Frame>;
  }

  if (screen === 'review') {
    const questions = getQuestionSequence(answers);
    const options: MenuOption<string>[] = [
      ...questions.map((question) => ({
        value: `edit:${question.id}`,
        label: question.label,
        description: formatAnswer(question, answers),
      })),
      { value: 'generate', label: 'Generate and review artifacts' },
      { value: 'cancel', label: 'Cancel session' },
    ];
    return (
      <Frame title="Review answers" subtitle="Select an answer to edit it." error={error}>
        <Menu
          options={options}
          showDescriptions
          onSelect={(value) => {
            if (value === 'generate') preparePreview();
            else if (value === 'cancel') goHome();
            else {
              setEditQuestionId(value.slice('edit:'.length) as QuestionId);
              setScreen('questionnaire');
            }
          }}
          onCancel={goHome}
        />
      </Frame>
    );
  }

  if (screen === 'preview') {
    if (!previewArtifacts) {
      goHome();
      return null;
    }
    return (
      <Frame title="Review generated artifacts" error={error} notice={notice}>
        {busy ? (
          <Text>Saving session…</Text>
        ) : (
          <Menu
            options={[
              { value: 'prompt', label: 'View complete prompt' },
              { value: 'copy-prompt', label: 'Copy complete prompt', shortcut: 'c' },
              { value: 'yaml', label: 'View complete YAML' },
              { value: 'copy-yaml', label: 'Copy complete YAML' },
              ...(templateRepository && config ? [{ value: 'template', label: 'Save as template', shortcut: 't' }] : []),
              { value: 'edit', label: 'Edit answers' },
              { value: 'cancel', label: 'Back to home' },
            ]}
            onSelect={(value) => {
              if (value === 'prompt') {
                openView('AGENT_PROMPT.md', previewArtifacts.agentPrompt, 'preview');
              } else if (value === 'copy-prompt') {
                copyPreviewArtifact('prompt');
              } else if (value === 'yaml') {
                openView('project.yaml', previewArtifacts.projectYaml, 'preview');
              } else if (value === 'copy-yaml') {
                copyPreviewArtifact('yaml');
              } else if (value === 'template' && templateRepository && config) {
                setTemplateName('');
                setError(undefined);
                setScreen('template-name');
              }
              else if (value === 'edit') setScreen(isProjectConfigV2(config!) ? 'architecture' : 'review');
              else goHome();
            }}
            onCancel={() => setScreen(isProjectConfigV2(config!) ? 'architecture' : 'review')}
          />
        )}
      </Frame>
    );
  }

  if (screen === 'sessions') {
    return (
      <SessionsScreen
        repository={repository}
        refreshKey={refreshKey}
        onOpen={(record) => {
          setSelectedRecord(record);
          setError(undefined);
          setNotice(undefined);
          setScreen('detail');
        }}
        onBack={goHome}
      />
    );
  }

  if (screen === 'detail') {
    if (!selectedRecord) {
      openPastSessions();
      return null;
    }
    return (
      <Frame
        title={selectedRecord.metadata.title}
        subtitle={new Date(selectedRecord.metadata.createdAt).toLocaleString()}
        error={error}
        notice={notice}
      >
        <Menu
          options={[
            { value: 'view-prompt', label: 'View prompt' },
            { value: 'copy-prompt', label: 'Copy prompt' },
            { value: 'export-prompt', label: 'Export prompt' },
            { value: 'view-yaml', label: 'View YAML' },
            { value: 'copy-yaml', label: 'Copy YAML' },
            { value: 'export-yaml', label: 'Export YAML' },
            { value: 'export-both', label: 'Export both artifacts' },
            { value: 'delete', label: 'Delete session' },
            { value: 'back', label: 'Back to sessions' },
          ]}
          onSelect={(value) => {
            setError(undefined);
            setNotice(undefined);
            if (value === 'view-prompt') {
              openView('AGENT_PROMPT.md', selectedRecord.artifacts.agentPrompt, 'detail');
            } else if (value === 'view-yaml') {
              openView('project.yaml', selectedRecord.artifacts.projectYaml, 'detail');
            } else if (value === 'copy-prompt') copyArtifact('prompt');
            else if (value === 'copy-yaml') copyArtifact('yaml');
            else if (value.startsWith('export-')) {
              setExportSelection(
                value === 'export-prompt' ? 'prompt' : value === 'export-yaml' ? 'yaml' : 'both',
              );
              setScreen('export');
            } else if (value === 'delete') setScreen('delete');
            else openPastSessions();
          }}
          onCancel={openPastSessions}
        />
      </Frame>
    );
  }

  if (screen === 'view' && view) {
    return (
      <Frame>
        <ScrollableText
          title={view.title}
          content={view.content}
          onBack={() => setScreen(view.returnTo)}
        />
      </Frame>
    );
  }

  if (screen === 'export' && selectedRecord) {
    return (
      <ExportScreen
        record={selectedRecord}
        selection={exportSelection}
        onComplete={(message) => {
          setNotice(message);
          setError(undefined);
          setScreen('detail');
        }}
        onCancel={() => setScreen('detail')}
      />
    );
  }

  if (screen === 'delete' && selectedRecord) {
    return (
      <Frame title="Delete session?" error={error}>
        <Text>This permanently removes “{selectedRecord.metadata.title}” from local sessions.</Text>
        {busy ? (
          <Text>Deleting…</Text>
        ) : (
          <Menu
            options={[
              { value: 'delete', label: 'Delete permanently' },
              { value: 'cancel', label: 'Cancel' },
            ]}
            onSelect={(value) => {
              if (value === 'cancel') {
                setScreen('detail');
                return;
              }
              setBusy(true);
              void repository
                .delete(selectedRecord.metadata.id)
                .then(() => {
                  setSelectedRecord(undefined);
                  openPastSessions();
                })
                .catch((reason: unknown) => setError(errorMessage(reason)))
                .finally(() => setBusy(false));
            }}
            onCancel={() => setScreen('detail')}
          />
        )}
      </Frame>
    );
  }

  return (
    <Frame subtitle={`Sessions: ${dataDirectory}`} error={error} notice={notice}>
      <Menu
        options={[
          { value: 'new', label: 'New session', shortcut: 'n' },
          { value: 'past', label: 'Past sessions', shortcut: 's' },
          ...(templateRepository ? [{ value: 'templates', label: 'Templates', shortcut: 't' }] : []),
          {
            value: 'catalog',
            label: 'Supported stacks and tools',
            description: 'Browse every selectable stack option and current tool mapping.',
          },
          { value: 'exit', label: 'Exit', shortcut: 'q' },
        ]}
        onSelect={(value) => {
          if (value === 'new') startNewSession();
          else if (value === 'past') openPastSessions();
          else if (value === 'templates') openTemplates();
          else if (value === 'catalog')
            openView('Supported stacks and tools', renderSupportedStackCatalog(), 'home');
          else exit();
        }}
      />
    </Frame>
  );
}

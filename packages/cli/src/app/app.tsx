import { Text, useApp } from 'ink';
import { useState } from 'react';
import {
  createCompletedSession,
  formatAnswer,
  generateArtifacts,
  getQuestionSequence,
  normalizeProjectConfig,
  renderSupportedStackCatalog,
  type ArtifactBundle,
  type Clock,
  type DraftQuestionnaireAnswers,
  type IdGenerator,
  type ProjectConfigV1,
  type QuestionId,
  type SessionRecord,
  type SessionRepository,
} from '@systemsextant/core';
import type { ExportSelection } from '../adapters/export-artifacts.js';
import { sanitizeTerminalText } from '../adapters/sanitize.js';
import { ExportScreen } from '../screens/export.js';
import { QuestionnaireScreen } from '../screens/questionnaire.js';
import { SessionsScreen } from '../screens/sessions.js';
import { Frame } from '../ui/frame.js';
import { Menu, type MenuOption } from '../ui/menu.js';
import { ScrollableText } from '../ui/scrollable-text.js';

type Screen =
  | 'home'
  | 'questionnaire'
  | 'review'
  | 'preview'
  | 'sessions'
  | 'detail'
  | 'view'
  | 'export'
  | 'delete';

interface ClipboardAdapter {
  write(value: string): Promise<void>;
}

export interface AppProps {
  readonly repository: SessionRepository;
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
  clipboard,
  clock,
  ids,
  generatorVersion,
  dataDirectory,
}: AppProps) {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('home');
  const [answers, setAnswers] = useState<DraftQuestionnaireAnswers>({});
  const [editQuestionId, setEditQuestionId] = useState<QuestionId>();
  const [config, setConfig] = useState<ProjectConfigV1>();
  const [previewArtifacts, setPreviewArtifacts] = useState<ArtifactBundle>();
  const [selectedRecord, setSelectedRecord] = useState<SessionRecord>();
  const [view, setView] = useState<ViewState>();
  const [exportSelection, setExportSelection] = useState<ExportSelection>('both');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const goHome = () => {
    setError(undefined);
    setNotice(undefined);
    setScreen('home');
  };

  const startNewSession = () => {
    setAnswers({});
    setEditQuestionId(undefined);
    setConfig(undefined);
    setPreviewArtifacts(undefined);
    setSelectedRecord(undefined);
    setError(undefined);
    setNotice(undefined);
    setScreen('questionnaire');
  };

  const openPastSessions = () => {
    setError(undefined);
    setNotice(undefined);
    setRefreshKey((value) => value + 1);
    setScreen('sessions');
  };

  const preparePreview = () => {
    try {
      const normalized = normalizeProjectConfig(answers as never);
      setConfig(normalized);
      setPreviewArtifacts(generateArtifacts(normalized));
      setError(undefined);
      setScreen('preview');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const persistPreview = () => {
    if (!config) return;
    setBusy(true);
    setError(undefined);
    void createCompletedSession(repository, config, { clock, ids, generatorVersion })
      .then((record) => {
        setSelectedRecord(record);
        setNotice('Session saved.');
        setScreen('detail');
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setBusy(false));
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
      <Frame title="Review generated artifacts" error={error}>
        {busy ? (
          <Text>Saving session…</Text>
        ) : (
          <Menu
            options={[
              { value: 'prompt', label: 'View complete prompt' },
              { value: 'yaml', label: 'View complete YAML' },
              { value: 'save', label: 'Save session' },
              { value: 'edit', label: 'Edit answers' },
              { value: 'cancel', label: 'Cancel session' },
            ]}
            onSelect={(value) => {
              if (value === 'prompt') {
                openView('AGENT_PROMPT.md', previewArtifacts.agentPrompt, 'preview');
              } else if (value === 'yaml') {
                openView('project.yaml', previewArtifacts.projectYaml, 'preview');
              } else if (value === 'save') persistPreview();
              else if (value === 'edit') setScreen('review');
              else goHome();
            }}
            onCancel={() => setScreen('review')}
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
          { value: 'new', label: 'New session' },
          { value: 'past', label: 'Past sessions' },
          {
            value: 'catalog',
            label: 'Supported stacks and tools',
            description: 'Browse every selectable stack option and current tool mapping.',
          },
          { value: 'exit', label: 'Exit' },
        ]}
        onSelect={(value) => {
          if (value === 'new') startNewSession();
          else if (value === 'past') openPastSessions();
          else if (value === 'catalog')
            openView('Supported stacks and tools', renderSupportedStackCatalog(), 'home');
          else exit();
        }}
      />
    </Frame>
  );
}

import { Text } from 'ink';
import { useMemo, useState } from 'react';
import {
  getQuestionSequence,
  type DraftQuestionnaireAnswers,
  type Question,
  type QuestionId,
} from '@systemsextant/core';
import { sanitizeTerminalText } from '../adapters/sanitize.js';
import { Frame } from '../ui/frame.js';
import { Menu } from '../ui/menu.js';
import { MultiSelect } from '../ui/multi-select.js';
import { TextEntry } from '../ui/text-entry.js';

interface QuestionnaireScreenProps {
  readonly answers: DraftQuestionnaireAnswers;
  readonly editQuestionId?: QuestionId;
  readonly onAnswersChange: (answers: DraftQuestionnaireAnswers) => void;
  readonly onReview: () => void;
  readonly onCancel: () => void;
}

function setAnswer(
  answers: DraftQuestionnaireAnswers,
  questionId: QuestionId,
  value: string | string[],
): DraftQuestionnaireAnswers {
  switch (questionId) {
    case 'projectName':
      return { ...answers, projectName: String(value) };
    case 'productSummary':
      return { ...answers, productSummary: String(value) };
    case 'frontend':
    case 'backend':
    case 'realtimeMode':
    case 'database':
    case 'databaseProvider':
    case 'dataAccess':
    case 'fileStorage':
    case 'authService':
    case 'cacheProvider':
    case 'rateLimitProvider':
    case 'queueProvider':
      return { ...answers, [questionId]: String(value) } as DraftQuestionnaireAnswers;
    case 'infrastructure':
    case 'loginMethods':
      return { ...answers, [questionId]: value } as DraftQuestionnaireAnswers;
    case 'agentMode':
      return {
        ...answers,
        agentMode: value as NonNullable<DraftQuestionnaireAnswers['agentMode']>,
      };
  }
}

function validateText(question: Question, value: string): string | undefined {
  const sanitized = sanitizeTerminalText(value).trim();
  if (question.id === 'projectName' && sanitized.length === 0) return 'Project name is required.';
  if (question.id === 'projectName' && sanitized.length > 100)
    return 'Use 100 characters or fewer.';
  if (question.id === 'productSummary' && sanitized.length < 10) {
    return 'Describe the product in at least 10 characters.';
  }
  if (question.id === 'productSummary' && sanitized.length > 2_000) {
    return 'Use 2,000 characters or fewer.';
  }
  return undefined;
}

export function QuestionnaireScreen({
  answers,
  editQuestionId,
  onAnswersChange,
  onReview,
  onCancel,
}: QuestionnaireScreenProps) {
  const initialQuestions = useMemo(() => getQuestionSequence(answers), []);
  const initialIndex = editQuestionId
    ? Math.max(
        0,
        initialQuestions.findIndex(({ id }) => id === editQuestionId),
      )
    : 0;
  const [index, setIndex] = useState(initialIndex);
  const questions = getQuestionSequence(answers);
  const currentIndex = Math.min(index, Math.max(0, questions.length - 1));
  const question = questions[currentIndex];

  if (!question) return null;

  const submit = (value: string | string[]) => {
    const normalized =
      question.kind === 'text' ? sanitizeTerminalText(String(value)).trim() : value;
    const nextAnswers = setAnswer(answers, question.id, normalized);
    onAnswersChange(nextAnswers);

    if (editQuestionId) {
      onReview();
      return;
    }

    const nextQuestions = getQuestionSequence(nextAnswers);
    if (currentIndex >= nextQuestions.length - 1) onReview();
    else setIndex(currentIndex + 1);
  };

  const back = () => {
    if (editQuestionId) onReview();
    else if (currentIndex > 0) setIndex(currentIndex - 1);
    else onCancel();
  };

  return (
    <Frame title="New session" subtitle={`Question ${currentIndex + 1} of ${questions.length}`}>
      <Text bold>{question.label}</Text>
      {question.help ? <Text dimColor>{question.help}</Text> : null}
      {question.kind === 'text' ? (
        <TextEntry
          key={question.id}
          initialValue={String(answers[question.id] ?? '')}
          placeholder={question.placeholder}
          multilineHint={question.id === 'productSummary'}
          validate={(value) => validateText(question, value)}
          onSubmit={submit}
          onCancel={back}
        />
      ) : question.kind === 'multi' ? (
        <MultiSelect
          key={question.id}
          options={question.options}
          initialValues={(answers[question.id] ?? []) as string[]}
          onSubmit={submit}
          onCancel={back}
        />
      ) : (
        <Menu
          key={question.id}
          options={question.options}
          initialValue={
            typeof answers[question.id] === 'string' ? (answers[question.id] as string) : undefined
          }
          onSelect={submit}
          onCancel={back}
        />
      )}
    </Frame>
  );
}

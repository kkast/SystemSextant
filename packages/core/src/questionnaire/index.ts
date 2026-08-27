import { z } from 'zod';
import {
  agentModeLabels,
  agentModes,
  architectureLabels,
  architectureStarters,
  capabilities,
  capabilityLabels,
} from '../catalog/index.js';
import {
  AgentModeSchema,
  ArchitectureStarterSchema,
  CapabilitySchema,
} from '../schema/project-config.js';

export const QuestionnaireAnswersSchema = z
  .object({
    projectName: z.string().trim().min(1, 'Project name is required.').max(100),
    productSummary: z
      .string()
      .trim()
      .min(10, 'Describe the product in at least 10 characters.')
      .max(2_000),
    architecture: ArchitectureStarterSchema,
    capabilities: z.array(CapabilitySchema).refine((items) => new Set(items).size === items.length),
    databaseType: z.enum(['postgresql', 'document']).optional(),
    realtimeDirection: z.enum(['one-way', 'bidirectional']).optional(),
    managedServicePreference: z.enum(['upstash', 'provider-neutral']).optional(),
    agentMode: AgentModeSchema,
  })
  .superRefine((answers, context) => {
    if (answers.capabilities.includes('database') && !answers.databaseType) {
      context.addIssue({
        code: 'custom',
        message: 'Choose a database type.',
        path: ['databaseType'],
      });
    }
    if (answers.capabilities.includes('real-time') && !answers.realtimeDirection) {
      context.addIssue({
        code: 'custom',
        message: 'Choose a real-time communication direction.',
        path: ['realtimeDirection'],
      });
    }
    if (
      answers.capabilities.some((capability) =>
        ['caching', 'rate-limiting', 'background-jobs'].includes(capability),
      ) &&
      !answers.managedServicePreference
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Choose a managed-service preference.',
        path: ['managedServicePreference'],
      });
    }
  });

export type QuestionnaireAnswers = z.infer<typeof QuestionnaireAnswersSchema>;
export type DraftQuestionnaireAnswers = Partial<QuestionnaireAnswers>;

export type QuestionId =
  | 'projectName'
  | 'productSummary'
  | 'architecture'
  | 'capabilities'
  | 'databaseType'
  | 'realtimeDirection'
  | 'managedServicePreference'
  | 'agentMode';

export interface QuestionOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

interface BaseQuestion {
  readonly id: QuestionId;
  readonly label: string;
  readonly help?: string;
}

export interface TextQuestion extends BaseQuestion {
  readonly kind: 'text';
  readonly placeholder?: string;
}

export interface SingleSelectQuestion extends BaseQuestion {
  readonly kind: 'single';
  readonly options: readonly QuestionOption[];
}

export interface MultiSelectQuestion extends BaseQuestion {
  readonly kind: 'multi';
  readonly options: readonly QuestionOption[];
}

export type Question = TextQuestion | SingleSelectQuestion | MultiSelectQuestion;

const baseQuestions: readonly Question[] = [
  {
    id: 'projectName',
    kind: 'text',
    label: 'Project name',
    placeholder: 'My project',
  },
  {
    id: 'productSummary',
    kind: 'text',
    label: 'What are you building?',
    placeholder: 'Describe the product, users, and primary outcome',
  },
  {
    id: 'architecture',
    kind: 'single',
    label: 'Architecture starter',
    help: 'This creates an editable component graph; it is not a permanent limitation.',
    options: architectureStarters.map((value) => ({
      value,
      label: architectureLabels[value],
      ...(value === 'nextjs-express'
        ? {
            description:
              'Useful for WebSockets, long-running jobs, and server lifecycle control beyond Next.js.',
          }
        : {}),
    })),
  },
  {
    id: 'capabilities',
    kind: 'multi',
    label: 'Capabilities',
    help: 'Select any that apply. An empty selection is valid.',
    options: capabilities.map((value) => ({ value, label: capabilityLabels[value] })),
  },
];

const databaseQuestion: SingleSelectQuestion = {
  id: 'databaseType',
  kind: 'single',
  label: 'Database type',
  options: [
    { value: 'postgresql', label: 'PostgreSQL' },
    { value: 'document', label: 'Document / NoSQL database' },
  ],
};

const realtimeQuestion: SingleSelectQuestion = {
  id: 'realtimeDirection',
  kind: 'single',
  label: 'How should real-time events travel?',
  options: [
    { value: 'one-way', label: 'Server to client only', description: 'Use SSE guidance.' },
    { value: 'bidirectional', label: 'Both directions', description: 'Use WebSocket guidance.' },
  ],
};

const managedServiceQuestion: SingleSelectQuestion = {
  id: 'managedServicePreference',
  kind: 'single',
  label: 'How should these infrastructure challenges be solved?',
  help: 'Choose the challenge first; SystemSextant maps it to the appropriate product.',
  options: [
    {
      value: 'upstash',
      label: 'Use Upstash where applicable',
      description: 'Redis for caching, Ratelimit for limits, and QStash for message delivery.',
    },
    {
      value: 'provider-neutral',
      label: 'Keep the solution provider-neutral',
      description: 'Record stable boundaries without selecting a managed vendor.',
    },
  ],
};

const agentModeQuestion: SingleSelectQuestion = {
  id: 'agentMode',
  kind: 'single',
  label: 'How should the receiving coding agent work?',
  options: agentModes.map((value) => ({ value, label: agentModeLabels[value] })),
};

export function getQuestionSequence(answers: DraftQuestionnaireAnswers): Question[] {
  const questions = [...baseQuestions];
  if (answers.capabilities?.includes('database')) {
    questions.push(databaseQuestion);
  }
  if (answers.capabilities?.includes('real-time')) {
    questions.push(realtimeQuestion);
  }
  if (
    answers.capabilities?.some((capability) =>
      ['caching', 'rate-limiting', 'background-jobs'].includes(capability),
    )
  ) {
    questions.push(managedServiceQuestion);
  }
  questions.push(agentModeQuestion);
  return questions;
}

export function parseQuestionnaireAnswers(input: unknown): QuestionnaireAnswers {
  return QuestionnaireAnswersSchema.parse(input);
}

export function formatAnswer(question: Question, answers: DraftQuestionnaireAnswers): string {
  const value = answers[question.id];
  if (Array.isArray(value)) {
    return value.length === 0
      ? 'None'
      : value
          .map((item) => capabilityLabels[item as keyof typeof capabilityLabels] ?? item)
          .join(', ');
  }
  if (!value) return 'Not answered';
  if (question.kind === 'single' || question.kind === 'multi') {
    return question.options.find((option) => option.value === value)?.label ?? String(value);
  }
  return String(value);
}

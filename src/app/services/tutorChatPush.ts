import type { Question } from '@/app/data/exam-data';
import type { TutorActiveMcq } from '@/app/utils/tutorOfficialContext';
import { buildOfficialBankSnippets } from '@/app/utils/tutorOfficialContext';
import { getChatbotResponse } from '@/app/services/aiService';
import { toast } from 'sonner';

export function questionToTutorMcq(q: Question): TutorActiveMcq {
  return {
    question: q.question,
    options: q.options,
    correctIndex: q.correctAnswer,
    explanation: (q.explanation || '').trim(),
    subject: q.subject || q.category,
  };
}

const TUTOR_PROMPT =
  'Explain this MCQ clearly in 2–4 short paragraphs. Use the official correct letter and course explanation as authority. Help me understand the concept and common mistakes.';

export type TutorChatPushDeps = {
  addChatMessage: (role: 'user' | 'ai', content: string) => void;
  setChatOpen: (open: boolean) => void;
  setActiveTutorMcq: (v: TutorActiveMcq | null) => void;
  chatMessages: Array<{ role: 'user' | 'ai'; content: string }>;
  bankQuestions: Question[];
  userProgress: { accuracy: number; weakAreas: string[]; level: number };
};

/**
 * Opens the tutor, posts a user line, and appends the model reply (same contract as AIChatbot + getChatbotResponse).
 */
export async function pushQuestionToTutorChat(
  stageLabel: string,
  q: Question,
  deps: TutorChatPushDeps,
  studentNote?: string
): Promise<void> {
  const active = questionToTutorMcq(q);
  deps.setActiveTutorMcq(active);
  deps.setChatOpen(true);

  const userLine =
    studentNote && studentNote.trim().length > 0
      ? `[${stageLabel}] ${TUTOR_PROMPT}\n\n(${studentNote.trim()})`
      : `[${stageLabel}] ${TUTOR_PROMPT}`;

  deps.addChatMessage('user', userLine);

  const convoText = [...deps.chatMessages.map((m) => m.content), userLine].join(' ');
  const officialBankSnippets = buildOfficialBankSnippets(deps.bankQuestions, userLine, convoText, 8);

  const conversationHistory = [
    ...deps.chatMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userLine },
  ];

  try {
    const response = await getChatbotResponse(userLine, {
      activeMcq: active,
      officialBankSnippets,
      currentSubject: active.subject,
      currentQuestion: active.question,
      userProgress: deps.userProgress,
      conversationHistory,
    });
    deps.addChatMessage('ai', response);
  } catch (e) {
    console.warn('[pushQuestionToTutorChat]', e);
    const msg =
      e instanceof Error && e.message.includes('API key')
        ? '⚠️ Configure VITE_OPENAI_API_KEY in .env to use the tutor.'
        : "Sorry, the tutor couldn't respond right now. Try again in a moment.";
    deps.addChatMessage('ai', msg);
    toast.error('Tutor unavailable', { description: e instanceof Error ? e.message : undefined });
  }
}

/**
 * AI Service for GPT Integration
 * 
 * This service handles all AI-related API calls including:
 * - Chatbot responses
 * - Question generation
 * - Explanation generation
 * - Adaptive learning suggestions
 */

import type { TutorActiveMcq } from '@/app/utils/tutorOfficialContext';
import {
  LEVEL_SLUGS,
  legacyBandIfExplicitEasyOrHard,
  normalizeLevelBandSlug,
  type LevelBandSlug,
} from '@/app/constants/levelBands';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface QuestionGenerationParams {
  subject?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string;
  similarTo?: string; // For generating similar questions
}

type CallOpenAiOptions = {
  /** Forces valid JSON object output (gpt-4o-mini+); prompt must mention JSON. */
  jsonObject?: boolean;
};

/**
 * Call OpenAI API for chat completion
 */
async function callOpenAI(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 500,
  options?: CallOpenAiOptions
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Please add VITE_OPENAI_API_KEY to your .env file.');
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using cheaper model, can upgrade to gpt-4 if needed
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(options?.jsonObject ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage = error.error?.message || 'Failed to get AI response';
      
      // Log detailed error for debugging
      console.error('OpenAI API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        error: error
      });
      
      // Provide user-friendly error messages
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your VITE_OPENAI_API_KEY in .env file.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded or no credits. Please check your OpenAI account balance.');
      } else if (response.status === 403) {
        throw new Error('API key does not have permission. Please check your OpenAI API key settings.');
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
}

/**
 * Get AI chatbot response with full conversation history so it remembers context.
 */
export async function getChatbotResponse(
  userMessage: string,
  context?: {
    currentSubject?: string;
    currentQuestion?: string;
    /** Full MCQ on screen — model must not contradict this key. */
    activeMcq?: TutorActiveMcq;
    /** Keyword-matched rows from the loaded question bank. */
    officialBankSnippets?: string;
    userProgress?: {
      accuracy: number;
      weakAreas: string[];
      level: number;
    };
    /** Previous messages in the chat so the AI can remember what was discussed */
    conversationHistory?: Array<{ role: 'user' | 'ai'; content: string }>;
  }
): Promise<string> {
  const letters = ['A', 'B', 'C', 'D'] as const;
  const activeBlock = context?.activeMcq
    ? `
## ACTIVE PRACTICE QUESTION (highest priority — authoritative for this app)
Subject: ${context.activeMcq.subject || 'General'}
Question: ${context.activeMcq.question}
A) ${context.activeMcq.options[0] ?? ''}
B) ${context.activeMcq.options[1] ?? ''}
C) ${context.activeMcq.options[2] ?? ''}
D) ${context.activeMcq.options[3] ?? ''}
OFFICIAL CORRECT ANSWER FOR THIS EXAM: ${letters[context.activeMcq.correctIndex] ?? '?'}
Official explanation from the course: ${context.activeMcq.explanation}

Rules for this block: You MUST agree with the official letter and explanation above for exam purposes. Never tell the student a different option is correct for this question. You may clarify concepts in simple language only in ways that support the official key.
`
    : '';

  const bankBlock =
    context?.officialBankSnippets && context.officialBankSnippets.trim().length > 0
      ? `
## Official course question bank (retrieved snippets — authoritative when they apply)
The following items come from the student's licensed prep database. If the student's message relates to any snippet, treat OFFICIAL CORRECT and the course explanation as the exam truth. Do not contradict them. If none apply, you may answer from general real estate knowledge and briefly note you are giving general tutoring (not a specific bank item).

${context.officialBankSnippets}
`
      : '';

  const systemPrompt = `You are an AI tutor for real estate exam prep.
You are friendly, clear, and educational. Use **bold** sparingly for key terms only (markdown is supported).
When official bank data or the active question is provided above, those answers are the exam authority—never disagree with the keyed letter.
For unrelated real estate topics with no matching bank item, answer helpfully from general knowledge as a tutor.
Keep answers focused; use 2–4 short paragraphs or bullet lists when it helps clarity.
Use conversation history: for "explain more", "why", or "dubarah", continue the same topic without asking what topic they mean.`;

  const contextInfo = context
    ? `
Student Context:
- Current Subject: ${context.currentSubject || 'Not specified'}
- Accuracy: ${context.userProgress?.accuracy || 0}%
- Level: ${context.userProgress?.level || 1}
- Weak Areas: ${context.userProgress?.weakAreas?.join(', ') || 'None'}
${context.currentQuestion && !context.activeMcq ? `- Question text (legacy): ${context.currentQuestion}` : ''}
`
    : '';

  const history = (context?.conversationHistory ?? []).slice(-20).map((m) => ({
    role: (m.role === 'ai' ? 'assistant' : m.role) as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  const systemBody = [systemPrompt, contextInfo, activeBlock, bankBlock].filter(Boolean).join('\n');

  const lastTurn = history[history.length - 1];
  const historyAlreadyHasThisUser =
    lastTurn?.role === 'user' && lastTurn.content === userMessage;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemBody },
    ...history,
    ...(historyAlreadyHasThisUser ? [] : [{ role: 'user' as const, content: userMessage }]),
  ];

  const hasAuthority = Boolean(context?.activeMcq) || Boolean(context?.officialBankSnippets?.trim());
  const temperature = hasAuthority ? 0.3 : 0.65;
  const bankLen = context?.officialBankSnippets?.length ?? 0;
  const maxTokens = bankLen > 2500 ? 900 : bankLen > 1200 ? 750 : 650;

  return await callOpenAI(messages, temperature, maxTokens);
}

/**
 * Generate a new question using AI
 */
export async function generateQuestion(params: QuestionGenerationParams): Promise<{
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
}> {
  const similarPart = params.similarTo
    ? `Generate a NEW question that is SIMILAR in topic and difficulty to this one (do not copy it): "${params.similarTo}". `
    : '';
  const prompt = `${similarPart}Generate a ${params.difficulty || 'medium'} difficulty multiple choice question${params.subject ? ` about ${params.subject}` : ''}${params.topic ? ` on the topic: ${params.topic}` : ''}.

Requirements:
- 4 options only, in order A, B, C, D. options array = [first, second, third, fourth].
- You MUST set correctOption to the LETTER of the correct answer: "A", "B", "C", or "D" (this is critical for grading).
- Your explanation must clearly state the final numerical/verbal answer that matches exactly one of the four options.
- Reply with ONLY this JSON, no other text:
{"question":"...","options":["...","...","...","..."],"correctOption":"A","correctAnswer":0,"explanation":"...","category":"..."}`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an exam question generator. Reply with ONLY valid JSON. No markdown, no code blocks, no extra text. The correctOption letter (A/B/C/D) must match the option that your explanation proves. correctAnswer must be 0 for A, 1 for B, 2 for C, 3 for D.',
    },
    { role: 'user', content: prompt },
  ];

  const response = await callOpenAI(messages, 0.8, 600);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;
    const parsed = JSON.parse(jsonStr);
    const opts = Array.isArray(parsed.options) ? parsed.options : [];
    const options = opts.length >= 4 ? opts.slice(0, 4) : [...opts, ...Array(4 - opts.length).fill('Option')];
    const explanation = String(parsed.explanation || '').trim() || 'See correct answer above.';

    // Prefer correctOption letter (A/B/C/D) over index — GPT often gets the index wrong
    const letter = String(parsed.correctOption || '').trim().toUpperCase();
    let correctAnswer: number;
    if (letter === 'A') correctAnswer = 0;
    else if (letter === 'B') correctAnswer = 1;
    else if (letter === 'C') correctAnswer = 2;
    else if (letter === 'D') correctAnswer = 3;
    else {
      correctAnswer = Number(parsed.correctAnswer);
      if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) correctAnswer = 0;
    }

    // Sanity: if explanation clearly states a value that matches exactly one option, use that index (fixes GPT mismatch)
    const inferredIndex = inferCorrectAnswerFromExplanation(options, explanation);
    if (inferredIndex !== undefined && inferredIndex !== correctAnswer) {
      correctAnswer = inferredIndex;
    }

    return {
      question: String(parsed.question || '').trim() || 'No question generated.',
      options,
      correctAnswer,
      explanation,
      category: String(parsed.category || params.subject || 'General').trim(),
    };
  } catch (error) {
    console.error('Failed to parse generated question:', error);
    throw new Error('Failed to generate valid question format');
  }
}

/**
 * If the explanation clearly states the answer (e.g. "$15,652" or "= 15,652"), find which option matches and return its index.
 * This fixes cases where GPT returns wrong correctAnswer index but explanation is correct.
 */
function inferCorrectAnswerFromExplanation(options: string[], explanation: string): number | undefined {
  if (!explanation || options.length === 0) return undefined;
  const normalized = explanation.replace(/\s+/g, ' ').trim();
  let matchedIndex: number | undefined;
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (!opt || typeof opt !== 'string') continue;
    const optTrimmed = opt.trim();
    if (!optTrimmed) continue;
    // 1) Explanation contains the exact option text (e.g. "= $15,652" or "answer is $15,652")
    if (normalized.includes(optTrimmed)) {
      matchedIndex = i;
      break;
    }
    // 2) Regex: "answer is X", "= X", "therefore X" where X is this option
    const escaped = optTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:answer is|=\\s*|therefore[,]?\\s+)[^.]*?${escaped}`, 'i').test(normalized)) {
      matchedIndex = i;
      break;
    }
    // 3) Numeric: option "$15,652" -> "15652"; explanation "= $15,652" or "15652" (digits only)
    const numFromOpt = optTrimmed.replace(/[$,%\s]/g, '').replace(/,/g, '');
    if (numFromOpt.length >= 2 && /\d+/.test(numFromOpt)) {
      const digitsOnly = normalized.replace(/[,$%\s]/g, '').replace(/\$/g, '');
      if (digitsOnly.includes(numFromOpt)) {
        matchedIndex = i;
        break;
      }
    }
  }
  return matchedIndex;
}

/**
 * Generate explanation for why an answer is wrong
 */
export async function generateWrongAnswerExplanation(
  question: string,
  selectedOption: string,
  correctOption: string,
  correctExplanation: string
): Promise<string> {
  const prompt = `A student answered this question incorrectly:
Question: "${question}"
Student's Answer: "${selectedOption}"
Correct Answer: "${correctOption}"
Correct Explanation: "${correctExplanation}"

Explain why the student's answer is wrong in a helpful, educational way. Help them understand their mistake without being discouraging. Keep it concise (2-3 sentences).`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a helpful tutor explaining mistakes to students.',
    },
    { role: 'user', content: prompt },
  ];

  return await callOpenAI(messages, 0.7, 200);
}

/**
 * Get personalized study suggestions based on performance
 */
export async function getStudySuggestions(
  weakAreas: string[],
  accuracy: number,
  recentMistakes: string[]
): Promise<string> {
  const prompt = `A student has the following performance:
- Accuracy: ${accuracy}%
- Weak Areas: ${weakAreas.join(', ') || 'None identified yet'}
- Recent Mistakes: ${recentMistakes.slice(0, 3).join(', ') || 'None'}

Provide 2-3 specific, actionable study suggestions to help them improve. Be encouraging and specific.`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an educational advisor providing personalized study tips.',
    },
    { role: 'user', content: prompt },
  ];

  return await callOpenAI(messages, 0.7, 200);
}

/**
 * Generate a context-aware hint for a specific question (GPT).
 * Hint is short, helpful, and relates to the actual question content — not generic.
 */
export async function generateHint(
  questionText: string,
  options: string[],
  category: string,
  difficulty: string
): Promise<string> {
  const prompt = `You are a tutor. A student is stuck on this multiple-choice question. Give ONE short, helpful hint (1-2 sentences) that guides them toward the correct answer WITHOUT giving the answer away. The hint must be specific to THIS question's content and logic.

Question: "${questionText}"
Options: ${options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o}`).join(' | ')}

Category: ${category}. Difficulty: ${difficulty}.

Reply with ONLY the hint text, no labels or quotes.`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You give brief, question-specific hints. Never reveal the answer. Be clear and encouraging.',
    },
    { role: 'user', content: prompt },
  ];

  const hint = await callOpenAI(messages, 0.5, 120);
  return (hint || 'Read the question again and check each option carefully.').trim();
}

function pickLevelScalarFromJson(v: unknown): LevelBandSlug | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    return normalizeLevelBandSlug(t);
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.round(v);
    if (n >= 0 && n <= 2) return LEVEL_SLUGS[n];
    if (n >= 1 && n <= 3) return LEVEL_SLUGS[n - 1];
  }
  return null;
}

function pickLevelFromClassifyJsonObject(obj: Record<string, unknown>): LevelBandSlug | null {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    lower.set(k.toLowerCase(), v);
  }
  for (const k of ['level', 'difficulty', 'band', 'difficulty_band']) {
    const band = pickLevelScalarFromJson(lower.get(k));
    if (band !== null) return band;
  }
  return null;
}

/**
 * Extract easy | medium | hard from model output (JSON mode, markdown fences, or loose text).
 */
function parseLevelFromClassifyResponse(raw: string): LevelBandSlug | null {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) s = fence[1].trim();

  const tryJson = (text: string): LevelBandSlug | null => {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const picked = pickLevelFromClassifyJsonObject(obj);
      if (picked !== null) return picked;
    } catch {
      return null;
    }
    return null;
  };

  const fromWhole = tryJson(s);
  if (fromWhole) return fromWhole;

  const brace = s.match(/\{[\s\S]*\}/);
  if (brace) {
    const fromBrace = tryJson(brace[0]);
    if (fromBrace) return fromBrace;
  }

  const quoted = s.match(/"level"\s*:\s*"([^"]+)"/i);
  if (quoted) return normalizeLevelBandSlug(quoted[1]);

  const numQuoted = s.match(/"level"\s*:\s*(-?\d+)/i);
  if (numQuoted) {
    const band = pickLevelScalarFromJson(Number(numQuoted[1]));
    if (band !== null) return band;
  }

  const word = s.match(/\b(easy|medium|hard)\b/i);
  if (word) return normalizeLevelBandSlug(word[1]);

  return null;
}

async function classifyLevelPlainTextFallback(
  questionText: string,
  options: string[],
  categorySubject: string
): Promise<LevelBandSlug | null> {
  const optsLines = options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n');
  const allowed = LEVEL_SLUGS.join(', ');
  const prompt = `Difficulty for this MCQ (one of: ${allowed} only).

Category: ${categorySubject}

Question:
${questionText}

Options:
${optsLines}`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Reply with exactly one word from the list: ${allowed}. No punctuation, no JSON, no explanation.`,
    },
    { role: 'user', content: prompt },
  ];

  try {
    const response = await callOpenAI(messages, 0.25, 32);
    const m = response.trim().match(/\b(easy|medium|hard)\b/i);
    if (m) return normalizeLevelBandSlug(m[1]);
  } catch {
    /* ignore */
  }
  return null;
}

export type ClassifyLevelOptions = {
  /** When the model output cannot be parsed, use bank row difficulty before defaulting to medium. */
  legacyDifficulty?: string;
};

/**
 * Anchors the model to this product's easy / medium / hard scale (real estate exam MCQs).
 * Each block ends with the expected JSON shape for that example.
 */
const CLASSIFY_LEVEL_FEW_SHOT = `Here are calibrated examples from the same exam-prep style. Match their spirit when labeling new questions.

--- Example (level: easy) ---
Question: Real property can become personal property by a process called:
A. Attachment
B. Accretion
C. Hypothecation
D. Severance
Correct answer: Severance. Severance detaches an item from the land (e.g. cutting a tree); it becomes personal property.
Expected output: {"level":"easy"}

--- Example (level: easy) ---
Question: The right of eminent domain refers to:
A. The government's right to acquire or authorize others to acquire title to property for public use
B. An institution or individual acquiring land by grant from the government
C. An organization's right to condemn property pending a community improvement
D. The right of every American citizen to own property
Correct answer: A. Core definition of government power for public use.
Expected output: {"level":"easy"}

--- Example (level: medium) ---
Question: The term "real property" refers to what?
A. Just the land itself
B. The land and any attachments or improvements
C. Land, improvements, and the bundle of rights of ownership
D. The bundle of rights of ownership only
Correct answer: C. Combines land, improvements, and rights — typical multi-part definition students must distinguish from partial choices.
Expected output: {"level":"medium"}

--- Example (level: hard) ---
Question: Littoral rights are:
A. Rights that govern lakefront or oceanfront property
B. Rights that have to do with flowing water like rivers
C. The rights to the water beneath a property
D. The right to collect rainwater on a property
Correct answer: A. Requires knowing littoral vs riparian vs other water-right concepts and similar-looking distractors.
Expected output: {"level":"hard"}
`;

/**
 * Classify a bank-style MCQ into easy | medium | hard (for UI + adaptive analytics).
 */
export async function classifyQuestionLevelBand(
  questionText: string,
  options: string[],
  categorySubject: string,
  opts?: ClassifyLevelOptions
): Promise<LevelBandSlug> {
  const optsLines = options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n');
  const allowed = LEVEL_SLUGS.join(', ');
  const prompt = `${CLASSIFY_LEVEL_FEW_SHOT}

Now classify THIS question only. Return a JSON object with a single key "level" (string). The value MUST be exactly one of: ${allowed}

Use the examples above as anchors:
- easy: straight definitions, single-concept recall, obvious distinction between options.
- medium: need to combine ideas or pick the most complete correct statement among plausible options.
- hard: subtle distinctions (similar terms), exceptions, or multi-concept traps that confuse many students.

Category / context: ${categorySubject}

Question:
${questionText}

Options:
${optsLines}`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You output only a JSON object with key "level" whose value is one of: ${allowed}. No markdown fences, no extra keys, no explanation.`,
    },
    { role: 'user', content: prompt },
  ];

  const explicitLegacy = legacyBandIfExplicitEasyOrHard(opts?.legacyDifficulty);

  let jsonBand: LevelBandSlug | null = null;
  try {
    const response = await callOpenAI(messages, 0.35, 320, { jsonObject: true });
    jsonBand = parseLevelFromClassifyResponse(response);
    if (jsonBand !== null) return jsonBand;
    console.warn('[classifyQuestionLevelBand] JSON parse miss; plain-text retry.', response.slice(0, 160));
  } catch (e) {
    console.warn('[classifyQuestionLevelBand] Primary classify failed; plain-text retry.', e);
  }

  try {
    const plain = await classifyLevelPlainTextFallback(questionText, options, categorySubject);
    if (plain !== null) return plain;
  } catch {
    /* ignore */
  }

  if (explicitLegacy !== undefined) return explicitLegacy;
  return 'medium';
}

/**
 * Generate a similar question to help practice weak areas
 */
export async function generateSimilarQuestion(
  originalQuestion: string,
  subject: string,
  difficulty: 'easy' | 'medium' | 'hard'
): Promise<{
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
}> {
  return await generateQuestion({
    similarTo: originalQuestion,
    subject,
    difficulty,
  });
}



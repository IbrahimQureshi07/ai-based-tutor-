/**
 * AI Service for GPT Integration
 * 
 * This service handles all AI-related API calls including:
 * - Chatbot responses
 * - Question generation
 * - Explanation generation
 * - Adaptive learning suggestions
 */

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

/**
 * Call OpenAI API for chat completion
 */
async function callOpenAI(
  messages: ChatMessage[],
  temperature: number = 0.7,
  maxTokens: number = 500
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
    userProgress?: {
      accuracy: number;
      weakAreas: string[];
      level: number;
    };
    /** Previous messages in the chat so the AI can remember what was discussed */
    conversationHistory?: Array<{ role: 'user' | 'ai'; content: string }>;
  }
): Promise<string> {
  const systemPrompt = `You are an AI tutor helping students prepare for state-level exams. 
You are friendly, encouraging, and explain concepts clearly in simple language.
You help students understand their mistakes and guide them to improve.
Always respond in a helpful, educational manner. Keep responses concise (2-3 sentences max unless explaining a complex concept).
If the student asks about a specific question or topic, provide detailed explanations.
Important: Use the conversation history. When the student says things like "explain more", "I didn't understand", "in detail please", or "dubarah batao", always refer back to the topic or question you were just discussing—do not ask them to specify the topic again.`;

  const contextInfo = context ? `
Student Context:
- Current Subject: ${context.currentSubject || 'Not specified'}
- Accuracy: ${context.userProgress?.accuracy || 0}%
- Level: ${context.userProgress?.level || 1}
- Weak Areas: ${context.userProgress?.weakAreas?.join(', ') || 'None'}
${context.currentQuestion ? `- Current Question: ${context.currentQuestion}` : ''}
` : '';

  const history = (context?.conversationHistory ?? []).slice(-20).map((m) => ({
    role: (m.role === 'ai' ? 'assistant' : m.role) as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt + contextInfo },
    ...history,
    { role: 'user', content: userMessage },
  ];

  return await callOpenAI(messages, 0.7, 300);
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



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
      throw new Error(error.error?.message || 'Failed to get AI response');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
}

/**
 * Get AI chatbot response for study-related questions
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
  }
): Promise<string> {
  const systemPrompt = `You are an AI tutor helping students prepare for state-level exams. 
You are friendly, encouraging, and explain concepts clearly in simple language.
You help students understand their mistakes and guide them to improve.
Always respond in a helpful, educational manner. Keep responses concise (2-3 sentences max unless explaining a complex concept).
If the student asks about a specific question or topic, provide detailed explanations.`;

  const contextInfo = context ? `
Student Context:
- Current Subject: ${context.currentSubject || 'Not specified'}
- Accuracy: ${context.userProgress?.accuracy || 0}%
- Level: ${context.userProgress?.level || 1}
- Weak Areas: ${context.userProgress?.weakAreas?.join(', ') || 'None'}
${context.currentQuestion ? `- Current Question: ${context.currentQuestion}` : ''}
` : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt + contextInfo },
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
  const prompt = `Generate a ${params.difficulty || 'medium'} difficulty multiple choice question${params.subject ? ` about ${params.subject}` : ''}${params.topic ? ` on the topic: ${params.topic}` : ''}${params.similarTo ? ` similar to this question: "${params.similarTo}"` : ''}.

Requirements:
- The question should be suitable for state-level exam preparation
- Provide 4 options (A, B, C, D)
- Clearly indicate which option is correct
- Include a brief explanation
- Format your response as JSON:
{
  "question": "the question text",
  "options": ["option A", "option B", "option C", "option D"],
  "correctAnswer": 0 (0-3 index),
  "explanation": "why this answer is correct",
  "category": "subject category"
}`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an expert question generator for educational exams. Always respond with valid JSON only.',
    },
    { role: 'user', content: prompt },
  ];

  const response = await callOpenAI(messages, 0.8, 500);
  
  try {
    // Extract JSON from response (sometimes GPT adds extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;
    const parsed = JSON.parse(jsonStr);
    
    return {
      question: parsed.question,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
      explanation: parsed.explanation,
      category: parsed.category || params.subject || 'General',
    };
  } catch (error) {
    console.error('Failed to parse generated question:', error);
    throw new Error('Failed to generate valid question format');
  }
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



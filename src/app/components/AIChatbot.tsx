import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { MessageCircle, X, Send, Sparkles, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { getChatbotResponse } from '@/app/services/aiService';
import { toast } from 'sonner';
import { useQuestions } from '@/app/hooks/useQuestions';
import { buildOfficialBankSnippets } from '@/app/utils/tutorOfficialContext';
import { ChatMarkdown } from '@/app/components/ChatMarkdown';

const suggestedPrompts = [
  "Explain this concept",
  "Give me a hint",
  "Why is this answer wrong?",
  "How can I improve?",
  "Show me similar questions",
  "What should I focus on?"
];

export function AIChatbot() {
  const { chatOpen, setChatOpen, chatMessages, addChatMessage, userProgress, activeTutorMcq } = useApp();
  const { questions } = useQuestions();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiError, setApiError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const buildChatContext = (userMessage: string, historyBeforeUser: typeof chatMessages) => {
    const convoText = [...historyBeforeUser.map((m) => m.content), userMessage].join(' ');
    const officialBankSnippets = buildOfficialBankSnippets(questions, userMessage, convoText, 8);
    return {
      activeMcq: activeTutorMcq ?? undefined,
      officialBankSnippets,
      currentSubject: activeTutorMcq?.subject,
      currentQuestion: activeTutorMcq?.question,
    };
  };

  const historyForApi = (latestUserText: string) => [
    ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: latestUserText },
  ];

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    addChatMessage('user', userMessage);
    setInput('');
    setIsTyping(true);
    setApiError(false);

    try {
      const ctx = buildChatContext(userMessage, chatMessages);
      const response = await getChatbotResponse(userMessage, {
        ...ctx,
        userProgress: {
          accuracy: userProgress.accuracy,
          weakAreas: userProgress.weakAreas,
          level: userProgress.level,
        },
        conversationHistory: historyForApi(userMessage),
      });
      
      addChatMessage('ai', response);
    } catch (error) {
      console.error('Chatbot error:', error);
      setApiError(true);
      
      // Fallback message if API fails
      const errorMessage = error instanceof Error && error.message.includes('API key')
        ? "⚠️ Please configure your OpenAI API key in the .env file. See README for instructions."
        : "Sorry, I'm having trouble connecting right now. Please check your internet connection and try again.";
      
      addChatMessage('ai', errorMessage);
      toast.error('Failed to get AI response', {
        description: 'Please check your API key configuration',
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestedPrompt = async (prompt: string) => {
    if (isTyping) return;
    
    addChatMessage('user', prompt);
    setIsTyping(true);
    setApiError(false);

    try {
      const ctx = buildChatContext(prompt, chatMessages);
      const response = await getChatbotResponse(prompt, {
        ...ctx,
        userProgress: {
          accuracy: userProgress.accuracy,
          weakAreas: userProgress.weakAreas,
          level: userProgress.level,
        },
        conversationHistory: historyForApi(prompt),
      });
      
      addChatMessage('ai', response);
    } catch (error) {
      console.error('Chatbot error:', error);
      setApiError(true);
      const errorMessage = error instanceof Error && error.message.includes('API key')
        ? "⚠️ Please configure your OpenAI API key in the .env file."
        : "Sorry, I'm having trouble connecting right now.";
      
      addChatMessage('ai', errorMessage);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Chat Button */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setChatOpen(true)}
              size="lg"
              className="rounded-full w-16 h-16 shadow-2xl bg-primary hover:bg-primary/90 relative"
            >
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 0 0 rgba(37, 99, 235, 0.7)',
                    '0 0 0 10px rgba(37, 99, 235, 0)',
                    '0 0 0 0 rgba(37, 99, 235, 0)'
                  ]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: 'loop'
                }}
                className="absolute inset-0 rounded-full"
              />
              <MessageCircle className="w-7 h-7" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] h-[75vh] max-h-[600px] rounded-2xl shadow-2xl bg-card border border-border overflow-hidden flex flex-col"
          >
            {/* Header - Sticky */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-primary to-purple-500 p-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">AI Tutor</h3>
                  <p className="text-xs text-white/80">
                    {apiError ? 'Connection issue' : 'Always here to help'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChatOpen(false)}
                className="text-white hover:bg-white/20 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages - Scrollable */}
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <h4 className="font-semibold mb-2">Hi! I'm your AI tutor</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Ask me anything about your studies. I can explain concepts, help with questions, and provide study tips!
                    </p>
                    {!import.meta.env.VITE_OPENAI_API_KEY && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 text-left">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-yellow-800 dark:text-yellow-200">
                            <strong>Setup Required:</strong> Add your OpenAI API key to .env file to enable AI features.
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {suggestedPrompts.slice(0, 4).map((prompt, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSuggestedPrompt(prompt)}
                          className="text-xs h-auto py-2"
                          disabled={isTyping}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((message, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      ) : (
                        <ChatMarkdown content={message.content} />
                      )}
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                          className="w-2 h-2 rounded-full bg-muted-foreground"
                        />
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                          className="w-2 h-2 rounded-full bg-muted-foreground"
                        />
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                          className="w-2 h-2 rounded-full bg-muted-foreground"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input - Fixed at bottom */}
            <div className="p-4 border-t border-border bg-muted/30 flex-shrink-0">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask me anything..."
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  size="icon"
                  className="flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {chatMessages.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                  {suggestedPrompts.slice(0, 3).map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSuggestedPrompt(prompt)}
                      className="text-xs whitespace-nowrap"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
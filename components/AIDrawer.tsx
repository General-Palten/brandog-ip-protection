'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, CornerDownLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChatContext } from '../hooks/useChatContext';
import { useDynamicSuggestions } from '../hooks/useDynamicSuggestions';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIDrawerProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}


// Markdown formatter matching the dashboard assistant
const FormattedText = ({ text }: { text: string }) => {
  const parseBold = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <span key={i} className="font-medium text-primary">{part.slice(2, -2)}</span>;
      }
      return part;
    });
  };

  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-xs leading-relaxed text-secondary font-mono">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-secondary/80 shrink-0">*</span>
              <span>{parseBold(trimmed.substring(2))}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const [num, ...rest] = trimmed.split('.');
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-secondary/80 font-mono text-[10px] pt-0.5 shrink-0">{num}.</span>
              <span>{parseBold(rest.join('.').trim())}</span>
            </div>
          );
        }
        return <div key={i}>{parseBold(line)}</div>;
      })}
    </div>
  );
};

const AIDrawer: React.FC<AIDrawerProps> = ({ isOpen, onToggle }) => {
  const context = useChatContext();
  const dynamicSuggestions = useDynamicSuggestions(context);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: "Hello! I'm Brandog AI. Ask me about your active threats, revenue loss, or recent detections." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const checkScroll = useCallback(() => {
    if (suggestionsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = suggestionsRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, input]);

  const scrollSuggestions = (direction: 'left' | 'right') => {
    if (suggestionsRef.current) {
      const scrollAmount = 200;
      suggestionsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const textToSend = overrideText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
    };

    const historyForApi = [...messages, userMessage]
      .slice(-10)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    setInput('');
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: historyForApi,
          context,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply || data.error || 'Sorry, I could not generate a response.',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const showSuggestions = !input.trim();

  return (
    <>
      {/* Trigger tab on the right edge */}
      <button
        onClick={() => onToggle(true)}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 px-2 py-4 bg-surface border border-r-0 border-border text-secondary hover:text-primary rounded-l-lg shadow-lg hover:shadow-xl transition-all duration-300 group ${
          isOpen ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'
        }`}
        title="Open AI Assistant"
      >
        <Sparkles size={14} className="text-primary" />
        <span className="text-[10px] font-medium uppercase tracking-wider [writing-mode:vertical-lr]">Agent</span>
        <ChevronLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* Drawer panel - pushes content, no overlay */}
      <div
        className={`fixed right-0 top-0 h-full w-[380px] bg-background border-l border-border z-30 flex flex-col shadow-xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/30">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-primary" />
            <span className="text-sm font-medium text-primary">Agent</span>
          </div>
          <button
            onClick={() => onToggle(false)}
            className="p-1.5 text-secondary hover:text-primary hover:bg-surface rounded transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-surface/40">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="shrink-0 mt-0.5">
                {msg.role === 'user' ? (
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-border">
                    <img
                      src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
                      alt="User"
                      className="w-full h-full object-cover grayscale"
                    />
                  </div>
                ) : (
                  <Sparkles size={16} className="text-primary fill-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {msg.role === 'user' ? (
                  <p className="text-sm text-primary font-mono">{msg.content}</p>
                ) : (
                  <FormattedText text={msg.content} />
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 px-1">
              <Sparkles size={16} className="text-primary/50 animate-pulse" />
              <div className="flex gap-1 mt-1.5">
                <span className="w-1 h-1 bg-secondary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-secondary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-secondary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions area */}
        {showSuggestions && (
          <div className="px-0 pb-2 bg-surface/40 relative group/suggestions border-t border-border/50">
            {canScrollLeft && (
              <div className="absolute left-0 top-0 bottom-2 w-10 bg-gradient-to-r from-surface/80 via-surface/50 to-transparent z-10 flex items-center justify-start pl-1">
                <button
                  onClick={() => scrollSuggestions('left')}
                  className="p-1 text-secondary hover:text-primary transition-all"
                >
                  <ChevronLeft size={12} />
                </button>
              </div>
            )}

            <div
              ref={suggestionsRef}
              onScroll={checkScroll}
              className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden py-2 px-3 scroll-smooth relative"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {dynamicSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSubmit(undefined, suggestion)}
                  disabled={isLoading}
                  className="shrink-0 text-[10px] text-secondary border border-border bg-background px-2.5 py-1.5 rounded-md hover:bg-surface hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {suggestion}
                </button>
              ))}
              <div className="w-3 shrink-0" />
            </div>

            {canScrollRight && (
              <div className="absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-surface/80 via-surface/50 to-transparent z-10 flex items-center justify-end pr-1">
                <button
                  onClick={() => scrollSuggestions('right')}
                  className="p-1 text-secondary hover:text-primary transition-all"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        <form onSubmit={handleSubmit} className="relative border-t border-border p-3 bg-background">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Brandog a question..."
              className="w-full bg-transparent text-sm text-primary placeholder-secondary focus:outline-none py-2 pr-16 font-sans"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-secondary hover:text-primary transition-colors disabled:opacity-30"
            >
              <span>Submit</span>
              <CornerDownLeft size={10} strokeWidth={3} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AIDrawer;

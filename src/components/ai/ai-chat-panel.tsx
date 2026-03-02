"use client";

import { useRef, useEffect, useState, useCallback, type KeyboardEvent } from "react";
import { Send, Sparkles, Trash2, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAiChat, getToolLabel, type ChatMessage } from "@/hooks/use-ai-chat";
import { cn } from "@/lib/utils";

interface AiChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUGGESTED_QUESTIONS = [
  "What are today's sales?",
  "Show me top 5 products this month",
  "Compare Shopify vs Amazon",
  "Any low stock alerts?",
];

export function AiChatPanel({ open, onOpenChange }: AiChatPanelProps) {
  const { messages, isLoading, sendMessage, clearHistory } = useAiChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (question: string) => {
    sendMessage(question);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex w-[420px] max-w-[100vw] flex-col gap-0 p-0 sm:max-w-[420px]"
      >
        {/* Header */}
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <SheetTitle className="text-base">Thevasa AI</SheetTitle>
                <SheetDescription className="text-xs">
                  Ask about products, orders, inventory & finance
                </SheetDescription>
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={clearHistory}
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div ref={scrollRef} className="flex flex-col gap-3 py-4">
            {messages.length === 0 ? (
              <EmptyState onSuggestion={handleSuggestion} />
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
            {isLoading &&
              messages[messages.length - 1]?.role === "assistant" &&
              messages[messages.length - 1]?.content === "" &&
              ((messages[messages.length - 1]?.activeTools?.length ?? 0) > 0 ? (
                <ToolProgressIndicator
                  tools={messages[messages.length - 1].activeTools!}
                />
              ) : (
                <TypingIndicator />
              ))}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your business..."
              rows={1}
              className="border-input bg-background placeholder:text-muted-foreground flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              style={{ maxHeight: 120 }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 shrink-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState({
  onSuggestion,
}: {
  onSuggestion: (q: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10">
        <Sparkles className="h-7 w-7 text-violet-500" />
      </div>
      <h3 className="mb-1 text-sm font-medium">How can I help?</h3>
      <p className="text-muted-foreground mb-4 text-center text-xs">
        Ask me about your products, orders, inventory, or finances.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSuggestion(q)}
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full border px-3 py-1.5 text-xs transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignored
    }
  }, [message.content]);

  return (
    <div
      className={cn("group flex flex-col gap-1", isUser ? "items-end" : "items-start")}
    >
      <div
        className={cn(
          "relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
          isUser
            ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
            : "bg-muted text-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:w-full [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_thead]:border-b [&_tr]:border-b [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[10px] text-muted-foreground">
          {formatTime(message.timestamp)}
        </span>
        {!isUser && message.content && (
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground opacity-0 transition-opacity group-hover:opacity-100"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted flex items-center gap-1 rounded-2xl px-4 py-3">
        <span className="bg-muted-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
        <span className="bg-muted-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
        <span className="bg-muted-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function ToolProgressIndicator({ tools }: { tools: string[] }) {
  return (
    <div className="flex justify-start">
      <div className="bg-muted flex flex-col gap-1.5 rounded-2xl px-4 py-3">
        {tools.map((tool) => (
          <div key={tool} className="flex items-center gap-2 text-xs">
            <span className="bg-violet-500 h-1.5 w-1.5 animate-pulse rounded-full" />
            <span className="text-muted-foreground">
              {getToolLabel(tool)}...
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

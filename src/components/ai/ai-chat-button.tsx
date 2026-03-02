"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiChatPanel } from "./ai-chat-panel";

export function AiChatButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg transition-transform hover:scale-105 hover:from-violet-600 hover:to-purple-700"
      >
        <Sparkles className="h-5 w-5 text-white" />
        <span className="sr-only">Open AI Assistant</span>
      </Button>
      <AiChatPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

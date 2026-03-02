import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createGeminiModel } from "@/lib/ai/gemini";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { aiTools } from "@/lib/ai/tools";
import { executeToolCall } from "@/lib/ai/tool-handlers";
import type { Content, Part } from "@google/generative-ai";

const MAX_TOOL_ROUNDS = 5;

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse request
  let messages: { role: "user" | "model"; content: string }[];
  try {
    const body = await req.json();
    messages = body.messages;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!messages || messages.length === 0) {
    return Response.json({ error: "Messages required" }, { status: 400 });
  }

  // 3. Set up SSE stream immediately so the client gets feedback during tool calls
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const sendSSE = async (data: Record<string, unknown>) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  // 4. Process in the background while the stream is open
  (async () => {
    try {
      // Build Gemini contents from history
      const contents: Content[] = messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      // Create model and start chat
      const model = createGeminiModel();
      const tools = [{ functionDeclarations: aiTools }];

      const chat = model.startChat({
        history: contents.slice(0, -1),
        systemInstruction: {
          role: "user",
          parts: [{ text: getSystemPrompt() }],
        },
        tools,
      });

      // Send the last user message
      const lastMessage = contents[contents.length - 1];
      let response = await chat.sendMessage(lastMessage.parts);

      // Tool-calling loop
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const candidate = response.response.candidates?.[0];
        if (!candidate) break;

        const functionCalls = candidate.content.parts.filter(
          (p: Part) => "functionCall" in p
        );

        if (functionCalls.length === 0) break;

        // Execute all function calls with progress events
        const functionResponses: Part[] = [];
        for (const part of functionCalls) {
          const fc = (part as any).functionCall;

          // Send tool progress to client
          await sendSSE({ type: "tool_start", name: fc.name });

          const result = await executeToolCall(
            supabase,
            fc.name,
            fc.args ?? {}
          );

          await sendSSE({ type: "tool_end", name: fc.name });

          functionResponses.push({
            functionResponse: {
              name: fc.name,
              response: { result },
            },
          } as Part);
        }

        // Send function results back to Gemini
        response = await chat.sendMessage(functionResponses);
      }

      // Extract final text
      const finalText =
        response.response.candidates?.[0]?.content.parts
          .filter((p: Part) => "text" in p)
          .map((p: Part) => (p as any).text)
          .join("") ??
        "I wasn't able to generate a response. Please try again.";

      // Stream the final text word by word for natural feel
      const words = finalText.split(/(\s+)/);
      let buffer = "";
      for (const word of words) {
        buffer += word;
        // Flush every ~40 chars or at the end
        if (buffer.length >= 40) {
          await sendSSE({ content: buffer });
          buffer = "";
        }
      }
      if (buffer) {
        await sendSSE({ content: buffer });
      }

      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } catch (error) {
      console.error("AI Chat error:", error);
      const message =
        error instanceof Error ? error.message : "Internal server error";
      await sendSSE({ error: message });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

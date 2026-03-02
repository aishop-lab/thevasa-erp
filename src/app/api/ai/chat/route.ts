import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createGeminiModel } from "@/lib/ai/gemini";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { aiTools } from "@/lib/ai/tools";
import { executeToolCall } from "@/lib/ai/tool-handlers";
import type { Content, Part } from "@google/generative-ai";

const MAX_TOOL_ROUNDS = 5;

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request
    const { messages } = (await req.json()) as {
      messages: { role: "user" | "model"; content: string }[];
    };

    if (!messages || messages.length === 0) {
      return Response.json(
        { error: "Messages required" },
        { status: 400 }
      );
    }

    // 3. Build Gemini contents from history
    const contents: Content[] = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // 4. Create model and start chat
    const model = createGeminiModel();
    const tools = [{ functionDeclarations: aiTools }];

    const chat = model.startChat({
      history: contents.slice(0, -1),
      systemInstruction: { role: "user", parts: [{ text: getSystemPrompt() }] },
      tools,
    });

    // 5. Send the last user message
    const lastMessage = contents[contents.length - 1];
    let response = await chat.sendMessage(lastMessage.parts);

    // 6. Tool-calling loop
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const candidate = response.response.candidates?.[0];
      if (!candidate) break;

      const functionCalls = candidate.content.parts.filter(
        (p: Part) => "functionCall" in p
      );

      if (functionCalls.length === 0) break;

      // Execute all function calls
      const functionResponses: Part[] = [];
      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        const result = await executeToolCall(
          supabase,
          fc.name,
          fc.args ?? {}
        );
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

    // 7. Extract final text
    const finalText =
      response.response.candidates?.[0]?.content.parts
        .filter((p: Part) => "text" in p)
        .map((p: Part) => (p as any).text)
        .join("") ?? "I wasn't able to generate a response. Please try again.";

    // 8. Stream the response as SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send the full text in chunks to simulate streaming
        const chunkSize = 20;
        let offset = 0;

        function pushChunk() {
          if (offset >= finalText.length) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          const chunk = finalText.slice(offset, offset + chunkSize);
          offset += chunkSize;

          const data = JSON.stringify({ content: chunk });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Use a small timeout for natural feel
          setTimeout(pushChunk, 10);
        }

        pushChunk();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI Chat error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

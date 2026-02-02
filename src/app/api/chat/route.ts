import { NextResponse } from "next/server";

export const runtime = "edge";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      apiKey?: string;
      messages?: ChatMessage[];
      model?: string;
    };

    const apiKey = body.apiKey?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing apiKey (OpenRouter)." },
        { status: 400 },
      );
    }

    const messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Missing messages." },
        { status: 400 },
      );
    }

    // MVP default model; later: route based on task/cost.
    const model = body.model ?? "openai/gpt-4o-mini";

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        // Recommended by OpenRouter for analytics/rate-limits (safe to send).
        "HTTP-Referer": "https://vercel.app",
        "X-Title": "Manager Assistant PWA",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
      }),
    });

    const text = await res.text();
    // Pass-through status codes, but normalize body as JSON when possible.
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: res.status });
    } catch {
      return new NextResponse(text, { status: res.status });
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

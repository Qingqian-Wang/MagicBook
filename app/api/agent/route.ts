// §12 /api/agent：纯 LLM 代理。服务端零状态——不存会话、不碰数据库，
// 只注入 API key 并转发 OpenAI 兼容请求。agent loop 跑在浏览器（工具直接读写 IndexedDB）。
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 400 });
  }

  const { messages, tools } = (await req.json()) as {
    messages: unknown[];
    tools?: { type: "function"; function: { name: string; description: string; parameters: unknown } }[];
  };

  const base = process.env.OPENAI_BASE_URL?.replace(/\/+$/, "") ?? "https://api.openai.com/v1";

  const upstream = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json({ error: text.slice(0, 500) }, { status: upstream.status });
  }

  // 非流式转发；DeepSeek 兼容协议下纯工具调用轮 content 可能为 null
  const data = (await upstream.json()) as {
    choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[];
  };
  const message = data.choices?.[0]?.message;

  return NextResponse.json({
    content: message?.content ?? "",
    tool_calls: message?.tool_calls ?? [],
  });
}

import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { claude, CLAUDE_MODEL, isClaudeConfigured } from "@/lib/claude";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { question } = await req.json();

  if (!question || typeof question !== "string") {
    return NextResponse.json(
      { error: "question is required" },
      { status: 400 }
    );
  }

  const pages = await prisma.page.findMany({
    select: { id: true, title: true, content: true, spaceId: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  if (!isClaudeConfigured()) {
    return NextResponse.json({
      answer:
        "⚠️ ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일에 키를 추가한 뒤 서버를 재시작하세요.",
      sources: [],
    });
  }

  const context = pages
    .map(
      (p, i) =>
        `--- [${i + 1}] id=${p.id} title="${p.title}" ---\n${p.content.slice(
          0,
          4000
        )}`
    )
    .join("\n\n");

  const system = `당신은 사내 위키 어시스턴트입니다. 사용자의 질문에 대해 아래 제공된 페이지 내용만 근거로 한국어로 답변하세요.
- 근거가 부족하면 "관련 페이지를 찾지 못했습니다"라고 답하세요.
- 답변 마지막에 반드시 아래 형식의 근거 목록을 포함하세요:
<sources>[{"id":"<page id>","title":"<page title>"}]</sources>
- 실제로 인용한 페이지의 id만 포함하세요. 없으면 빈 배열로 반환하세요.`;

  const userMsg = `# 질문\n${question}\n\n# 참조 가능한 페이지\n${context}`;

  try {
    const resp = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userMsg }],
    });

    const text = resp.content
      .filter(
        (c: Anthropic.ContentBlock): c is Anthropic.TextBlock =>
          c.type === "text"
      )
      .map((c) => c.text)
      .join("\n");

    const sourcesMatch = text.match(/<sources>([\s\S]*?)<\/sources>/);
    let sources: { id: string; title: string }[] = [];
    if (sourcesMatch) {
      try {
        sources = JSON.parse(sourcesMatch[1]);
      } catch {
        sources = [];
      }
    }
    const answer = text.replace(/<sources>[\s\S]*?<\/sources>/, "").trim();

    return NextResponse.json({ answer, sources });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Claude API 호출 실패: ${message}` },
      { status: 500 }
    );
  }
}

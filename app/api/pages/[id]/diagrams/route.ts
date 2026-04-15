import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const diagrams = await prisma.diagram.findMany({
    where: { pageId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(diagrams);
}

const EMPTY_EXCALIDRAW = JSON.stringify({
  type: "excalidraw",
  version: 2,
  source: "myconfluence",
  elements: [],
  appState: { viewBackgroundColor: "#ffffff", gridSize: null },
  files: {},
});

export async function POST(req: Request, { params }: Params) {
  const body = await req.json().catch(() => ({}));
  const { title, data } = body ?? {};
  const page = await prisma.page.findUnique({ where: { id: params.id } });
  if (!page) {
    return NextResponse.json({ error: "page not found" }, { status: 404 });
  }
  const diagram = await prisma.diagram.create({
    data: {
      pageId: params.id,
      title: typeof title === "string" && title.trim() ? title : "새 다이어그램",
      data: typeof data === "string" && data.length > 0 ? data : EMPTY_EXCALIDRAW,
    },
  });
  return NextResponse.json(diagram, { status: 201 });
}

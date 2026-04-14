import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const page = await prisma.page.findUnique({ where: { id: params.id } });
  if (!page) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(page);
}

export async function PATCH(req: Request, { params }: Params) {
  const body = await req.json();
  const { title, content, parentId } = body ?? {};

  const page = await prisma.page.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
    },
  });
  return NextResponse.json(page);
}

export async function DELETE(_req: Request, { params }: Params) {
  await prisma.page.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

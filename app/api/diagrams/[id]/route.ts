import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const d = await prisma.diagram.findUnique({ where: { id: params.id } });
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(d);
}

export async function PATCH(req: Request, { params }: Params) {
  const body = await req.json().catch(() => ({}));
  const { title, data, preview } = body ?? {};
  const updated = await prisma.diagram.update({
    where: { id: params.id },
    data: {
      ...(typeof title === "string" ? { title } : {}),
      ...(typeof data === "string" ? { data } : {}),
      ...(typeof preview === "string" || preview === null ? { preview } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  await prisma.diagram.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

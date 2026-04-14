import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const pages = await prisma.page.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(pages);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, content, spaceId, parentId } = body ?? {};

  if (!title || !spaceId) {
    return NextResponse.json(
      { error: "title and spaceId are required" },
      { status: 400 }
    );
  }

  const page = await prisma.page.create({
    data: {
      title,
      content: content ?? "",
      spaceId,
      parentId: parentId ?? null,
    },
  });
  return NextResponse.json(page, { status: 201 });
}

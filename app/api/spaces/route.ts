import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const spaces = await prisma.space.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      pages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          parentId: true,
          spaceId: true,
          updatedAt: true,
        },
      },
    },
  });
  return NextResponse.json(spaces);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, description } = body ?? {};
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const space = await prisma.space.create({
    data: { name, description: description ?? null },
  });
  return NextResponse.json(space, { status: 201 });
}

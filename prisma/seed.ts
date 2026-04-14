import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.space.findFirst();
  if (existing) {
    console.log("Seed skipped: space already exists.");
    return;
  }

  const space = await prisma.space.create({
    data: {
      name: "Engineering",
      description: "엔지니어링 팀 공간",
    },
  });

  const root = await prisma.page.create({
    data: {
      title: "Welcome",
      content:
        "# Welcome to myConfluence\n\n이 위키는 Confluence 대체 POC입니다.\n\n- 왼쪽 트리에서 페이지를 선택하세요.\n- 오른쪽 AI 패널에 질문하면 저장된 페이지를 참조해 답변합니다.",
      spaceId: space.id,
    },
  });

  await prisma.page.create({
    data: {
      title: "Getting Started",
      content:
        "## 시작 가이드\n\n1. 새 페이지를 만들려면 사이드바의 **+ New Page** 버튼을 누르세요.\n2. 마크다운으로 작성하고 저장하면 AI 검색 대상에 포함됩니다.",
      spaceId: space.id,
      parentId: root.id,
    },
  });

  await prisma.page.create({
    data: {
      title: "Architecture",
      content:
        "## 아키텍처 개요\n\n- Next.js 14 App Router\n- Prisma + SQLite\n- Anthropic Claude API (claude-sonnet-4-6)\n- Tailwind CSS",
      spaceId: space.id,
    },
  });

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

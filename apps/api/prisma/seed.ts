import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WELCOME_MD = `# Welcome to DocSpace

DocSpace의 첫 시드 페이지입니다.

## 핵심 기능
- 페이지/스페이스 관리
- 실시간 공동 편집 (Yjs / 추후 Hocuspocus)
- 다이어그램 (Excalidraw)
- (예정) 검색, 버전 관리, 댓글

편집 버튼을 눌러 본문을 자유롭게 편집해보세요.
`;

const GETTING_STARTED_MD = `# Getting Started

DocSpace를 처음 사용하는 분을 위한 짧은 안내입니다.

1. 좌측 사이드바에서 페이지를 선택하면 본문이 열립니다.
2. 우상단 **편집 (E)** 버튼을 눌러 편집 모드로 들어가세요.
3. 본문은 자동 저장되며, 같은 페이지에 접속한 다른 사용자와 실시간으로 공동 편집할 수 있습니다.
4. 다이어그램은 본문 아래 **다이어그램** 섹션에서 추가합니다.
`;

async function main() {
  // 멱등 시드: Diagram → Page → Space 순으로 비우고 재생성
  await prisma.diagram.deleteMany();
  await prisma.page.deleteMany();
  await prisma.space.deleteMany();

  const space = await prisma.space.create({
    data: {
      name: 'Engineering',
      description: 'DocSpace 시작 시드 스페이스',
    },
  });

  await prisma.page.create({
    data: {
      title: 'Welcome to DocSpace',
      content: WELCOME_MD,
      spaceId: space.id,
    },
  });

  await prisma.page.create({
    data: {
      title: 'Getting Started',
      content: GETTING_STARTED_MD,
      spaceId: space.id,
    },
  });

  console.log('Seed completed: 1 space, 2 pages.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

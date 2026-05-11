export type PageNode = {
  id: string;
  title: string;
  parentId: string | null;
  spaceId: string;
  updatedAt: string;
};

export type SpaceWithPages = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  pages: PageNode[];
};

export type PageFull = {
  id: string;
  title: string;
  content: string;
  draftContent: string | null;
  spaceId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

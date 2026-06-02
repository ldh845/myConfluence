import { extractMentionIds } from './pages.service';

// Cycle 59 — extractMentionIds 헬퍼 단위 검증.
//   ProseMirror JSON content 안에서 mention 노드의 attrs.id 만 추출.

describe('extractMentionIds', () => {
  it('빈/null content → 빈 배열', () => {
    expect(extractMentionIds('')).toEqual([]);
    expect(extractMentionIds(null)).toEqual([]);
    expect(extractMentionIds(undefined)).toEqual([]);
  });

  it('markdown 텍스트 (옛 데이터) → 빈 배열 (자연 skip)', () => {
    expect(extractMentionIds('# 제목\n본문 @홍길동 텍스트')).toEqual([]);
    expect(extractMentionIds('@홍길동만 평문')).toEqual([]);
  });

  it('mention 노드 1개 → id 반환', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '안녕 ' },
            { type: 'mention', attrs: { id: 'u-1', label: '홍길동' } },
            { type: 'text', text: '님' },
          ],
        },
      ],
    });
    expect(extractMentionIds(doc)).toEqual(['u-1']);
  });

  it('중첩 구조 — heading/list/blockquote 안의 mention 도 추출', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [
            { type: 'mention', attrs: { id: 'u-1', label: '김' } },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'mention', attrs: { id: 'u-2', label: '박' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(extractMentionIds(doc).sort()).toEqual(['u-1', 'u-2']);
  });

  it('중복 mention — 중복 그대로 반환(호출 측에서 dedupe)', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: 'u-1', label: 'A' } },
            { type: 'mention', attrs: { id: 'u-1', label: 'A' } },
          ],
        },
      ],
    });
    expect(extractMentionIds(doc)).toEqual(['u-1', 'u-1']);
  });

  it('attrs.id 없는 mention 노드 → 무시', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'mention', attrs: {} }],
        },
      ],
    });
    expect(extractMentionIds(doc)).toEqual([]);
  });

  it('잘못된 JSON → 빈 배열 (예외 안 던짐)', () => {
    expect(extractMentionIds('{ broken json')).toEqual([]);
    expect(extractMentionIds('{}')).toEqual([]);
  });

  it('mention 외 다른 노드만 — 빈 배열', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '안녕' }] }],
    });
    expect(extractMentionIds(doc)).toEqual([]);
  });
});

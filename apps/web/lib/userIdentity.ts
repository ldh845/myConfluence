export type Identity = {
  id: string;
  name: string;
  color: string;
};

const STORAGE_KEY = "myconfluence.identity.v1";

const ANIMALS = [
  "고양이",
  "강아지",
  "여우",
  "펭귄",
  "너구리",
  "햄스터",
  "수달",
  "판다",
  "올빼미",
  "다람쥐",
  "토끼",
  "사슴",
];
const ADJECTIVES = [
  "귀여운",
  "용감한",
  "똑똑한",
  "장난꾸러기",
  "조용한",
  "빠른",
  "신비한",
  "부지런한",
  "즐거운",
  "멋진",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getIdentity(): Identity {
  if (typeof window === "undefined") {
    return { id: "ssr", name: "익명", color: "#999999" };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Identity;
      if (parsed?.id && parsed.name && parsed.color) return parsed;
    } catch {}
  }
  const suffix = Math.random().toString(16).slice(2, 5);
  const hue = Math.floor(Math.random() * 360);
  const identity: Identity = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? (crypto as Crypto).randomUUID()
        : `u-${Date.now()}-${suffix}`,
    name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}-${suffix}`,
    color: `hsl(${hue} 70% 45%)`,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

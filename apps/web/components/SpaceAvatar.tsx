// Cycle 74-G — 스페이스 아이콘 아바타(공유). icon 우선순위:
//   data:image URL → <img>, 짧은 문자(이모지) → 중립 배경 + 이모지,
//   없으면 이름 첫 글자 + 파란 배경(레거시 폴백). 목록/사이드바/검색/탑바 공통.
export default function SpaceAvatar({
  name,
  icon,
  size = 32,
  className = "",
}: {
  name: string;
  icon?: string | null;
  size?: number;
  className?: string;
}) {
  const base = `shrink-0 rounded flex items-center justify-center overflow-hidden ${className}`;
  const style = { width: size, height: size };

  if (icon && icon.startsWith("data:")) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={icon}
        alt=""
        className={`${base} object-cover`}
        style={style}
      />
    );
  }
  if (icon) {
    return (
      <div
        className={`${base} bg-[#f4f5f7] leading-none`}
        style={{ ...style, fontSize: Math.round(size * 0.58) }}
      >
        {icon}
      </div>
    );
  }
  return (
    <div
      className={`${base} bg-[#0052cc] text-white font-bold leading-none`}
      style={{ ...style, fontSize: Math.round(size * 0.44) }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

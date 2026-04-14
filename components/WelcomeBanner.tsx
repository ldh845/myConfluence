export default function WelcomeBanner({ spaceName }: { spaceName: string }) {
  return (
    <div className="mb-6 rounded bg-[#e3fcef] border border-[#abf5d1] px-4 py-3 flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-[#006644] text-white flex items-center justify-center text-sm shrink-0">
        ✓
      </div>
      <div>
        <div className="font-semibold text-[#006644] text-sm">
          새 공간에 오신 것을 환영합니다!
        </div>
        <div className="text-[13px] text-[#006644]/90 mt-0.5">
          {spaceName} 공간의 첫 페이지입니다. 좌측 트리에서 새 페이지를 추가하거나,
          오른쪽 AI 어시스턴트에게 공간의 내용을 질문해 보세요.
        </div>
      </div>
    </div>
  );
}

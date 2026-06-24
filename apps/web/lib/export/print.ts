// PDF 내보내기.
// 브라우저 인쇄 다이얼로그에 위임. 사용자가 "PDF로 저장" 옵션 선택.
// 인쇄 전에 사이드바·툴바·드롭다운 등 UI를 숨기고,
// 콘텐츠 영역만 풀폭으로 표시한 뒤 window.print() 호출.
// 인쇄 최적화는 globals.css의 @media print 블록이 담당.

export function openPrintDialog(): void {
  if (typeof window === "undefined") return;

  // 인쇄 전 열려있는 드롭다운·팝오버 닫기
  document.querySelectorAll('[data-state="open"]').forEach((el) => {
    try {
      (el as HTMLElement).click();
    } catch {
      // ignore
    }
  });

  // 열려있는 모든 드롭다운 메뉴 닫기 (커스텀 드롭다운)
  document.querySelectorAll('[data-radix-popper-content-wrapper], [role="menu"], [role="listbox"]').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.display = "none";
    }
  });

  // 인쇄 완료 후 복원을 위해 기존 스타일 저장
  const mainEl = document.querySelector("main");
  const asideEl = document.querySelector("aside");
  const headerEl = document.querySelector("header");
  const navEl = document.querySelector("nav");

  const savedStyles = new Map<HTMLElement, string>();

  function saveStyle(el: Element | null) {
    if (el instanceof HTMLElement) {
      savedStyles.set(el, el.getAttribute("style") || "");
    }
  }

  function restoreStyle(el: Element | null) {
    if (el instanceof HTMLElement && savedStyles.has(el)) {
      const saved = savedStyles.get(el)!;
      if (saved) {
        el.setAttribute("style", saved);
      } else {
        el.removeAttribute("style");
      }
    }
  }

  saveStyle(mainEl);
  saveStyle(asideEl);
  saveStyle(headerEl);
  saveStyle(navEl);

  // 인쇄 모드: UI 숨기고 콘텐츠만 풀폭
  if (asideEl instanceof HTMLElement) asideEl.style.display = "none";
  if (headerEl instanceof HTMLElement) headerEl.style.display = "none";
  if (navEl instanceof HTMLElement) navEl.style.display = "none";
  if (mainEl instanceof HTMLElement) {
    mainEl.style.width = "100%";
    mainEl.style.maxWidth = "none";
    mainEl.style.margin = "0";
    mainEl.style.padding = "40px";
  }

  // .no-print, data-print-hide 요소 숨기기 (액션 바, 툴바 등)
  const hideTargets = document.querySelectorAll(
    ".no-print, .editor-toolbar, [data-print-hide]"
  );
  hideTargets.forEach((el) => {
    if (el instanceof HTMLElement) {
      saveStyle(el);
      el.style.display = "none";
    }
  });

  // 인쇄 후 복원
  const restore = () => {
    restoreStyle(mainEl);
    restoreStyle(asideEl);
    restoreStyle(headerEl);
    restoreStyle(navEl);
    hideTargets.forEach((el) => {
      restoreStyle(el);
    });
    // 드롭다운 복원
    document
      .querySelectorAll('[data-radix-popper-content-wrapper], [role="menu"], [role="listbox"]')
      .forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.display = "";
        }
      });
    window.removeEventListener("afterprint", restore);
  };

  window.addEventListener("afterprint", restore);

  // 안전망: 5초 후에도 afterprint가 안 오면 복원
  setTimeout(() => {
    restore();
  }, 5000);

  // React 리렌더가 완료된 후 인쇄 (드롭다운이 닫히도록)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
    });
  });
}
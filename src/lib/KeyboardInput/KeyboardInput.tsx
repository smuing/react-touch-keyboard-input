import {
  ChangeEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Keyboard, KeyboardInstance } from "../Keyboard";
import type { KeyboardType } from "../keyboardLayout";
import * as hangul from "hangul-js";
import "./_KeyboardInput.css";

export interface KeyboardInputProps {
  className?: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: (value: string) => void;
  type: KeyboardType;
  initOpen?: boolean;
  enabled: boolean;
  disableLanguageSwitch?: boolean;
  primaryColor?: string;
  specialKeyColor?: string;
  topOffset?: number;
  inputType?: "text" | "email" | "number" | "password" | "search" | "tel";
  placeholder?: string;
}

export const KeyboardInput = ({
  className = "",
  value,
  onChange,
  onEnter,
  type,
  initOpen = false,
  enabled,
  disableLanguageSwitch = false,
  primaryColor = "#3AB8B7",
  specialKeyColor = "#B0B8C1",
  topOffset = 0,
  inputType = "text",
  placeholder,
}: KeyboardInputProps) => {
  const [isOpen, setIsOpen] = useState(initOpen);
  // 키보드 위치 style 객체
  const [position, setPosition] = useState({});
  const keyboardContainerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardRef = useRef<KeyboardInstance | null>(null);
  // onEnter(닫힐 때) 콜백에 넘길 최신 값
  const currentValueRef = useRef<string>(value || "");
  // DOM 커서 위치
  const lastSyncedCaretRef = useRef<number | null>(null);
  // 직전 value: effect 실행이 "실제 타이핑(값 변경)"인지 "열림(값 그대로)"인지 구분하기 위함
  const prevValueRef = useRef<string>(value || "");
  // wasOpenRef: 직전 열림 상태(열린 순간을 1회만 처리하기 위함)
  const wasOpenRef = useRef(false);
  // value 변경이 시스템/물리 키보드(네이티브 <input> 의 onChange) 경로인지
  const nativeChangeRef = useRef(false);
  // IME 조합 중 여부. 조합 중 selection 을 건드리면 조합이 깨지므로, 조합 중에는 커서/스크롤을 변경하지 않는다.
  const isComposingRef = useRef(false);
  // 커서 픽셀 위치 측정용
  const measureMirrorRef = useRef<HTMLDivElement | null>(null);

  // 커서 앞 텍스트의 px 측정
  const measureCaretX = (input: HTMLInputElement, caretIndex: number): number => {
    if (!measureMirrorRef.current) {
      const div = document.createElement("div");
      div.setAttribute("aria-hidden", "true");
      document.body.appendChild(div);
      measureMirrorRef.current = div;
    }
    const mirror = measureMirrorRef.current;
    const style = window.getComputedStyle(input);
    const s = mirror.style;
    s.position = "absolute";
    s.top = "0";
    s.left = "-9999px";
    s.visibility = "hidden";
    s.whiteSpace = "pre";
    s.pointerEvents = "none";
    s.fontStyle = style.fontStyle;
    s.fontVariant = style.fontVariant;
    s.fontWeight = style.fontWeight;
    s.fontSize = style.fontSize;
    s.fontFamily = style.fontFamily;
    s.letterSpacing = style.letterSpacing;
    s.textTransform = style.textTransform;
    s.textIndent = style.textIndent;

    mirror.textContent = input.value.slice(0, caretIndex);
    return mirror.getBoundingClientRect().width;
  };

  // 커서가 보이는 영역 안에 오도록 scrollLeft 를 직접 계산해 적용
  // (setSelectionRange 의 자동 스크롤은 플랫폼마다 불안정)
  const scrollCaretIntoView = (input: HTMLInputElement, caretIndex: number) => {
    const style = window.getComputedStyle(input);
    const caretX = measureCaretX(input, caretIndex); // 텍스트 시작(0) 기준 커서 x(px)

    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const availWidth = input.clientWidth - paddingLeft - paddingRight; // 보이는 실폭
    if (availWidth <= 0) return;
    const margin = parseFloat(style.fontSize) || 16; // 가장자리 여유

    // 보이는 구간 = [scrollLeft, scrollLeft + availWidth]
    if (caretX > input.scrollLeft + availWidth - margin) {
      input.scrollLeft = caretX - availWidth + margin; // 오른쪽 밖 → 당김
    } else if (caretX < input.scrollLeft + margin) {
      input.scrollLeft = Math.max(0, caretX - margin); // 왼쪽 밖 → 당김
    }
  };

  // transform 을 잠깐 토글해 레이어를 강제로 다시 그린다(blur+focus 대체)
  const forceWebViewRepaint = (input: HTMLInputElement) => {
    input.style.willChange = "transform";
    input.style.transform = "translateZ(0)";
    void input.offsetWidth; // 강제 reflow
    const clear = () => {
      input.style.transform = "";
      input.style.willChange = "";
    };
    // 다음 프레임에 원복(rAF 안 도는 환경 대비 setTimeout 폴백 병행)
    requestAnimationFrame(clear);
    setTimeout(clear, 50);
  };

  // 스크롤 + WebView 강제 리페인트
  const scrollCaretIntoViewRepaint = (
    input: HTMLInputElement,
    caretIndex: number,
  ) => {
    scrollCaretIntoView(input, caretIndex);
    forceWebViewRepaint(input);
  };

  // [인덱스 변환] 화면(조합) 인덱스 → 키보드 내부 커서 인덱스
  // 내부값이 화면과 같은 길이면(조합/ASCII) 그대로, 더 길면 분해 기준으로 환산
  const toKeyboardIndex = (live: string, domIndex: number): number => {
    const internal = keyboardRef.current?.getInput?.() ?? live;
    if (internal.length === live.length) return domIndex;
    return hangul.disassemble(live.slice(0, domIndex)).length;
  };

  // [인덱스 변환] 키보드 내부 커서 → 화면(조합) 인덱스. 커서 없으면 null
  const keyboardCaretToDomIndex = (): number | null => {
    const keyboard = keyboardRef.current;
    if (!keyboard?.getCaretPosition || !keyboard.getInput) return null;
    const caret = keyboard.getCaretPosition();
    if (caret == null) return null;
    const internal = keyboard.getInput() ?? "";
    const prefix = internal.slice(0, caret);
    return hangul.assemble(hangul.disassemble(prefix)).length;
  };

  // [DOM→키보드] 탭/드래그/클릭으로 옮긴 DOM 커서를 키보드 커서에 반영
  const syncCaretFromInput = () => {
    const input = inputRef.current;
    const keyboard = keyboardRef.current;
    if (!input || !keyboard?.setCaretPosition) return;
    if (document.activeElement !== input) return;

    const live = input.value;
    const domStart = input.selectionStart ?? live.length;
    const domEnd = input.selectionEnd ?? domStart;

    // 이미 맞춰둔 위치면 skip
    if (domStart === domEnd && domStart === lastSyncedCaretRef.current) return;

    keyboard.setCaretPosition(
      toKeyboardIndex(live, domStart),
      toKeyboardIndex(live, domEnd),
    );
    keyboard.activeInputElement = input;
    // 선택 영역이면 단일 위치가 없어 null
    lastSyncedCaretRef.current = domStart === domEnd ? domStart : null;
  };

  // [DOM→키보드, 열림 시] 탭한 위치를 키보드 커서로 심는다
  // DOM selection/scroll 은 안 건드림 → 포커스 시 끝으로 점프 방지
  const seedCaretFromTap = () => {
    const input = inputRef.current;
    const keyboard = keyboardRef.current;
    if (!input || !keyboard?.setCaretPosition) return;
    if (document.activeElement !== input) return; // 아직 포커스 전이면 onClick 백업이 처리
    const live = input.value;
    const domStart = input.selectionStart ?? live.length;
    const domEnd = input.selectionEnd ?? domStart;
    keyboard.setCaretPosition(
      toKeyboardIndex(live, domStart),
      toKeyboardIndex(live, domEnd),
    );
    keyboard.activeInputElement = input;
    lastSyncedCaretRef.current = domStart === domEnd ? domStart : null;
  };

  // [DOM→키보드, 시스템/물리 키보드 입력 후] DOM 커서가 권위 → 키보드 커서만 맞추고 스크롤
  const syncFromNative = () => {
    const input = inputRef.current;
    const keyboard = keyboardRef.current;
    if (!input || !keyboard?.setCaretPosition) return;
    const v = input.value;
    const domStart = input.selectionStart ?? v.length;
    const domEnd = input.selectionEnd ?? domStart;
    keyboard.setCaretPosition(
      toKeyboardIndex(v, domStart),
      toKeyboardIndex(v, domEnd),
    );
    keyboard.activeInputElement = input;
    lastSyncedCaretRef.current = domStart === domEnd ? domStart : null;
    scrollCaretIntoViewRepaint(input, domStart);
  };

  // 포커스 시 키보드를 열고, 현재 value(조합 정규화)를 키보드 내부값으로 넣는다
  const handleOpen = () => {
    if (!enabled) return;
    setIsOpen(true);

    // 키보드 value 한글 자음, 모음 조합
    if (keyboardRef.current) {
      keyboardRef.current.setInput(hangul.assemble(hangul.disassemble(value)));
    }
  };

  const handleClose = () => {
    onEnter?.(currentValueRef.current);
    setIsOpen(false);

    // Enter(mouseup) 후 발생하는 click이 하위 요소로 전달되지 않도록 차단
    const stopNextClick = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      document.removeEventListener("click", stopNextClick, true);
      clearTimeout(cleanupTimer);
    };
    document.addEventListener("click", stopNextClick, true);

    // stopNextClick이 해제되지 않고 다음 클릭을 삼키는 경우 방어 코드
    const cleanupTimer = setTimeout(() => {
      document.removeEventListener("click", stopNextClick, true);
    }, 0);
  };

  const handleOnChange = (value: string) => {
    onChange(value);
    currentValueRef.current = value;
  };

  const handleOnChangeInput = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target.value;
    onChange(input);
    currentValueRef.current = input;
    // 이 변경은 "네이티브 커서가 권위"임을 표시(effect 가 DOM 을 안 덮어쓰게)
    nativeChangeRef.current = true;
    // 키보드 내부값도 최신으로
    if (keyboardRef.current) {
      keyboardRef.current.setInput(input);
    }
  };

  // 열릴 때: 키보드 컨테이너 위치 계산 + 내부값 세팅 + 탭 위치 seed
  useEffect(() => {
    if (isOpen && keyboardContainerRef.current && triggerRef.current) {
      const tooltipEl = keyboardContainerRef.current;
      const triggerEl = triggerRef.current;

      const tooltipRect = tooltipEl.getBoundingClientRect();
      const triggerRect = triggerEl.getBoundingClientRect();

      const padding = 8;

      // 기본은 trigger 아래, 가로 가운데
      let top = triggerRect.bottom + padding + topOffset;
      let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;

      // 좌우로 넘치면 안쪽으로 당김
      if (left < padding) {
        left = padding;
      } else if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
      }

      // 아래 공간이 부족하면 위로
      if (top + tooltipRect.height > window.innerHeight - padding) {
        top = triggerRect.top - tooltipRect.height - padding;
      }

      setPosition({
        top: `${top}px`,
        left: `${left}px`,
      });
    }

    // 내부값 세팅 후 탭 위치를 커서로 심는다(setInput 이 커서를 null 로 리셋하므로 그 뒤,
    // selectionStart 확정+mount 대기 위해 microtask).
    if (isOpen && keyboardRef.current) {
      keyboardRef.current.setInput(value);
      queueMicrotask(seedCaretFromTap);
    }
  }, [isOpen]);

  // 열려 있는 동안 바깥을 누르면 닫는다.
  useEffect(() => {
    if (!isOpen) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const triggerEl = triggerRef.current;
      const keyboardEl = keyboardContainerRef.current;
      // 클릭 대상이 trigger/키보드 내부면 닫지 않음
      if (
        triggerEl?.contains(event.target as Node) ||
        keyboardEl?.contains(event.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isOpen]);

  // 드래그 등으로 커서가 움직이면(selectionchange) 키보드 커서에 반영(DOM→키보드).
  useEffect(() => {
    if (!isOpen) return;

    const handleSelectionChange = () => syncCaretFromInput();
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [isOpen]);

  // 커서/스크롤 동기화의 중심. 이벤트마다 권위가 달라 방향이 반대라 분기한다.
  // useLayoutEffect 로 페인트 전에 적용(브라우저 기본 스크롤보다 우선).
  useLayoutEffect(() => {
    if (!isOpen) {
      // 닫힘: 상태만 초기화
      wasOpenRef.current = false;
      prevValueRef.current = value;
      return;
    }
    const input = inputRef.current;
    if (!input) return;

    // 열린 직후인지 판별(1회만)
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;

    if (justOpened) {
      // [OPEN] 탭 위치가 권위 → DOM/스크롤 안 건드리고 키보드 커서만 seed
      prevValueRef.current = value;
      queueMicrotask(seedCaretFromTap);
      return;
    }

    // 타이핑 경로: 값이 실제로 바뀐 경우만(열림 flip 제외)
    if (value === prevValueRef.current) return;
    prevValueRef.current = value;

    // [TYPING-네이티브] DOM 커서가 권위 → selection 그대로, 키보드 커서만 맞추고 스크롤만
    if (nativeChangeRef.current) {
      nativeChangeRef.current = false;
      if (isComposingRef.current) return; // 조합 중이면 onCompositionEnd 에서 마무리
      syncFromNative();
      // 레이아웃/리페인트 지연 대비 스크롤만 재적용
      const r = requestAnimationFrame(() => {
        const i = inputRef.current;
        if (i) scrollCaretIntoViewRepaint(i, i.selectionStart ?? i.value.length);
      });
      const tm = setTimeout(() => {
        const i = inputRef.current;
        if (i) scrollCaretIntoViewRepaint(i, i.selectionStart ?? i.value.length);
      }, 50);
      return () => {
        cancelAnimationFrame(r);
        clearTimeout(tm);
      };
    }

    // [TYPING-온스크린] 키보드 커서가 권위 → DOM 커서로 옮기고 스크롤
    const domCaret = keyboardCaretToDomIndex();
    const caret = domCaret == null ? input.value.length : domCaret;

    // 맞춰둔 위치 기록 → setSelectionRange 의 selectionchange 에코 무시용
    lastSyncedCaretRef.current = caret;

    const applyCaret = () => {
      try {
        // 같은 위치로만 setSelectionRange 하면 WebView 가 "변경 없음"으로 보고 리페인트를 생략.
        // 한 칸 옆으로 갔다 되돌려 "변경됨"으로 인식시킨다(0 은 맨 앞 깜빡임 때문에 회피).
        const nudge = caret > 0 ? caret - 1 : caret;
        input.setSelectionRange(nudge, nudge);
        input.setSelectionRange(caret, caret);
      } catch {
        // type="number"/"email" 등 selectionRange 미지원 input 방어
      }
      scrollCaretIntoViewRepaint(input, caret);
    };

    applyCaret();
    // 레이아웃 지연 대비 스크롤만 재적용(setSelectionRange 는 안 함 → 끝으로 덮어쓰기 방지)
    const raf = requestAnimationFrame(() => scrollCaretIntoViewRepaint(input, caret));
    const t = setTimeout(() => scrollCaretIntoViewRepaint(input, caret), 50);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [value, isOpen]);

  useEffect(() => {
    return () => {
      setIsOpen(false);
      if (measureMirrorRef.current) {
        measureMirrorRef.current.remove();
        measureMirrorRef.current = null;
      }
    };
  }, []);

  return (
    <div className="inline-keyboard__trigger-wrap" ref={triggerRef}>
      <input
        className={className}
        ref={inputRef}
        value={value}
        onChange={handleOnChangeInput}
        disabled={!enabled}
        inputMode="none" // OS 가상 키보드 비활성화
        onFocus={handleOpen}
        // 탭/클릭/키업/선택 변경 시 현재 DOM 커서를 키보드 커서로 반영
        onClick={syncCaretFromInput}
        onSelect={syncCaretFromInput}
        onKeyUp={syncCaretFromInput}
        // IME 조합 동안에는 selection을 건드리지 않도록 플래그만 토글
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          // 조합 확정 후: 키보드 내부 값을 최종 값으로 맞추고 네이티브 커서 동기화
          const el = inputRef.current;
          if (el && keyboardRef.current) {
            keyboardRef.current.setInput(el.value);
          }
          syncFromNative();
        }}
        type={inputType}
        placeholder={placeholder}
      />
      {isOpen && enabled && (
        <div
          className="inline-keyboard__container"
          ref={keyboardContainerRef}
          style={position}
        >
          <Keyboard
            keyboardRef={keyboardRef}
            onChange={handleOnChange}
            type={type}
            disableLanguageSwitch={disableLanguageSwitch}
            onEnter={handleClose}
            primaryColor={primaryColor}
            specialKeyColor={specialKeyColor}
          />
        </div>
      )}
    </div>
  );
};

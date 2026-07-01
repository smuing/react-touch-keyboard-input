import { MutableRefObject, useCallback, useEffect, useMemo, useState } from "react";
import KeyboardReact from "react-simple-keyboard";
import * as hangul from "hangul-js";
import { getCustomKeyboardLayout, type KeyboardType, LayoutDisplay, NumpadButtonTheme } from "./keyboardLayout";
import "./_Keyboard.css";

export interface KeyboardInstance {
  setInput(input: string): void;
  getInput?: () => string;
  getCaretPosition?: () => number | null;
  setCaretPosition?: (
    position: number | null,
    endPosition?: number | null,
  ) => void;
  activeInputElement?: HTMLInputElement | HTMLTextAreaElement | null;
}

export interface KeyboardProps {
  onChange: (value: string) => void;
  type: KeyboardType;
  // 한/영 전환 disable
  disableLanguageSwitch?: boolean;
  onEnter: () => void;
  key?: string;
  initCaps?: boolean;
  keyboardRef?: MutableRefObject<KeyboardInstance | null>;
  primaryColor?: string;
  specialKeyColor?: string;
}

export const Keyboard = ({
  key,
  onChange,
  type,
  disableLanguageSwitch = false,
  onEnter,
  initCaps = false,
  keyboardRef,
  primaryColor = "#3AB8B7",
  specialKeyColor = "#B0B8C1",
}: KeyboardProps) => {
  const [language, setLanguage] = useState(type);
  const layout = useMemo(
    () => getCustomKeyboardLayout(language, !disableLanguageSwitch),
    [language, disableLanguageSwitch],
  );
  const [layoutName, setLayoutName] = useState<"default" | "shift">("default");
  const [isCaps, setIsCaps] = useState(initCaps);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (key === "") return;

      // 엔터
      if (key === "{enter}") {
        return;
      }

      // 쉬프트
      if (key === "{shift}") {
        setLayoutName("shift");
        return;
      }
      if (key === "{shifted}") {
        if (isCaps) return;
        setLayoutName("default");
        return;
      }

      // 캡스
      if (key === "{caps}") {
        setLayoutName(isCaps ? "default" : "shift");
        setIsCaps(!isCaps);
        return;
      }

      // 한 / 영
      if (key === "{lang}") {
        if (disableLanguageSwitch) return;
        setLanguage((prev) => (prev === "ko" ? "en" : "ko"));
        return;
      }
    },
    [disableLanguageSwitch, isCaps, onChange],
  );

  const handleKeyReleased = useCallback(
    (key: string) => {
      // 입력 후 쉬프트 해제
      if (!["{shift}", "{shifted}", "{caps}", "{lang}", "{bksp}", "{space}"].includes(key) && !isCaps) {
        setLayoutName("default");
      }

      // 엔터
      if (key === "{enter}") {
        onEnter();
        return;
      }
    },
    [isCaps],
  );

  const handleOnChange = useCallback(
    (input: string) => {
      // 한글 자음, 모음 조합 (화면에 보이는 값만)
      const result = hangul.assemble(hangul.disassemble(input));
      onChange(result);

      // 라이브러리 내부값은 자모 단위("ㅎㅏ")로 쌓이는데 화면값은 조합("하")
      // 인덱스 공간이 어긋나 한글에서 커서 위치가 깨진다.
      // 매 입력 후 내부값을 조합된 값으로 정규화해 내부=화면=DOM 인덱스를 항상 일치시킨다.
      // (라이브러리의 현재 처리가 끝난 뒤 실행되도록 microtask로 지연)
      if (result !== input && keyboardRef?.current) {
        const kb = keyboardRef.current;
        const caretJamo = kb.getCaretPosition?.();
        const caretAssembled =
          caretJamo == null
            ? null
            : hangul.assemble(hangul.disassemble(input.slice(0, caretJamo)))
                .length;
        queueMicrotask(() => {
          kb.setInput?.(result);
          if (caretAssembled != null) {
            kb.setCaretPosition?.(caretAssembled, caretAssembled);
          }
        });
      }
    },
    [onChange, keyboardRef],
  );

  useEffect(() => {
    setLayoutName(!initCaps ? "default" : "shift");
  }, [initCaps]);

  useEffect(() => {
    const keyboard = document.querySelector('.custom-keyboard');
    if (keyboard) {
      (keyboard as HTMLElement).style.setProperty('--primary-color', primaryColor);
      (keyboard as HTMLElement).style.setProperty('--special-key-color', specialKeyColor);
    }
  }, [primaryColor, specialKeyColor]);

  return (
    <KeyboardReact
      keyboardRef={(r) => {
        if (keyboardRef) keyboardRef.current = r;
      }}
      key={key}
      theme={`custom-keyboard custom-keyboard--${type}`}
      layoutName={layoutName}
      layout={layout}
      display={LayoutDisplay}
      onKeyPress={handleKeyPress}
      onChange={handleOnChange}
      onKeyReleased={handleKeyReleased}
      buttonTheme={type === "numpad" ? NumpadButtonTheme : undefined}
      // 키 탭 시 input 포커스가 풀리지 않도록(커서 유지/스크롤 추적용)
      preventMouseDownDefault={true}
    />
  );
};

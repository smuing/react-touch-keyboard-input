import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardInstance } from "../Keyboard";
import type { KeyboardType } from "../keyboardLayout";
import * as hangul from "hangul-js";
import "./_KeyboardInput.css";

export interface KeyboardInputProps {
  className?: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  type: KeyboardType;
  initOpen?: boolean;
  enabled: boolean;
  disableLanguageSwitch?: boolean;
  primaryColor?: string;
  specialKeyColor?: string;
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
}: KeyboardInputProps) => {
  const [isOpen, setIsOpen] = useState(initOpen);
  // 키보드 위치 style 객체
  const [position, setPosition] = useState({});
  const keyboardContainerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardRef = useRef<KeyboardInstance | null>(null);

  const handleOpen = () => {
    if (!enabled) return;
    setIsOpen(true);

    // 키보드 value 한글 자음, 모음 조합
    if (keyboardRef.current) {
      keyboardRef.current.setInput(hangul.assemble(hangul.disassemble(value)));
    }
  };

  const handleClose = () => {
    onEnter?.();
    setIsOpen(false);
  };

  const handleOnChange = (value: string) => {
    onChange(value);
  };

  const handleOnChangeInput = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target.value;
    onChange(input);
    // 키보드 value
    if (keyboardRef.current) {
      keyboardRef.current.setInput(input);
    }
  };

  useEffect(() => {
    if (isOpen && keyboardContainerRef.current && triggerRef.current) {
      const tooltipEl = keyboardContainerRef.current;
      const triggerEl = triggerRef.current;

      const tooltipRect = tooltipEl.getBoundingClientRect();
      const triggerRect = triggerEl.getBoundingClientRect();

      const padding = 8;

      // 기본 위치: 아래
      let top = triggerRect.bottom + padding;
      let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;

      // 화면 넘침 방지 (좌우)
      if (left < padding) {
        left = padding;
      } else if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
      }

      // 아래 공간이 부족한 경우 위로 표시
      if (top + tooltipRect.height > window.innerHeight - padding) {
        top = triggerRect.top - tooltipRect.height - padding;
      }

      setPosition({
        top: `${top}px`,
        left: `${left}px`,
      });
    }

    // 키보드 value 초기값 세팅
    if (isOpen && keyboardRef.current) {
      keyboardRef.current.setInput(value);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleDocumentClick = (event: MouseEvent) => {
      // 클릭된 요소가 triggerRef, keyboardContainerRef 내부면 무시
      const triggerEl = triggerRef.current;
      const keyboardEl = keyboardContainerRef.current;
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

  useEffect(() => {
    return () => {
      setIsOpen(false);
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
        inputMode="none"
        onFocus={handleOpen}
      />
      {isOpen && (
        <div className="inline-keyboard__container" ref={keyboardContainerRef} style={position}>
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

export type KeyboardType = "numpad" | "ko" | "en" | "enNum";

export function getCustomKeyboardLayout(type: KeyboardType, showLangBtn: boolean) {
  const langBtn = showLangBtn ? " {lang}" : "";

  if (type === "numpad") {
    return {
      default: ["1 2 3 -", "4 5 6 {space}", "7 8 9 {bksp}", " 0  {enter}"],
      shift: ["1 2 3 -", "4 5 6 {space}", "7 8 9 {bksp}", " 0  {enter}"],
    };
  }

  if (type === "ko") {
    return {
      default: [
        "` 1 2 3 4 5 6 7 8 9 0 - =",
        "ㅂ ㅈ ㄷ ㄱ ㅅ ㅛ ㅕ ㅑ ㅐ ㅔ [ ] ₩",
        "{caps} ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ ; ' {bksp}",
        "{shift} ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ , . / {enter}",
        `{space}${langBtn}`,
      ],
      shift: [
        "~ ! @ # $ % ^ & * ( ) _ +",
        "ㅃ ㅉ ㄸ ㄲ ㅆ ㅛ ㅕ ㅑ ㅒ ㅖ { } |",
        '{caps} ㅁ ㄴ ㅇ ㄹ ㅎ ㅗ ㅓ ㅏ ㅣ : " {bksp}',
        "{shifted} ㅋ ㅌ ㅊ ㅍ ㅠ ㅜ ㅡ < > ? {enter}",
        `{space}${langBtn}`,
      ],
    };
  }

  if (type === "en") {
    return {
      default: [
        "` 1 2 3 4 5 6 7 8 9 0 - =",
        "q w e r t y u i o p [ ] ₩",
        "{caps} a s d f g h j k l ; ' {bksp}",
        "{shift} z x c v b n m , . / {enter}",
        `{space}${langBtn}`,
      ],
      shift: [
        "~ ! @ # $ % ^ & * ( ) _ +",
        "Q W E R T Y U I O P { } |",
        '{caps} A S D F G H J K L : " {bksp}',
        "{shifted} Z X C V B N M < > ? {enter}",
        `{space}${langBtn}`,
      ],
    };
  }

  if (type === "enNum") {
    return {
      default: [
        "` 1 2 3 4 5 6 7 8 9 0 - =",
        "q w e r t y u i o p [ ] ₩",
        "{caps} a s d f g h j k l ; ' {bksp}",
        "{shift} z x c v b n m , . / {enter}",
        `{space}${langBtn}`,
      ],
      shift: [
        "` 1 2 3 4 5 6 7 8 9 0 - =",
        "Q W E R T Y U I O P { } |",
        '{caps} A S D F G H J K L : " {bksp}',
        "{shifted} Z X C V B N M < > ? {enter}",
        `{space}${langBtn}`,
      ],
    };
  }
}

export const LayoutDisplay = {
  "{bksp}": "⌫",
  "{enter}": "{enter}",
  "{caps}": "CAPS",
  "{shift}": "{shift}",
  "{shifted}": "{shifted}",
  "{space}": " ",
  "{lang}": "한 / 영",
};

export const NumpadButtonTheme = [
  {
    class: "special-key",
    buttons: "- {space}",
  },
];

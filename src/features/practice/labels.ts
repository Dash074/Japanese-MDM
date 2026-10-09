import type { ErrorType } from "../../core/types";
import type { GuideLevel } from "../../lib/progress";

export const ERROR_LABEL: Record<ErrorType, string> = {
  order: "書き順 Stroke order",
  direction: "方向 Direction",
  count: "画数 Stroke count",
  proportion: "長さ Proportion",
  position: "位置 Position",
  ending: "止め・跳ね・払い Ending",
  confusion: "混同 Look-alike",
};

export const LEVEL_LABEL: Record<GuideLevel, { jp: string; en: string; help: string }> = {
  trace: { jp: "なぞる", en: "Trace", help: "Write over the faint model." },
  hint: { jp: "ヒント", en: "Hint", help: "Only the first stroke is shown." },
  blank: { jp: "白紙", en: "Blank", help: "Copy the kanji shown in the prompt." },
  recall: { jp: "想起", en: "Recall", help: "Write it from its meaning and reading." },
};

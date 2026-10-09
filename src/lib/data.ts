import { useEffect, useState } from "react";
import type { KanjiData } from "../core/types";

let cache: Promise<KanjiData> | null = null;
export const loadKanjiData = () => (cache ??= fetch("/data/kanji.json").then((r) => r.json()));

export function useKanjiData(): KanjiData | null {
  const [data, setData] = useState<KanjiData | null>(null);
  useEffect(() => {
    loadKanjiData().then(setData);
  }, []);
  return data;
}

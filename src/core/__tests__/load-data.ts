import { readFileSync } from "node:fs";
import type { KanjiData } from "../types";

export const DATA: KanjiData = JSON.parse(readFileSync("public/data/kanji.json", "utf8"));

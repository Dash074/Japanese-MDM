import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useSearchParams } from "react-router-dom";
import { Home } from "./features/home/Home";
import { KanjiDetail } from "./features/library/KanjiDetail";
import { Library } from "./features/library/Library";
import { Drill } from "./features/drill/Drill";
import { Practice } from "./features/practice/Practice";
import { ProgressPage } from "./features/progress/ProgressPage";
import { Quiz } from "./features/quiz/Quiz";
import { Review } from "./features/review/Review";
import { Settings } from "./features/settings/Settings";
import { useKanjiData } from "./lib/data";
import { useProgress } from "./lib/progress";
import { startSync } from "./lib/sync";

const NAV = [
  { to: "/", jp: "今日", en: "Today" },
  { to: "/review", jp: "復習", en: "Review" },
  { to: "/library", jp: "漢字帳", en: "Kanji" },
  { to: "/progress", jp: "成績", en: "Progress" },
];

type Theme = "system" | "light" | "dark";
const THEMES: Theme[] = ["system", "light", "dark"];

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("fude-theme") as Theme) || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("fude-theme", theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  return [theme, () => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])];
}

export function App() {
  const data = useKanjiData();
  const [theme, cycleTheme] = useTheme();
  useEffect(startSync, []);
  useStudyEnrolment();
  return (
    <div className="min-h-screen">
      <header className="border-b border-grid">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-shu font-mincho text-xl font-bold text-on-shu">筆</span>
            <span className="hidden font-mincho text-lg font-bold tracking-wide sm:inline">Fude</span>
          </NavLink>
          <nav className="flex items-stretch gap-0.5 sm:gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `flex flex-col items-center rounded-b-sm border-t-[3px] px-2 pb-1 sm:px-3 pt-1.5 text-center transition ${
                    isActive ? "border-shu bg-surface text-ink" : "border-transparent text-ink-muted hover:text-ink"
                  }`
                }
              >
                <span className="font-mincho text-sm font-bold leading-tight">{n.jp}</span>
                <span className="text-[10px] uppercase tracking-widest">{n.en}</span>
              </NavLink>
            ))}
            <button
              onClick={cycleTheme}
              className="px-1.5 font-mincho text-sm text-ink-muted hover:text-ink"
              title={`Theme: ${theme}`}
              aria-label={`Theme: ${theme}`}
            >
              {theme === "dark" ? "夜" : theme === "light" ? "昼" : "自"}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        {!data ? (
          <p className="py-20 text-center font-mincho text-ink-muted">
            墨を磨っています… <span className="text-sm">(loading)</span>
          </p>
        ) : (
          <Routes>
            <Route path="/" element={<Home data={data} />} />
            <Route path="/library" element={<Library data={data} />} />
            <Route path="/kanji/:char" element={<KanjiDetail data={data} />} />
            <Route path="/practice" element={<Practice data={data} />} />
            <Route path="/practice/:char" element={<Practice data={data} />} />
            <Route path="/review" element={<Review data={data} />} />
            <Route path="/drill" element={<Drill data={data} />} />
            <Route path="/progress" element={<ProgressPage data={data} />} />
            <Route path="/quiz" element={<Quiz data={data} />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<p className="py-20 text-center font-mincho text-xl">迷子 — page not found</p>} />
          </Routes>
        )}
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 pt-4 text-xs text-ink-muted">
        Stroke data: KanjiVG © Ulrich Apel (CC BY-SA 3.0) · Dictionary: KANJIDIC2 © EDRDG (CC BY-SA 4.0)
      </footer>
    </div>
  );
}

/** Enrol this browser in a study group via a link: /?study=control or /?study=full (implementation.md §7.5). */
function useStudyEnrolment() {
  const [params, setParams] = useSearchParams();
  const setSettings = useProgress((s) => s.setSettings);
  useEffect(() => {
    const g = params.get("study");
    if (g === "control" || g === "full") {
      setSettings({ study: g });
      params.delete("study");
      setParams(params, { replace: true });
    }
  }, [params, setParams, setSettings]);
}

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { draw, fresh, strokesOf } from "./helpers";

/** WCAG 2.1 AA audit of every screen, both themes (NFR-06). */
const SCREENS = ["/", "/review", "/library", "/kanji/右", "/practice/右", "/quiz?seed=1", "/progress", "/settings"];

test.beforeEach(async ({ page }) => fresh(page));

for (const theme of ["light", "dark"] as const)
  test(`axe: no WCAG A/AA violations (${theme})`, async ({ page }) => {
    test.slow();
    await page.addInitScript((t) => localStorage.setItem("fude-theme", t), theme);
    const report: string[] = [];
    const audit = async (label: string) => {
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations)
        report.push(`${label} · ${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " — " + n.failureSummary?.split("\n")[1]?.trim()).join("\n    ")}`);
    };
    for (const path of SCREENS) {
      await page.goto(path);
      await page.waitForTimeout(400);
      await audit(path);
    }
    // Result panel with errors.
    await page.goto("/practice/右");
    const s = strokesOf("右");
    await draw(page, [s[1], s[0], ...s.slice(2)]);
    await page.getByRole("button", { name: /Check/ }).click();
    await audit("result");
    expect(report, report.join("\n")).toEqual([]);
  });

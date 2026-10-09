/** Renders the 筆 app icon to PNG (192, 512, maskable 512) with the real Shippori Mincho font. Run once: npx tsx scripts/make-icons.ts */
import { chromium } from "@playwright/test";

const html = (size: number, pad: number) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@700&text=筆&display=block" rel="stylesheet">
<style>html,body{margin:0}div{width:${size}px;height:${size}px;background:#b5391f;display:grid;place-items:center;
font:700 ${Math.round((size - 2 * pad) * 0.66)}px "Shippori Mincho",serif;color:#fbf7ee;line-height:1}</style></head>
<body><div>筆</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [["icon-192.png", 192, 0], ["icon-512.png", 512, 0], ["icon-maskable-512.png", 512, 64]] as const) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html(size, pad));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `public/${name}`, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log("icons written");

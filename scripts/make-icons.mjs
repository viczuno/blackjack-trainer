// Renders the PWA icons from inline SVG with Playwright's Chromium.
// Usage: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${pad ? '#145A3A' : '#0A1210'}"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - pad * 2) / 512})">
    <rect x="16" y="16" width="480" height="480" rx="${pad ? 0 : 96}" fill="#145A3A"/>
    <rect x="40" y="40" width="432" height="432" rx="80" fill="none" stroke="#E9C46A" stroke-width="18"/>
    <g transform="rotate(-10 256 270)">
      <rect x="150" y="120" width="180" height="250" rx="22" fill="#FBFAF6"/>
      <text x="196" y="215" font-family="Arial, Helvetica, sans-serif" font-size="90" font-weight="800" fill="#D23A3A" text-anchor="middle">A</text>
    </g>
    <g transform="rotate(10 256 270)">
      <rect x="220" y="150" width="180" height="250" rx="22" fill="#FBFAF6" stroke="#0A1210" stroke-width="4"/>
      <text x="310" y="330" font-family="Arial, Helvetica, sans-serif" font-size="140" font-weight="800" fill="#14171A" text-anchor="middle">K</text>
    </g>
    <text x="256" y="462" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="800" fill="#E9C46A" text-anchor="middle">21</text>
  </g>
</svg>`;

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, pad] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 56],
  ['apple-touch-icon.png', 180, 0],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:#0A1210}svg{width:${size}px;height:${size}px;display:block}</style>${svg(pad)}`,
  );
  await page.screenshot({ path: new URL(file, out).pathname });
}
await browser.close();
console.log('icons written to public/icons/');

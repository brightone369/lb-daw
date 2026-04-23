import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const width = 960;
const height = 540;
const frameCount = 24;
const rootDir = new URL('..', import.meta.url);
const tempDir = new URL('../tmp/late-night-tokio-gif', import.meta.url);
const outputDir = new URL('../public/generated', import.meta.url);
const outputFile = new URL('../public/generated/late-night-tokio-project.gif', import.meta.url);

mkdirSync(tempDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });
rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const lerpColor = (from, to, amount) => {
  const parse = (hex) => hex.match(/[a-f0-9]{2}/gi).map((part) => Number.parseInt(part, 16));
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const mix = (a, b) => Math.round(a + (b - a) * amount)
    .toString(16)
    .padStart(2, '0');

  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`;
};

const buildingBands = [
  {
    yBase: 365,
    color: '#0d1330',
    buildings: [
      [0, 140, 70],
      [86, 120, 100],
      [230, 112, 92],
      [370, 146, 114],
      [548, 126, 86],
      [710, 118, 96],
      [852, 108, 118],
    ],
  },
  {
    yBase: 410,
    color: '#11193c',
    buildings: [
      [34, 182, 88],
      [178, 136, 64],
      [332, 192, 102],
      [492, 158, 70],
      [650, 172, 88],
      [804, 148, 74],
    ],
  },
];

const starPositions = [
  [86, 68, 1.5],
  [176, 122, 1.2],
  [294, 88, 1.7],
  [386, 146, 1.3],
  [524, 72, 1.4],
  [658, 110, 1.2],
  [798, 84, 1.6],
  [874, 136, 1.1],
];

const makeWindows = (x, yBase, buildingWidth, buildingHeight, frameIndex, bandIndex) => {
  const top = yBase - buildingHeight + 18;
  const left = x + 10;
  const right = x + buildingWidth - 10;
  const bottom = yBase - 18;
  let svg = '';

  for (let wx = left; wx < right; wx += 18) {
    for (let wy = top; wy < bottom; wy += 18) {
      const pulse = (wx * 13 + wy * 7 + frameIndex * 20 + bandIndex * 31) % 100;
      const lightOn = pulse > 42;
      const fill = lightOn ? (pulse > 82 ? '#ff7bd5' : '#ffd36a') : '#182347';
      const opacity = lightOn ? 0.95 : 0.5;
      svg += `<rect x="${wx}" y="${wy}" width="8" height="10" rx="2" fill="${fill}" opacity="${opacity}" />`;
    }
  }

  return svg;
};

for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
  const progress = frameIndex / frameCount;
  const skyShift = (Math.sin(progress * Math.PI * 2) + 1) / 2;
  const skyTop = lerpColor('140a2f', '20104a', skyShift);
  const skyMid = lerpColor('24104a', '3b1664', skyShift);
  const skyBottom = lerpColor('ff6f7d', 'ff8f66', clamp(skyShift * 0.75, 0, 1));
  const trainX = -220 + progress * (width + 340);
  const trainGlowX = trainX + 100;
  const shimmer = 0.75 + Math.sin(progress * Math.PI * 2) * 0.18;
  const signPulse = 0.68 + Math.sin(progress * Math.PI * 4) * 0.14;

  const buildings = buildingBands
    .map(
      (band, bandIndex) =>
        band.buildings
          .map(([x, buildingWidth, buildingHeight], index) => {
            const signColor = index % 2 === 0 ? '#56f0ff' : '#ff69c8';
            const signWidth = Math.min(64, buildingWidth - 20);
            const signX = x + 10;
            const signY = band.yBase - buildingHeight + 28;

            return `
              <rect x="${x}" y="${band.yBase - buildingHeight}" width="${buildingWidth}" height="${buildingHeight}" fill="${band.color}" />
              ${makeWindows(x, band.yBase, buildingWidth, buildingHeight, frameIndex, bandIndex)}
              <rect x="${signX}" y="${signY}" width="${signWidth}" height="12" rx="6" fill="${signColor}" opacity="${signPulse}" />
            `;
          })
          .join(''),
    )
    .join('');

  const stars = starPositions
    .map(([x, y, radius], index) => {
      const twinkle = 0.45 + (((frameIndex + index * 3) % frameCount) / frameCount) * 0.5;
      return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#fff5de" opacity="${twinkle.toFixed(2)}" />`;
    })
    .join('');

  const roadStripeOffset = (frameIndex * 26) % 140;
  const roadStripes = Array.from({ length: 10 }, (_, index) => {
    const x = index * 140 - roadStripeOffset;
    return `<rect x="${x}" y="472" width="72" height="6" rx="3" fill="#ffe07a" opacity="0.9" />`;
  }).join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${skyTop}" />
          <stop offset="54%" stop-color="${skyMid}" />
          <stop offset="100%" stop-color="${skyBottom}" />
        </linearGradient>
        <linearGradient id="roadGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff6bac" stop-opacity="0.38" />
          <stop offset="100%" stop-color="#000814" stop-opacity="0" />
        </linearGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="12" result="blur" />
        </filter>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#sky)" />
      <circle cx="774" cy="102" r="58" fill="#ffe8c7" opacity="${(0.8 + skyShift * 0.16).toFixed(2)}" />
      <circle cx="774" cy="102" r="76" fill="#ffd6a6" opacity="0.14" filter="url(#softGlow)" />
      ${stars}
      <rect x="0" y="266" width="${width}" height="110" fill="#1a1737" opacity="0.22" />
      ${buildings}
      <rect x="0" y="432" width="${width}" height="108" fill="#0a0d18" />
      <rect x="0" y="432" width="${width}" height="32" fill="url(#roadGlow)" />
      <rect x="${trainGlowX}" y="374" width="116" height="18" fill="#4eefff" opacity="0.22" filter="url(#softGlow)" />
      <rect x="${trainX}" y="378" width="176" height="44" rx="10" fill="#b0fff6" opacity="0.92" />
      <rect x="${trainX + 14}" y="388" width="30" height="18" rx="4" fill="#10182f" />
      <rect x="${trainX + 52}" y="388" width="92" height="18" rx="4" fill="#22375c" />
      <rect x="${trainX + 150}" y="388" width="12" height="18" rx="4" fill="#10182f" />
      <rect x="${trainX + 8}" y="410" width="160" height="4" rx="2" fill="#ff6bcf" opacity="${shimmer.toFixed(2)}" />
      <rect x="0" y="422" width="${width}" height="5" fill="#2a345c" />
      <rect x="0" y="470" width="${width}" height="14" fill="#101722" />
      ${roadStripes}
      <rect x="68" y="78" width="210" height="10" rx="5" fill="#ffe8ff" opacity="0.92" />
      <rect x="68" y="102" width="162" height="6" rx="3" fill="#70f7ff" opacity="0.84" />
      <rect x="68" y="116" width="126" height="6" rx="3" fill="#ff82d2" opacity="0.8" />
      <rect width="${width}" height="${height}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" />
      ${Array.from({ length: 28 }, (_, index) => {
        const y = index * 20;
        return `<rect x="0" y="${y}" width="${width}" height="2" fill="#ffffff" opacity="${index % 2 === 0 ? 0.035 : 0.015}" />`;
      }).join('')}
    </svg>
  `;

  const svgPath = join(tempDir.pathname, `frame-${String(frameIndex).padStart(2, '0')}.svg`);
  const pngPath = join(tempDir.pathname, `frame-${String(frameIndex).padStart(2, '0')}.png`);
  writeFileSync(svgPath, svg.trim());
  execFileSync('magick', [svgPath, '-resize', `${width}x${height}`, pngPath], { stdio: 'inherit' });
}

const pngFrames = readdirSync(tempDir.pathname)
  .filter((fileName) => fileName.endsWith('.png'))
  .sort()
  .map((fileName) => join(tempDir.pathname, fileName));

execFileSync('magick', [...pngFrames, '-delay', '7', '-loop', '0', '-layers', 'Optimize', outputFile.pathname], {
  stdio: 'inherit',
});

console.log(`Generated ${outputFile.pathname}`);

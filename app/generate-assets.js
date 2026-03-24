const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, 'assets');

function drawMoonSun(ctx, cx, cy, radius, variant) {
  // Sun - warm coral/orange gradient
  const sunX = cx + radius * 0.22;
  const sunY = cy - radius * 0.1;
  const sunR = radius * 0.38;

  // Sun glow
  const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR * 1.6);
  sunGlow.addColorStop(0, 'rgba(232,133,91,0.3)');
  sunGlow.addColorStop(1, 'rgba(232,133,91,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Sun rays
  ctx.save();
  ctx.translate(sunX, sunY);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, sunR * 1.05);
    ctx.lineTo(sunR * 0.06, sunR * 1.35);
    ctx.lineTo(-sunR * 0.06, sunR * 1.35);
    ctx.closePath();
    ctx.fillStyle = '#e8855b';
    ctx.fill();
  }
  ctx.restore();

  // Sun body
  const sunGrad = ctx.createRadialGradient(sunX - sunR * 0.2, sunY - sunR * 0.2, 0, sunX, sunY, sunR);
  sunGrad.addColorStop(0, '#f5a97f');
  sunGrad.addColorStop(0.5, '#e8855b');
  sunGrad.addColorStop(1, '#d4784e');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Sun inner highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.arc(sunX - sunR * 0.15, sunY - sunR * 0.15, sunR * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Moon - crescent, overlapping sun slightly
  const moonX = cx - radius * 0.22;
  const moonY = cy + radius * 0.12;
  const moonR = radius * 0.36;

  // Moon glow
  const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, moonR * 1.5);
  moonGlow.addColorStop(0, 'rgba(200,195,180,0.25)');
  moonGlow.addColorStop(1, 'rgba(200,195,180,0)');
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Moon body
  const moonGrad = ctx.createRadialGradient(moonX - moonR * 0.3, moonY - moonR * 0.3, 0, moonX, moonY, moonR);
  moonGrad.addColorStop(0, '#f5f0e8');
  moonGrad.addColorStop(0.6, '#e8e0d4');
  moonGrad.addColorStop(1, '#d4ccc0');
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  // Crescent cutout
  const cutGrad = ctx.createRadialGradient(
    moonX + moonR * 0.45, moonY - moonR * 0.25, 0,
    moonX + moonR * 0.45, moonY - moonR * 0.25, moonR * 0.85
  );
  if (variant === 'bg') {
    cutGrad.addColorStop(0, '#2d2a26');
    cutGrad.addColorStop(1, '#2d2a26');
  } else {
    cutGrad.addColorStop(0, '#faf6f1');
    cutGrad.addColorStop(1, '#faf6f1');
  }
  ctx.fillStyle = cutGrad;
  ctx.beginPath();
  ctx.arc(moonX + moonR * 0.45, moonY - moonR * 0.25, moonR * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // Small stars near moon
  ctx.fillStyle = 'rgba(212,120,78,0.5)';
  const stars = [
    [cx - radius * 0.52, cy - radius * 0.35, 3],
    [cx - radius * 0.45, cy + radius * 0.45, 2.5],
    [cx - radius * 0.6, cy + radius * 0.15, 2],
    [cx + radius * 0.5, cy + radius * 0.4, 2.5],
    [cx + radius * 0.55, cy - radius * 0.42, 2],
  ];
  for (const [sx, sy, sr] of stars) {
    const starScale = sr * (radius / 300);
    drawStar(ctx, sx, sy, starScale);
  }
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawText(ctx, cx, cy, radius, size) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // "LunaSol" text
  const fontSize = size || radius * 0.22;
  ctx.font = `800 ${fontSize}px sans-serif`;
  ctx.fillStyle = '#2d2a26';
  ctx.fillText('LunaSol', cx, cy + radius * 0.62);
}

// ── 1. Main app icon (1024x1024) ──
function generateIcon() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background - warm cream with subtle gradient
  const bg = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.7);
  bg.addColorStop(0, '#fdf9f4');
  bg.addColorStop(1, '#f0ebe3');
  ctx.fillStyle = bg;
  ctx.beginPath();
  // Rounded square
  roundRect(ctx, 0, 0, size, size, size * 0.2);
  ctx.fill();

  drawMoonSun(ctx, size / 2, size * 0.4, size * 0.35, 'icon');
  drawText(ctx, size / 2, size * 0.4, size * 0.35);

  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), canvas.toBuffer('image/png'));
  console.log('Generated icon.png');
}

// ── 2. Android adaptive icon foreground (1024x1024 with safe zone) ──
function generateAdaptiveForeground() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  // Draw in safe zone (centered 66% of canvas)
  const safeR = size * 0.28;
  drawMoonSun(ctx, size / 2, size * 0.42, safeR, 'icon');

  // Smaller text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${safeR * 0.2}px sans-serif`;
  ctx.fillStyle = '#2d2a26';
  ctx.fillText('LunaSol', size / 2, size * 0.42 + safeR * 0.62);

  fs.writeFileSync(path.join(ASSETS_DIR, 'android-icon-foreground.png'), canvas.toBuffer('image/png'));
  console.log('Generated android-icon-foreground.png');
}

// ── 3. Android adaptive icon background (1024x1024) ──
function generateAdaptiveBackground() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Warm gradient background
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#fdf9f4');
  bg.addColorStop(0.5, '#faf6f1');
  bg.addColorStop(1, '#f0ebe3');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  fs.writeFileSync(path.join(ASSETS_DIR, 'android-icon-background.png'), canvas.toBuffer('image/png'));
  console.log('Generated android-icon-background.png');
}

// ── 4. Monochrome icon (1024x1024) ──
function generateMonochrome() {
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size * 0.42;
  const radius = size * 0.28;

  // Sun - simple circle
  const sunX = cx + radius * 0.22;
  const sunY = cy - radius * 0.1;
  const sunR = radius * 0.38;

  ctx.fillStyle = '#000000';
  // Sun rays
  ctx.save();
  ctx.translate(sunX, sunY);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, sunR * 1.05);
    ctx.lineTo(sunR * 0.06, sunR * 1.3);
    ctx.lineTo(-sunR * 0.06, sunR * 1.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Moon
  const moonX = cx - radius * 0.22;
  const moonY = cy + radius * 0.12;
  const moonR = radius * 0.36;

  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  // Crescent cutout
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(moonX + moonR * 0.45, moonY - moonR * 0.25, moonR * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  fs.writeFileSync(path.join(ASSETS_DIR, 'android-icon-monochrome.png'), canvas.toBuffer('image/png'));
  console.log('Generated android-icon-monochrome.png');
}

// ── 5. Splash icon (512x512) ──
function generateSplash() {
  const size = 512;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  drawMoonSun(ctx, size / 2, size * 0.38, size * 0.32, 'splash');

  // Text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${size * 0.09}px sans-serif`;
  ctx.fillStyle = '#2d2a26';
  ctx.fillText('LunaSol', size / 2, size * 0.78);

  // Tagline
  ctx.font = `500 ${size * 0.04}px sans-serif`;
  ctx.fillStyle = '#9b9490';
  ctx.fillText('Your daily companion', size / 2, size * 0.86);

  fs.writeFileSync(path.join(ASSETS_DIR, 'splash-icon.png'), canvas.toBuffer('image/png'));
  console.log('Generated splash-icon.png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

// Generate all
generateIcon();
generateAdaptiveForeground();
generateAdaptiveBackground();
generateMonochrome();
generateSplash();
console.log('\nAll assets generated in /assets/');

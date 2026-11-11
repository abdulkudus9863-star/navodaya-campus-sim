import * as THREE from "three";

/** Deterministic RNG so the campus looks identical on every visit. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return ctx;
}

function toTexture(ctx: CanvasRenderingContext2D, repeat = false): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  return texture;
}

export function grassTexture(): THREE.CanvasTexture {
  const ctx = canvas2d(512, 512);
  const rand = seededRandom(7);
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, "#4c5f33");
  gradient.addColorStop(0.5, "#55693a");
  gradient.addColorStop(1, "#41522d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 9000; i += 1) {
    const x = rand() * 512;
    const y = rand() * 512;
    const shade = rand();
    ctx.strokeStyle =
      shade > 0.72 ? "rgba(140,158,96,0.30)" : shade > 0.4 ? "rgba(48,66,34,0.35)" : "rgba(96,112,62,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 3, y - 2 - rand() * 4);
    ctx.stroke();
  }
  return toTexture(ctx, true);
}

export function stoneTexture(): THREE.CanvasTexture {
  const ctx = canvas2d(512, 512);
  const rand = seededRandom(21);
  ctx.fillStyle = "#6c6559";
  ctx.fillRect(0, 0, 512, 512);
  const rows = 8;
  const rowHeight = 512 / rows;
  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : 48;
    for (let x = -64; x < 560; x += 96) {
      const px = x + offset + (rand() - 0.5) * 5;
      const py = row * rowHeight + 2;
      const tone = 118 + Math.floor(rand() * 34);
      ctx.fillStyle = `rgb(${tone}, ${tone - 8}, ${tone - 20})`;
      ctx.fillRect(px + 2, py + 2, 92, rowHeight - 6);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(px + 2, py + 2, 92, 2);
    }
  }
  for (let i = 0; i < 2400; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(42,38,32,0.16)" : "rgba(196,188,168,0.10)";
    ctx.fillRect(rand() * 512, rand() * 512, 2, 2);
  }
  return toTexture(ctx, true);
}

export function dirtTexture(): THREE.CanvasTexture {
  const ctx = canvas2d(256, 256);
  const rand = seededRandom(33);
  ctx.fillStyle = "#8a6a48";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i += 1) {
    const tone = rand();
    ctx.fillStyle =
      tone > 0.66 ? "rgba(160,126,88,0.4)" : tone > 0.33 ? "rgba(112,84,56,0.36)" : "rgba(70,52,34,0.24)";
    const size = 1 + rand() * 2.5;
    ctx.fillRect(rand() * 256, rand() * 256, size, size);
  }
  return toTexture(ctx, true);
}

export function plasterTexture(): THREE.CanvasTexture {
  const ctx = canvas2d(256, 256);
  const rand = seededRandom(56);
  ctx.fillStyle = "#e2d8c4";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(150,138,116,0.08)";
    ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  ctx.strokeStyle = "rgba(120,108,90,0.10)";
  for (let i = 0; i < 14; i += 1) {
    ctx.beginPath();
    ctx.moveTo(rand() * 256, 0);
    ctx.lineTo(rand() * 256, 256);
    ctx.stroke();
  }
  return toTexture(ctx, true);
}

function drawBoardFrame(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#243b2c";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#a98a4e";
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, w - 52, h - 52);
}

export function noticeTexture(): THREE.CanvasTexture {
  const ctx = canvas2d(1024, 640);
  drawBoardFrame(ctx, 1024, 640);
  ctx.fillStyle = "#f0e8d2";
  ctx.textAlign = "center";
  ctx.font = "600 44px Georgia, 'Times New Roman', serif";
  ctx.fillText("NAVODAYA VIDYALAYA", 512, 96);
  ctx.font = "22px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillStyle = "#d9cba9";
  ctx.fillText("NOTICE BOARD  ·  RAVI HOUSE  ·  TERM II", 512, 132);

  const rand = seededRandom(88);
  const papers = [
    { x: 86, y: 176, w: 250, h: 300, tilt: -0.02 },
    { x: 386, y: 166, w: 250, h: 322, tilt: 0.015 },
    { x: 686, y: 184, w: 250, h: 290, tilt: -0.01 },
  ];
  const titles = ["ASSEMBLY", "CLASS VII-A", "LIBRARY"];
  const bodies = [
    ["Morning assembly", "06:20 AM sharp", "Assembly ground", "House colours"],
    ["Report to Room 12", "Academic block", "After assembly", "Bring notebook"],
    ["Hours extended", "Open till 8:00 PM", "Return books by", "Friday evening"],
  ];

  papers.forEach((paper, index) => {
    ctx.save();
    ctx.translate(paper.x + paper.w / 2, paper.y + paper.h / 2);
    ctx.rotate(paper.tilt);
    ctx.fillStyle = "#f6f0df";
    ctx.fillRect(-paper.w / 2, -paper.h / 2, paper.w, paper.h);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(-paper.w / 2 + 3, -paper.h / 2 + 3, paper.w, 4);
    ctx.fillStyle = "#b7412f";
    ctx.beginPath();
    ctx.arc(0, -paper.h / 2 + 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a4a32";
    ctx.textAlign = "left";
    ctx.font = "700 20px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText(titles[index], -paper.w / 2 + 20, -paper.h / 2 + 60);
    ctx.strokeStyle = "rgba(90,74,50,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-paper.w / 2 + 20, -paper.h / 2 + 72);
    ctx.lineTo(paper.w / 2 - 20, -paper.h / 2 + 72);
    ctx.stroke();
    ctx.font = "16px Georgia, serif";
    ctx.fillStyle = "#3f382c";
    bodies[index].forEach((line, lineIndex) => {
      ctx.fillText(line, -paper.w / 2 + 20, -paper.h / 2 + 108 + lineIndex * 30);
    });
    ctx.fillStyle = "rgba(80,80,80,0.16)";
    for (let i = 0; i < 7; i += 1) {
      const lineWidth = paper.w - 40 - rand() * 40;
      ctx.fillRect(-paper.w / 2 + 20, -paper.h / 2 + 232 + i * 8, lineWidth, 2);
    }
    ctx.restore();
  });

  return toTexture(ctx, false);
}

export function signTexture(main: string, sub: string): THREE.CanvasTexture {
  const ctx = canvas2d(1024, 256);
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#22382b");
  gradient.addColorStop(1, "#16261d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = "#b9985c";
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 996, 228);
  ctx.textAlign = "center";
  ctx.fillStyle = "#efe6cf";
  ctx.font = "600 64px Georgia, 'Times New Roman', serif";
  ctx.fillText(main, 512, 118);
  ctx.fillStyle = "#c6a86d";
  ctx.font = "24px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(sub, 512, 176);
  return toTexture(ctx, false);
}

export function chalkboardTexture(): THREE.CanvasTexture {
  const ctx = canvas2d(1024, 512);
  ctx.fillStyle = "#20362c";
  ctx.fillRect(0, 0, 1024, 512);
  const rand = seededRandom(101);
  for (let i = 0; i < 200; i += 1) {
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(rand() * 1024, rand() * 512, 40 + rand() * 120, 6);
  }
  ctx.strokeStyle = "#a9905c";
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 1010, 498);
  ctx.fillStyle = "rgba(240,240,230,0.88)";
  ctx.font = "italic 46px Georgia, serif";
  ctx.fillText("Class VII-A", 64, 110);
  ctx.font = "34px 'Comic Sans MS', 'Segoe Print', cursive";
  ctx.fillText("Geography — The Monsoon", 64, 200);
  ctx.font = "30px 'Comic Sans MS', 'Segoe Print', cursive";
  ctx.fillText("1. Winds from the south-west", 64, 270);
  ctx.fillText("2. Rain arrives in June", 64, 322);
  ctx.fillStyle = "rgba(240,240,230,0.55)";
  ctx.fillText("Homework: map the Ghats", 560, 420);
  return toTexture(ctx, false);
}

export function nameTagTexture(name: string, role: string): THREE.CanvasTexture {
  const ctx = canvas2d(512, 160);
  ctx.clearRect(0, 0, 512, 160);
  ctx.fillStyle = "rgba(14, 20, 17, 0.78)";
  const radius = 20;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(512, 0, 512, 160, radius);
  ctx.arcTo(512, 160, 0, 160, radius);
  ctx.arcTo(0, 160, 0, 0, radius);
  ctx.arcTo(0, 0, 512, 0, radius);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(201, 167, 104, 0.85)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4ead2";
  ctx.font = "600 52px Georgia, serif";
  ctx.fillText(name, 256, 74);
  ctx.fillStyle = "#c9a768";
  ctx.font = "24px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(role.toUpperCase(), 256, 116);
  const texture = toTexture(ctx, false);
  texture.needsUpdate = true;
  return texture;
}

export function flagTexture(): THREE.CanvasTexture {
  const ctx = canvas2d(512, 320);
  ctx.fillStyle = "#7d2b2b";
  ctx.fillRect(0, 0, 512, 320);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i < 10; i += 1) ctx.fillRect(0, i * 32, 512, 16);
  ctx.strokeStyle = "#d9b66f";
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 488, 296);
  ctx.fillStyle = "#f2e3bf";
  ctx.textAlign = "center";
  ctx.font = "700 92px Georgia, serif";
  ctx.fillText("AGNI", 256, 168);
  ctx.font = "26px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("RAVI HOUSE · NAVODAYA", 256, 226);
  ctx.fillStyle = "#e0b15e";
  ctx.beginPath();
  ctx.moveTo(256, 240);
  ctx.lineTo(276, 282);
  ctx.lineTo(256, 272);
  ctx.lineTo(236, 282);
  ctx.closePath();
  ctx.fill();
  return toTexture(ctx, false);
}

export { canvas2d, toTexture };

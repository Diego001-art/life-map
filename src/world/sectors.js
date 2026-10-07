// Сектора карты: A–H с запада на восток, 1–8 с севера на юг (по 250 м).
export const SECTOR = 250, MAP = 2000, LETTERS = 'ABCDEFGH';

export function sectorOf(x, z) {
  const c = Math.floor((x + MAP / 2) / SECTOR), r = Math.floor((z + MAP / 2) / SECTOR);
  if (c < 0 || c > 7 || r < 0 || r > 7) return '—';
  return LETTERS[c] + (r + 1);
}
// Центр сектора + сдвиг в метрах → координаты мира.
export function sectorPos(sector, dx = 0, dz = 0) {
  const c = LETTERS.indexOf(sector[0].toUpperCase()), r = parseInt(sector.slice(1)) - 1;
  return { x: -MAP / 2 + (c + 0.5) * SECTOR + dx, z: -MAP / 2 + (r + 0.5) * SECTOR + dz };
}

// Карта с сеткой секторов: мини-карта в углу и большая по клавише M.
export function createMapView(terrain, houses, marks, roads) {
  const bg = document.createElement('canvas'); bg.width = bg.height = 512;
  const g = bg.getContext('2d'), k = 512 / MAP;
  const img = g.createImageData(512, 512);
  for (let py = 0; py < 512; py++) for (let px = 0; px < 512; px++) {
    const hgt = terrain.heightAt(px / k - MAP / 2, py / k - MAP / 2) / 240;
    const i = (py * 512 + px) * 4;
    img.data[i] = 90 + hgt * 90; img.data[i + 1] = 120 + hgt * 60; img.data[i + 2] = 60 + hgt * 50; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // дороги и тропинки
  if (roads) for (const { kind, pts } of roads.lines) {
    g.strokeStyle = kind === 'path' ? '#d8c08a' : '#f3ead8'; g.lineWidth = kind === 'main' ? 3 : kind === 'street' ? 2 : 1;
    g.setLineDash(kind === 'path' ? [3, 3] : []);
    g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo']((p.x + MAP / 2) * k, (p.z + MAP / 2) * k)); g.stroke();
  }
  g.setLineDash([]);
  g.fillStyle = '#5a4a3a';
  for (const h of houses) g.fillRect((h.center.x + MAP / 2) * k - 1.5, (h.center.z + MAP / 2) * k - 1.5, 3, 3);
  g.strokeStyle = '#fff8'; g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif';
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke();
  }
  for (let c = 0; c < 8; c++) for (let r = 0; r < 8; r++) g.fillText(LETTERS[c] + (r + 1), c * 64 + 4, r * 64 + 16);

  const mini = document.getElementById('minimap'), big = document.getElementById('bigmap');
  const draw = (cv, p, quests) => {
    const x = cv.getContext('2d'), s = cv.width / 512;
    x.drawImage(bg, 0, 0, cv.width, cv.height);
    for (const m of marks()) { x.fillStyle = m.color; x.beginPath(); x.arc((m.x + MAP / 2) * k * s, (m.z + MAP / 2) * k * s, 5, 0, 7); x.fill(); }
    x.fillStyle = '#ff3'; x.strokeStyle = '#000';
    x.beginPath(); x.arc((p.x + MAP / 2) * k * s, (p.z + MAP / 2) * k * s, 5, 0, 7); x.fill(); x.stroke();
  };
  return {
    update(p) { draw(mini, p); if (!big.classList.contains('hidden')) draw(big, p); },
    toggle() { big.classList.toggle('hidden'); },
  };
}

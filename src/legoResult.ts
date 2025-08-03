import './styles.css';
import { legoColors } from '@modules/legoColors';

window.addEventListener('DOMContentLoaded', () => {
  // 1. 展示导出的图像
  const img = document.getElementById('legoImage') as HTMLImageElement | null;
  const overlay = document.getElementById('resultOverlay') as HTMLCanvasElement | null;
  const rawImage = sessionStorage.getItem('legoResultImage');
  if (img && rawImage) {
    img.src = rawImage;
    console.log('【结果页】展示的 image 长度：', rawImage.length);
  } else {
    console.warn('【结果页】未找到 legoResultImage');
  }

  // 2. 取出识别结果 cells
  const rawBlocks = sessionStorage.getItem('legoResultBlocks');
  let cells: any[] = [];
  if (rawBlocks) {
    try {
      cells = JSON.parse(rawBlocks);
      console.log('【结果页】sessionStorage 中的 cells：', cells);
    } catch (e) {
      console.error('【结果页】解析 cells 出错：', e);
    }
  } else {
    console.warn('【结果页】未找到 legoResultBlocks');
  }


  function draw() {
    if (!img || !overlay) return;
    overlay.width = img.naturalWidth;
    overlay.height = img.naturalHeight;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.strokeStyle = '#f00';
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#f00';
    for (const cell of cells) {
      ctx.beginPath();
      ctx.moveTo(cell.quad[0].x, cell.quad[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(cell.quad[i].x, cell.quad[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.fillText(cell.color, cell.quad[0].x, cell.quad[0].y);
    }

    // Group cells by color and draw big bounding boxes
    const colorMap = new Map(
        legoColors.map(c => [c.name, `rgb(${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]})`])
    );
    const bounds = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
    for (const cell of cells) {
      const xs = cell.quad.map((p: any) => p.x);
      const ys = cell.quad.map((p: any) => p.y);
      const rect = {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
      const b = bounds.get(cell.color);
      if (!b) bounds.set(cell.color, { ...rect });
      else {
        b.minX = Math.min(b.minX, rect.minX);
        b.minY = Math.min(b.minY, rect.minY);
        b.maxX = Math.max(b.maxX, rect.maxX);
        b.maxY = Math.max(b.maxY, rect.maxY);
      }
    }

    ctx.lineWidth = 2;
    bounds.forEach((b, color) => {
      ctx.strokeStyle = colorMap.get(color) || '#0f0';
      ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    });
  }

  if (img) {
    if (img.complete) draw();
    else img.addEventListener('load', draw);
  }


  // 3. 绑定返回按钮
  const btn = document.getElementById('returnBtn') as HTMLButtonElement | null;
  if (btn) {
    btn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }
});


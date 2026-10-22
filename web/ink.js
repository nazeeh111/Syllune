export class Ink {
  constructor(canvas, onChange, onHistory) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChange;
    this.onHistory = onHistory;
    this.tool = 'pen';
    this.color = '#18243e';
    this.width = 3;
    this.undoStack = [];
    this.redoStack = [];
    this.selected = [];
    this.images = new Map();
    this.generation = 0;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', () => this.cancel());
    canvas.addEventListener('lostpointercapture', () => {
      if (this.active) this.cancel();
    });
  }
  bind(page) {
    this.cancel();
    this.page = page;
    this.undoStack = [];
    this.redoStack = [];
    this.selected = [];
    this.images.clear();
    const generation = ++this.generation;
    for (const src of page.images) {
      const img = new Image();
      img.onload = () => {
        if (this.generation === generation) {
          this.images.set(src.src, img);
          this.render();
        }
      };
      img.src = src.src;
    }
    this.render();
    this.history();
  }
  point(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * 1000) / r.width,
      y: ((e.clientY - r.top) * 1200) / r.height,
      p: e.pointerType === 'pen' ? Math.max(0.1, e.pressure || 0.5) : 0.5,
    };
  }
  snapshot() {
    return structuredClone({
      strokes: this.page.strokes,
      images: this.page.images,
    });
  }
  remember(before) {
    this.undoStack.push(before);
    if (this.undoStack.length > 35) this.undoStack.shift();
    this.redoStack = [];
    this.history();
  }
  history() {
    this.onHistory?.(this.undoStack.length > 0, this.redoStack.length > 0);
  }
  changed() {
    this.page.updated = Date.now();
    this.onChange?.();
    this.history();
  }
  down(e) {
    if (e.button !== 0 || this.active) return;
    if (this.page.strokes.length >= 10000) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.point(e);
    this.active = { id: e.pointerId, start: p, old: this.snapshot(), last: p };
    if (this.tool === 'pen') {
      this.current = { color: this.color, width: this.width, points: [p] };
      this.page.strokes.push(this.current);
    } else if (this.tool === 'erase') this.erase(p);
    else if (this.selected.length && this.inSelection(p)) {
      this.active.moving = true;
    } else {
      this.selected = [];
      this.selection = { x: p.x, y: p.y, w: 0, h: 0 };
    }
    this.render();
  }
  move(e) {
    if (!this.active || e.pointerId !== this.active.id) return;
    const points = e.getCoalescedEvents?.() || [e];
    for (const event of points) {
      const p = this.point(event);
      if (this.tool === 'pen') {
        if (this.current.points.length < 10000) this.current.points.push(p);
      } else if (this.tool === 'erase') this.erase(p);
      else if (this.active.moving) {
        const dx = p.x - this.active.last.x,
          dy = p.y - this.active.last.y;
        for (const n of this.selected)
          for (const pt of this.page.strokes[n].points) {
            pt.x = Math.max(-2000, Math.min(3000, pt.x + dx));
            pt.y = Math.max(-2400, Math.min(3600, pt.y + dy));
          }
        this.selection.x += dx;
        this.selection.y += dy;
      } else if (this.selection) {
        this.selection = {
          x: Math.min(p.x, this.active.start.x),
          y: Math.min(p.y, this.active.start.y),
          w: Math.abs(p.x - this.active.start.x),
          h: Math.abs(p.y - this.active.start.y),
        };
      }
      this.active.last = p;
    }
    this.render();
  }
  up(e) {
    if (!this.active || e.pointerId !== this.active.id) return;
    const before = this.active.old;
    if (this.tool === 'select' && !this.active.moving) {
      const s = this.selection;
      this.selected = this.page.strokes
        .map((v, i) =>
          v.points.some(
            (p) =>
              p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h,
          )
            ? i
            : -1,
        )
        .filter((i) => i >= 0);
      if (!this.selected.length) this.selection = null;
    } else {
      this.remember(before);
      this.changed();
    }
    this.active = null;
    this.current = null;
    this.render();
  }
  cancel() {
    if (this.active && this.page) {
      Object.assign(this.page, this.active.old);
      this.active = null;
      this.current = null;
      this.render();
    }
  }
  erase(p) {
    this.page.strokes = this.page.strokes.filter(
      (s) =>
        !s.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 20 + s.width),
    );
  }
  inSelection(p) {
    const s = this.selection;
    return (
      s && p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h
    );
  }
  setTool(t) {
    this.cancel();
    this.tool = t;
    this.selected = [];
    this.selection = null;
    this.render();
  }
  undo() {
    this.cancel();
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snapshot());
    Object.assign(this.page, this.undoStack.pop());
    this.selection = null;
    this.selected = [];
    this.render();
    this.changed();
  }
  redo() {
    this.cancel();
    if (!this.redoStack.length) return;
    this.undoStack.push(this.snapshot());
    Object.assign(this.page, this.redoStack.pop());
    this.selection = null;
    this.selected = [];
    this.render();
    this.changed();
  }
  clear() {
    this.cancel();
    this.remember(this.snapshot());
    this.page.strokes = [];
    this.page.images = [];
    this.selected = [];
    this.selection = null;
    this.render();
    this.changed();
  }
  async insertImage(file) {
    const target = this.page;
    if (file.size > 6_000_000)
      throw Error('Choose an image smaller than 6 MB.');
    if (this.page.images.length >= 10)
      throw Error('This page already has 10 images.');
    const bitmap = await createImageBitmap(file);
    const flat = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    flat.width = bitmap.width * scale;
    flat.height = bitmap.height * scale;
    flat.getContext('2d').drawImage(bitmap, 0, 0, flat.width, flat.height);
    bitmap.close();
    const src = flat.toDataURL('image/png');
    const h = Math.min(1100, (flat.height / flat.width) * 850);
    const img = new Image();
    await new Promise((r, j) => {
      img.onload = r;
      img.onerror = j;
      img.src = src;
    });
    if (this.page !== target)
      throw Error(
        'You changed pages. Select the original page and insert the image again.',
      );
    this.remember(this.snapshot());
    this.page.images.push({
      src,
      x: 75,
      y: 60,
      width: Math.min(850, (h * flat.width) / flat.height),
      height: h,
    });
    this.images.set(src, img);
    this.render();
    this.changed();
  }
  render() {
    const c = this.ctx;
    c.clearRect(0, 0, 1000, 1200);
    if (!this.page) return;
    for (const image of this.page.images) {
      const img = this.images.get(image.src);
      if (img) c.drawImage(img, image.x, image.y, image.width, image.height);
    }
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const stroke of this.page.strokes) {
      c.strokeStyle = stroke.color;
      c.fillStyle = stroke.color;
      const pts = stroke.points;
      if (pts.length === 1) {
        c.beginPath();
        c.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
        c.fill();
      }
      for (let i = 1; i < pts.length; i++) {
        c.lineWidth = stroke.width * (0.6 + (pts[i].p + pts[i - 1].p) / 2);
        c.beginPath();
        c.moveTo(pts[i - 1].x, pts[i - 1].y);
        c.lineTo(pts[i].x, pts[i].y);
        c.stroke();
      }
    }
    if (this.selection) {
      const s = this.selection;
      c.save();
      c.strokeStyle = '#4265c0';
      c.fillStyle = '#4265c012';
      c.setLineDash([7, 5]);
      c.lineWidth = 2;
      c.fillRect(s.x, s.y, s.w, s.h);
      c.strokeRect(s.x, s.y, s.w, s.h);
      c.restore();
    }
  }
  async blob() {
    const selection = this.selection;
    this.selection = null;
    this.render();
    const c = document.createElement('canvas');
    c.width = 1000;
    c.height = 1200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1200);
    ctx.drawImage(this.canvas, 0, 0);
    this.selection = selection;
    this.render();
    return new Promise((r) => c.toBlob(r, 'image/png'));
  }
}
// An explicitly labeled example, drawn as editable strokes rather than a flattened picture.
const glyph = {
  x: [
    [
      [0, 0],
      [20, 30],
    ],
    [
      [20, 0],
      [0, 30],
    ],
  ],
  2: [
    [
      [0, 5],
      [5, 0],
      [16, 0],
      [22, 7],
      [20, 14],
      [0, 30],
      [23, 30],
    ],
  ],
  6: [
    [
      [21, 0],
      [9, 2],
      [1, 15],
      [2, 27],
      [12, 31],
      [22, 25],
      [21, 17],
      [11, 14],
      [2, 20],
    ],
  ],
  1: [
    [
      [3, 7],
      [12, 0],
      [12, 30],
    ],
    [
      [2, 30],
      [22, 30],
    ],
  ],
  4: [
    [
      [18, 0],
      [0, 21],
      [24, 21],
    ],
    [
      [18, 0],
      [18, 32],
    ],
  ],
  8: [
    [
      [11, 0],
      [2, 4],
      [3, 12],
      [20, 20],
      [21, 27],
      [12, 32],
      [2, 27],
      [2, 21],
      [19, 8],
      [20, 3],
      [11, 0],
    ],
  ],
  0: [
    [
      [10, 0],
      [2, 6],
      [0, 22],
      [5, 31],
      [16, 32],
      [22, 25],
      [23, 9],
      [17, 1],
      [10, 0],
    ],
  ],
  '+': [
    [
      [0, 16],
      [24, 16],
    ],
    [
      [12, 3],
      [12, 29],
    ],
  ],
  '=': [
    [
      [0, 10],
      [24, 10],
    ],
    [
      [0, 22],
      [24, 22],
    ],
  ],
  '-': [
    [
      [0, 16],
      [24, 16],
    ],
  ],
};
export function exampleInk(lines = ['2x+6=14', '2x=20', 'x=10']) {
  const strokes = [];
  lines.forEach((line, row) => {
    let x = 95;
    for (const ch of line) {
      for (const path of glyph[ch] || [])
        strokes.push({
          color: row === 1 ? '#ab3046' : '#18243e',
          width: 3.3,
          points: path.map(([a, b]) => ({
            x: x + a * 1.6,
            y: 130 + row * 100 + b * 1.6,
            p: 0.55,
          })),
        });
      x += ch === 'x' ? 48 : 51;
    }
  });
  return strokes;
}

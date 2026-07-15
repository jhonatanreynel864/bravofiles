/* =========================================================
   BravoFiles — lógica de la app
   Todo el procesamiento ocurre en el navegador (sin servidor)
   ========================================================= */

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

/* ---------- utilidades ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function bytesToSize(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

function readAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-open');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => t.classList.remove('is-open'), 2400);
}

/* ---------- ícono set (feather-like, consistente) ---------- */
const ICONS = {
  images: `<path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m21 15-5-5-4.5 4.5"/><path d="m3 18 5.5-5.5L12 16"/>`,
  merge: `<path d="M8 3v9a3 3 0 0 0 3 3h5"/><path d="m14 12 3 3-3 3"/><rect x="3" y="3" width="6" height="6" rx="1.3"/><rect x="15" y="15" width="6" height="6" rx="1.3"/>`,
  compress: `<path d="M8 3v4a1 1 0 0 1-1 1H3"/><path d="M3 16h4a1 1 0 0 1 1 1v4"/><path d="M21 8h-4a1 1 0 0 1-1-1V3"/><path d="M16 21v-4a1 1 0 0 1 1-1h4"/>`,
  pdf2img: `<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 15.5 11.5 12 14 15l1.5-2 2.5 3.5"/><circle cx="9" cy="9.5" r="1.4"/>`,
  word: `<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8Z"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="m8.5 12.5 1.2 5 1.4-3.6 1.4 3.6 1.2-5"/>`,
  scan: `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/>`,
  file: `<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8Z"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/>`,
  download: `<path d="M12 3v13"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>`,
  camera: `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="3.4"/>`,
  folder: `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z"/>`,
  x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  empty: `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z"/><path d="M9.5 13.5h5"/>`,
};
function icon(name, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONS[name]}</svg>`;
}

/* =========================================================
   MOTORES DE CONVERSIÓN — funcionan 100% en el navegador
   ========================================================= */

/* Lee el tag de orientación EXIF de un JPEG (evita fotos "torcidas" o distorsionadas) */
function getExifOrientation(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const view = new DataView(e.target.result);
        if (view.getUint16(0, false) !== 0xffd8) return resolve(1);
        const length = view.byteLength;
        let offset = 2;
        while (offset < length - 1) {
          const marker = view.getUint16(offset, false);
          offset += 2;
          if (marker === 0xffe1) {
            if (view.getUint32(offset + 2, false) !== 0x45786966) return resolve(1);
            const tiffOffset = offset + 8;
            const little = view.getUint16(tiffOffset, false) === 0x4949;
            const firstIfd = view.getUint32(tiffOffset + 4, little);
            const dirStart = tiffOffset + firstIfd;
            const entries = view.getUint16(dirStart, little);
            for (let i = 0; i < entries; i++) {
              const entryOffset = dirStart + 2 + i * 12;
              if (view.getUint16(entryOffset, little) === 0x0112) {
                return resolve(view.getUint16(entryOffset + 8, little));
              }
            }
            return resolve(1);
          } else if ((marker & 0xff00) !== 0xff00) {
            break;
          } else {
            offset += view.getUint16(offset, false);
          }
        }
      } catch (err) { /* ignore, default orientation */ }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 128 * 1024));
  });
}

/* Convierte un File de imagen a un canvas ya orientado correctamente (corrige fotos
   que salían giradas/estiradas por los metadatos EXIF de la cámara del celular) */
async function imageFileToCanvas(file) {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  let orientation = 1;
  if (file.type === 'image/jpeg' || file.type === 'image/jpg' || /\.(jpe?g)$/i.test(file.name || '')) {
    orientation = await getExifOrientation(file);
  }

  const swapped = orientation >= 5 && orientation <= 8;
  const canvas = document.createElement('canvas');
  canvas.width = swapped ? h : w;
  canvas.height = swapped ? w : h;
  const ctx = canvas.getContext('2d');

  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
    default: break;
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

async function imagesToPdf(files, onProgress) {
  const { jsPDF } = window.jspdf;
  const MAX_EDGE_PT = 1400; // evita páginas gigantes/raras con fotos de 12+ MP
  let doc = null;
  for (let i = 0; i < files.length; i++) {
    onProgress?.(`Añadiendo página ${i + 1} de ${files.length}…`);
    const canvas = await imageFileToCanvas(files[i]);
    const longEdge = Math.max(canvas.width, canvas.height);
    const scale = longEdge > MAX_EDGE_PT ? MAX_EDGE_PT / longEdge : 1;
    const pageW = canvas.width * scale;
    const pageH = canvas.height * scale;
    const orientation = pageW >= pageH ? 'l' : 'p';
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    if (!doc) {
      doc = new jsPDF({ unit: 'pt', format: [pageW, pageH], orientation });
    } else {
      doc.addPage([pageW, pageH], orientation);
    }
    doc.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH);
  }
  return doc.output('blob');
}

async function mergePdfs(files, onProgress) {
  const { PDFDocument } = PDFLib;
  const merged = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    onProgress?.(`Uniendo archivo ${i + 1} de ${files.length}…`);
    const bytes = await files[i].arrayBuffer();
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  const bytes = await merged.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

async function compressPdf(files, onProgress, level = 'media') {
  const file = files[0];
  const scaleMap = { alta: 1.4, media: 1.0, baja: 0.7 };
  const qualityMap = { alta: 0.75, media: 0.55, baja: 0.35 };
  const scale = scaleMap[level] ?? 1.0;
  const quality = qualityMap[level] ?? 0.55;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const { jsPDF } = window.jspdf;
  let doc = null;

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Comprimiendo página ${i} de ${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const pageW = viewport.width * 72 / 96;
    const pageH = viewport.height * 72 / 96;
    const orientation = pageW >= pageH ? 'l' : 'p';
    if (!doc) doc = new jsPDF({ unit: 'pt', format: [pageW, pageH], orientation });
    else doc.addPage([pageW, pageH], orientation);
    doc.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH);
  }
  return doc.output('blob');
}

/* Recorta los márgenes blancos alrededor del contenido real de un canvas
   (para que "PDF a imagen" no deje bordes blancos grandes) */
function trimWhitespace(canvas, tolerance = 246, pad = 6) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  let data;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch (e) {
    return canvas;
  }

  let top = 0, bottom = height - 1, left = 0, right = width - 1;

  const rowIsBlank = (y) => {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      if (data[i] < tolerance || data[i + 1] < tolerance || data[i + 2] < tolerance) return false;
    }
    return true;
  };
  const colIsBlank = (x) => {
    for (let y = 0; y < height; y += 2) {
      const i = (y * width + x) * 4;
      if (data[i] < tolerance || data[i + 1] < tolerance || data[i + 2] < tolerance) return false;
    }
    return true;
  };

  while (top < height - 1 && rowIsBlank(top)) top++;
  while (bottom > top && rowIsBlank(bottom)) bottom--;
  while (left < width - 1 && colIsBlank(left)) left++;
  while (right > left && colIsBlank(right)) right--;

  top = Math.max(0, top - pad);
  left = Math.max(0, left - pad);
  bottom = Math.min(height - 1, bottom + pad);
  right = Math.min(width - 1, right + pad);

  const trimmedW = right - left + 1;
  const trimmedH = bottom - top + 1;
  if (trimmedW <= 0 || trimmedH <= 0 || (trimmedW >= width * 0.98 && trimmedH >= height * 0.98)) {
    return canvas; // nada que recortar, o la página no tiene margen real
  }

  const out = document.createElement('canvas');
  out.width = trimmedW;
  out.height = trimmedH;
  out.getContext('2d').drawImage(canvas, left, top, trimmedW, trimmedH, 0, 0, trimmedW, trimmedH);
  return out;
}

async function pdfToImages(files, onProgress, format = 'png') {
  const file = files[0];
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = format === 'png' ? 'png' : 'jpg';
  const results = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Exportando página ${i} de ${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const trimmed = trimWhitespace(canvas);
    const dataUrl = trimmed.toDataURL(mime, 0.92);
    const blob = await (await fetch(dataUrl)).blob();
    const filename = pdf.numPages === 1 ? `pagina.${ext}` : `pagina-${String(i).padStart(2, '0')}.${ext}`;
    results.push({ blob, filename });
  }
  return results; // siempre imágenes individuales, nunca un .zip
}

async function wordToPdf(files, onProgress) {
  const file = files[0];
  onProgress?.('Leyendo el documento…');
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;padding:56px;background:#ffffff;color:#111111;font-family:Georgia,serif;font-size:16px;line-height:1.6;';
  container.innerHTML = html || '<p></p>';
  document.body.appendChild(container);
  await new Promise((r) => setTimeout(r, 60));

  onProgress?.('Generando páginas…');
  const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  document.body.removeChild(container);

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.93);

  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position = heightLeft - imgH;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    heightLeft -= pageH;
  }
  onProgress?.('Guardando PDF…');
  return pdf.output('blob');
}

/* =========================================================
   DEFINICIÓN DE HERRAMIENTAS
   ========================================================= */
const TOOLS = [
  {
    id: 'img2pdf',
    title: 'Imágenes a PDF',
    desc: 'Convierte fotos en un PDF',
    icon: 'images',
    category: 'imagenes',
    accept: 'image/*',
    multiple: true,
    camera: true,
    run: (files, onProgress) => imagesToPdf(files, onProgress),
    outputName: () => `imagenes-${Date.now()}.pdf`,
    outputMime: 'application/pdf',
  },
  {
    id: 'merge',
    title: 'Unir PDF',
    desc: 'Combina varios PDF en uno',
    icon: 'merge',
    category: 'pdf',
    accept: 'application/pdf',
    multiple: true,
    minFiles: 2,
    run: (files, onProgress) => mergePdfs(files, onProgress),
    outputName: () => `unido-${Date.now()}.pdf`,
    outputMime: 'application/pdf',
  },
  {
    id: 'compress',
    title: 'Comprimir PDF',
    desc: 'Reduce el peso de tu PDF',
    icon: 'compress',
    category: 'pdf',
    accept: 'application/pdf',
    multiple: false,
    quality: true,
    run: (files, onProgress, opts) => compressPdf(files, onProgress, opts.quality),
    outputName: () => `comprimido-${Date.now()}.pdf`,
    outputMime: 'application/pdf',
  },
  {
    id: 'pdf2img',
    title: 'PDF a imagen',
    desc: 'Exporta páginas como PNG o JPG',
    icon: 'pdf2img',
    category: 'imagenes',
    accept: 'application/pdf',
    multiple: false,
    formatChoice: true,
  },
  {
    id: 'word2pdf',
    title: 'Word a PDF',
    desc: 'Convierte documentos .docx',
    icon: 'word',
    category: 'documentos',
    accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    multiple: false,
    run: (files, onProgress) => wordToPdf(files, onProgress),
    outputName: () => `documento-${Date.now()}.pdf`,
    outputMime: 'application/pdf',
  },
  {
    id: 'scan',
    title: 'Escanear documento',
    desc: 'Usa la cámara para crear un PDF',
    icon: 'scan',
    category: 'documentos',
    accept: 'image/*',
    multiple: true,
    camera: true,
    scanMode: true,
    run: (files, onProgress) => imagesToPdf(files, onProgress),
    outputName: () => `escaneo-${Date.now()}.pdf`,
    outputMime: 'application/pdf',
  },
];

/* =========================================================
   ESTADO
   ========================================================= */
const state = {
  currentTool: null,
  selectedFiles: [],
  format: 'png',
  quality: 'media',
  recent: [],
};

/* =========================================================
   RENDER: grid de herramientas
   ========================================================= */
const toolGrid = $('#toolGrid');
function renderToolGrid(filter = 'all') {
  toolGrid.innerHTML = '';
  const list = filter === 'all' ? TOOLS : TOOLS.filter((t) => t.category === filter);
  list.forEach((tool) => {
    const card = document.createElement('button');
    card.className = 'tool-card glass';
    card.innerHTML = `
      <div class="tool-icon">${icon(tool.icon)}</div>
      <h4>${tool.title}</h4>
      <p>${tool.desc}</p>
    `;
    card.addEventListener('click', () => openSheet(tool));
    toolGrid.appendChild(card);
  });
}
renderToolGrid();

/* tabs */
$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    renderToolGrid(tab.dataset.filter);
    document.getElementById('toolsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* hero -> abrir escáner directo */
$('#heroScan').addEventListener('click', () => openSheet(TOOLS.find((t) => t.id === 'scan')));

/* bottom nav */
$$('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach((b) => b.classList.remove('is-active'));
    const nav = btn.dataset.nav;
    if (nav === 'escanear') {
      openSheet(TOOLS.find((t) => t.id === 'scan'));
      $('[data-nav="inicio"]').classList.add('is-active');
      return;
    }
    btn.classList.add('is-active');
    if (nav === 'inicio') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (nav === 'herramientas') $('#toolsSection').scrollIntoView({ behavior: 'smooth' });
    if (nav === 'archivos') $('#recentSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (nav === 'ajustes') openSettingsSheet();
  });
});

/* =========================================================
   SHEET (modal inferior) — flujo genérico por herramienta
   ========================================================= */
const scrim = $('#scrim');
const sheet = $('#sheet');
const sheetContent = $('#sheetContent');

function openSheetRaw() {
  scrim.classList.add('is-open');
  sheet.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  scrim.classList.remove('is-open');
  sheet.classList.remove('is-open');
  document.body.style.overflow = '';
  setTimeout(() => { sheetContent.innerHTML = ''; }, 380);
}
scrim.addEventListener('click', closeSheet);

function openSheet(tool) {
  state.currentTool = tool;
  state.selectedFiles = [];
  state.format = 'png';
  state.quality = 'media';
  renderPickStep();
  openSheetRaw();
}

/* ---- paso 1: elegir archivos ---- */
function renderPickStep() {
  const tool = state.currentTool;
  sheetContent.innerHTML = `
    <div class="sheet-head">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="tool-icon">${icon(tool.icon)}</div>
        <div class="sheet-title">
          <h3>${tool.title}</h3>
          <p>${tool.desc}</p>
        </div>
      </div>
      <button class="sheet-close" id="sheetCloseBtn">${icon('x')}</button>
    </div>
    <div class="sheet-body">
      <div class="picker-row">
        <button class="picker-btn" id="pickFiles">
          ${icon(tool.category === 'documentos' && tool.id === 'word2pdf' ? 'word' : 'file')}
          ${tool.multiple ? 'Elegir archivos' : 'Elegir archivo'}
        </button>
        ${tool.camera ? `<button class="picker-btn" id="pickCamera">${icon('camera')}Usar cámara</button>` : ''}
      </div>

      <div class="file-list" id="fileList"></div>

      ${tool.scanMode ? `<p style="margin:0;font-size:12px;color:var(--ink-2);text-align:center;">Toca "Usar cámara" cuantas veces necesites para añadir más páginas.</p>` : ''}

      ${tool.formatChoice ? `
      <div class="option-row">
        <div class="option-label">Formato de salida</div>
        <div class="pill-group">
          <div class="pill-opt is-active" data-format="png">PNG</div>
          <div class="pill-opt" data-format="jpg">JPG</div>
        </div>
      </div>` : ''}

      ${tool.quality ? `
      <div class="option-row">
        <div class="option-label">Nivel de compresión</div>
        <div class="pill-group">
          <div class="pill-opt" data-quality="alta">Baja</div>
          <div class="pill-opt is-active" data-quality="media">Media</div>
          <div class="pill-opt" data-quality="baja">Alta</div>
        </div>
      </div>` : ''}

      <button class="primary-btn" id="convertBtn" disabled>${icon('check')}Convertir</button>
    </div>
  `;

  $('#sheetCloseBtn').addEventListener('click', closeSheet);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = tool.accept || '*/*';
  if (tool.multiple) fileInput.multiple = true;
  fileInput.addEventListener('change', (e) => handleFiles(Array.from(e.target.files)));
  document.body.appendChild(fileInput);
  $('#pickFiles').addEventListener('click', () => fileInput.click());

  if (tool.camera) {
    $('#pickCamera').addEventListener('click', () => openScanner());
  }

  if (tool.formatChoice) {
    $$('.pill-opt[data-format]').forEach((el) => {
      el.addEventListener('click', () => {
        $$('.pill-opt[data-format]').forEach((e2) => e2.classList.remove('is-active'));
        el.classList.add('is-active');
        state.format = el.dataset.format;
      });
    });
  }
  if (tool.quality) {
    $$('.pill-opt[data-quality]').forEach((el) => {
      el.addEventListener('click', () => {
        $$('.pill-opt[data-quality]').forEach((e2) => e2.classList.remove('is-active'));
        el.classList.add('is-active');
        state.quality = el.dataset.quality;
      });
    });
  }

  $('#convertBtn').addEventListener('click', runConversion);
  renderFileList();
}

async function handleFiles(newFiles) {
  const tool = state.currentTool;
  if (!tool.multiple) state.selectedFiles = [];
  state.selectedFiles.push(...newFiles);
  await renderFileList();
}

async function renderFileList() {
  const listEl = $('#fileList');
  const tool = state.currentTool;
  if (!listEl) return;
  listEl.innerHTML = '';
  for (let i = 0; i < state.selectedFiles.length; i++) {
    const f = state.selectedFiles[i];
    const row = document.createElement('div');
    row.className = 'file-row';
    let thumbHtml = `<div class="thumb icon">${icon('file')}</div>`;
    if (f.type && f.type.startsWith('image/')) {
      try {
        const url = await readAsDataURL(f);
        thumbHtml = `<img class="thumb" src="${url}" alt="">`;
      } catch (e) {}
    }
    row.innerHTML = `
      ${thumbHtml}
      <div class="info">
        <div class="n">${f.name || 'foto.jpg'}</div>
        <div class="s">${bytesToSize(f.size)}</div>
      </div>
      <button class="rm" data-idx="${i}">${icon('x')}</button>
    `;
    listEl.appendChild(row);
  }
  $$('.rm', listEl).forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedFiles.splice(Number(btn.dataset.idx), 1);
      renderFileList();
    });
  });

  const min = tool.minFiles || 1;
  const convertBtn = $('#convertBtn');
  if (convertBtn) convertBtn.disabled = state.selectedFiles.length < min;
}

/* ---- paso 2: progreso ---- */
function renderProgressStep() {
  sheetContent.innerHTML = `
    <div class="sheet-head">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="tool-icon">${icon(state.currentTool.icon)}</div>
        <div class="sheet-title"><h3>${state.currentTool.title}</h3><p>Procesando en tu celular…</p></div>
      </div>
      <button class="sheet-close" id="sheetCloseBtn">${icon('x')}</button>
    </div>
    <div class="sheet-body">
      <div class="progress-wrap">
        <div class="spinner"></div>
        <p id="progressText">Preparando…</p>
      </div>
    </div>
  `;
  $('#sheetCloseBtn').addEventListener('click', closeSheet);
}

/* ---- paso 3: resultado ---- */
function renderResultStep(blob, filename) {
  const url = URL.createObjectURL(blob);
  addRecent({ name: filename, size: blob.size, url, tool: state.currentTool });
  sheetContent.innerHTML = `
    <div class="sheet-head">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="tool-icon">${icon(state.currentTool.icon)}</div>
        <div class="sheet-title"><h3>${state.currentTool.title}</h3><p>Listo</p></div>
      </div>
      <button class="sheet-close" id="sheetCloseBtn">${icon('x')}</button>
    </div>
    <div class="sheet-body">
      <div class="result-wrap">
        <div class="result-icon">${icon('check')}</div>
        <h4>¡Archivo listo!</h4>
        <p>${filename} · ${bytesToSize(blob.size)}</p>
        <div class="result-actions">
          <button class="primary-btn" id="dlLink">${icon('download')}Guardar en el celular</button>
          <button class="ghost-btn" id="doneBtn">Hecho</button>
        </div>
      </div>
    </div>
  `;
  $('#sheetCloseBtn').addEventListener('click', closeSheet);
  $('#doneBtn').addEventListener('click', closeSheet);
  $('#dlLink').addEventListener('click', () => saveFileToDevice(blob, filename));
}

async function saveFileToDevice(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') return false; // el usuario canceló
    }
  }
  // escritorio / navegadores sin Web Share: descarga normal
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  return false;
}
const saveImageToDevice = saveFileToDevice;

function renderResultStepMultiple(items) {
  const withUrls = items.map((it) => ({ ...it, url: URL.createObjectURL(it.blob) }));

  // se guardan en Recientes automáticamente, ya que ahora se ven en la misma página
  withUrls.forEach((it) => addRecent({ name: it.filename, size: it.blob.size, url: it.url, tool: state.currentTool }));

  const cardsHtml = withUrls.map((it, idx) => `
    <div class="image-preview-card">
      <img src="${it.url}" alt="${it.filename}" data-idx="${idx}">
      <div class="image-preview-foot">
        <span>${it.filename} · ${bytesToSize(it.blob.size)}</span>
        <button class="save-img-btn" data-idx="${idx}">${icon('download')}</button>
      </div>
    </div>
  `).join('');

  sheetContent.innerHTML = `
    <div class="sheet-head">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="tool-icon">${icon(state.currentTool.icon)}</div>
        <div class="sheet-title"><h3>${state.currentTool.title}</h3><p>${withUrls.length} imagen${withUrls.length > 1 ? 'es' : ''} lista${withUrls.length > 1 ? 's' : ''}</p></div>
      </div>
      <button class="sheet-close" id="sheetCloseBtn">${icon('x')}</button>
    </div>
    <div class="sheet-body">
      <p class="save-hint">Mantén presionada una imagen para guardarla en tu galería, o usa el botón de guardar.</p>
      <div class="image-preview-list">${cardsHtml}</div>
      ${withUrls.length > 1 ? `<button class="primary-btn" id="saveAllBtn">${icon('download')}Guardar todas en la galería</button>` : ''}
      <button class="ghost-btn" id="doneBtn">Hecho</button>
    </div>
  `;
  $('#sheetCloseBtn').addEventListener('click', closeSheet);
  $('#doneBtn').addEventListener('click', closeSheet);

  $$('.save-img-btn', sheetContent).forEach((btn) => {
    btn.addEventListener('click', () => {
      const it = withUrls[Number(btn.dataset.idx)];
      saveImageToDevice(it.blob, it.filename);
    });
  });

  const saveAllBtn = $('#saveAllBtn');
  if (saveAllBtn) {
    saveAllBtn.addEventListener('click', async () => {
      const files = withUrls.map((it) => new File([it.blob], it.filename, { type: it.blob.type }));
      if (navigator.canShare && navigator.canShare({ files })) {
        try { await navigator.share({ files }); return; } catch (err) { /* cae a descarga individual */ }
      }
      for (let i = 0; i < withUrls.length; i++) {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = withUrls[i].url;
          a.download = withUrls[i].filename;
          a.click();
        }, i * 300);
      }
    });
  }
}

function renderErrorStep(err) {
  console.error(err);
  sheetContent.innerHTML = `
    <div class="sheet-head">
      <div class="sheet-title"><h3>Algo salió mal</h3><p>Intenta de nuevo con otro archivo</p></div>
      <button class="sheet-close" id="sheetCloseBtn">${icon('x')}</button>
    </div>
    <div class="sheet-body">
      <button class="ghost-btn" id="backBtn">Volver a intentar</button>
    </div>
  `;
  $('#sheetCloseBtn').addEventListener('click', closeSheet);
  $('#backBtn').addEventListener('click', renderPickStep);
}

async function runConversion() {
  const tool = state.currentTool;
  renderProgressStep();
  const onProgress = (msg) => {
    const p = $('#progressText');
    if (p) p.textContent = msg;
  };
  try {
    if (tool.id === 'pdf2img') {
      const results = await pdfToImages(state.selectedFiles, onProgress, state.format);
      renderResultStepMultiple(results);
      return;
    }
    const blob = await tool.run(state.selectedFiles, onProgress, { quality: state.quality, format: state.format });
    const filename = tool.outputName();
    renderResultStep(blob, filename);
  } catch (err) {
    renderErrorStep(err);
  }
}

/* =========================================================
   ESCÁNER CON MARCO GUÍA — cámara en vivo con overlay en
   forma de documento; al capturar, recorta justo esa zona
   ========================================================= */
let scannerStream = null;
let scannerPageCount = 0;

function buildScannerDom() {
  const wrap = document.createElement('div');
  wrap.id = 'scannerOverlay';
  wrap.className = 'scanner-overlay';
  wrap.innerHTML = `
    <video id="scannerVideo" autoplay playsinline muted></video>
    <div class="scanner-mask-bar" id="maskTop"></div>
    <div class="scanner-mask-bar" id="maskBottom"></div>
    <div class="scanner-mask-bar" id="maskLeft"></div>
    <div class="scanner-mask-bar" id="maskRight"></div>
    <div class="scanner-frame" id="scannerFrame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
    </div>
    <div class="scanner-top">
      <button class="icon-btn glass" id="scannerCancel">${icon('x')}</button>
      <div class="scanner-hint glass">Alinea el documento dentro del marco</div>
      <div style="width:42px;"></div>
    </div>
    <div class="scanner-bottom">
      <div class="scanner-count" id="scannerCount">0 páginas</div>
      <button class="scanner-shutter" id="scannerShutter" aria-label="Capturar"></button>
      <button class="scanner-done glass" id="scannerDone">Listo</button>
    </div>
  `;
  document.body.appendChild(wrap);
  return wrap;
}

function defaultFrameTarget(wrap) {
  const contBox = wrap.getBoundingClientRect();
  const fw = contBox.width * 0.84;
  const fh = Math.min(contBox.height * 0.64, fw * 1.414);
  return {
    left: (contBox.width - fw) / 2,
    top: contBox.height * 0.16,
    width: fw,
    height: fh,
    contW: contBox.width,
    contH: contBox.height,
  };
}

function positionFrameAndMask(wrap, target) {
  const frameEl = $('#scannerFrame', wrap);
  if (!frameEl) return;
  const { left, top, width, height } = target;
  const contW = target.contW ?? wrap.getBoundingClientRect().width;
  const contH = target.contH ?? wrap.getBoundingClientRect().height;

  frameEl.style.left = `${left}px`;
  frameEl.style.top = `${top}px`;
  frameEl.style.width = `${width}px`;
  frameEl.style.height = `${height}px`;
  frameEl.style.right = 'auto';
  frameEl.style.margin = '0';
  frameEl.style.maxHeight = 'none';
  frameEl.style.aspectRatio = 'auto';

  const maskTop = $('#maskTop', wrap);
  const maskBottom = $('#maskBottom', wrap);
  const maskLeft = $('#maskLeft', wrap);
  const maskRight = $('#maskRight', wrap);
  if (maskTop) { maskTop.style.left = '0'; maskTop.style.top = '0'; maskTop.style.width = '100%'; maskTop.style.height = `${Math.max(0, top)}px`; }
  if (maskBottom) { maskBottom.style.left = '0'; maskBottom.style.top = `${top + height}px`; maskBottom.style.width = '100%'; maskBottom.style.height = `${Math.max(0, contH - (top + height))}px`; }
  if (maskLeft) { maskLeft.style.left = '0'; maskLeft.style.top = `${top}px`; maskLeft.style.width = `${Math.max(0, left)}px`; maskLeft.style.height = `${height}px`; }
  if (maskRight) { maskRight.style.left = `${left + width}px`; maskRight.style.top = `${top}px`; maskRight.style.width = `${Math.max(0, contW - (left + width))}px`; maskRight.style.height = `${height}px`; }
}

async function openScanner() {
  scannerPageCount = 0;
  const wrap = buildScannerDom();
  const video = $('#scannerVideo', wrap);

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = scannerStream;
  } catch (err) {
    // sin permiso de cámara o no soportado: usamos el selector nativo como respaldo
    closeScanner();
    const fallback = document.createElement('input');
    fallback.type = 'file';
    fallback.accept = 'image/*';
    fallback.capture = 'environment';
    fallback.addEventListener('change', (e) => handleFiles(Array.from(e.target.files)));
    document.body.appendChild(fallback);
    fallback.click();
    showToast('No se pudo abrir la cámara, usa el selector nativo');
    return;
  }

  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    wrap.classList.add('is-open');
    positionFrameAndMask(wrap, defaultFrameTarget(wrap)); // marco visible de inmediato, no espera a la detección
  });

  $('#scannerCancel', wrap).addEventListener('click', closeScanner);
  $('#scannerDone', wrap).addEventListener('click', () => {
    closeScanner();
    renderFileList();
  });
  $('#scannerShutter', wrap).addEventListener('click', () => captureScannerFrame(wrap));

  video.addEventListener('loadedmetadata', () => startAutoFrame(wrap), { once: true });
}

function closeScanner() {
  const wrap = $('#scannerOverlay');
  stopAutoFrame();
  if (scannerStream) {
    scannerStream.getTracks().forEach((t) => t.stop());
    scannerStream = null;
  }
  if (wrap) {
    wrap.classList.remove('is-open');
    setTimeout(() => wrap.remove(), 260);
  }
  document.body.style.overflow = '';
}

/* ---- auto-ajuste del marco al tamaño real del documento ----
   Se analiza el video en vivo a baja resolución: se calcula un umbral
   que se adapta a la luz de cada escena (método de Otsu) y se busca
   la región conexa más grande con forma de hoja (probando tanto
   "documento claro sobre fondo oscuro" como al revés). Si no hay
   nada confiable, se usa un marco por defecto centrado. */
let scannerDetectTimer = null;
let scannerFrameState = null;
let scannerDetectCanvas = null;
let scannerGoodTicksLeft = 0;
let scannerLastGoodTarget = null;

function otsuThreshold(hist, total) {
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) { bestVar = between; best = t; }
  }
  return best;
}

/* componente conexa más grande dentro de una máscara binaria (BFS con pila) */
function largestComponent(bin, w, h, visited, stack) {
  visited.fill(0);
  let best = null;
  const n = w * h;
  for (let start = 0; start < n; start++) {
    if (bin[start] !== 1 || visited[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    visited[start] = 1;
    let count = 0, minX = w, maxX = 0, minY = h, maxY = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % w, y = (idx / w) | 0;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && bin[idx - 1] === 1 && !visited[idx - 1]) { visited[idx - 1] = 1; stack[sp++] = idx - 1; }
      if (x < w - 1 && bin[idx + 1] === 1 && !visited[idx + 1]) { visited[idx + 1] = 1; stack[sp++] = idx + 1; }
      if (y > 0 && bin[idx - w] === 1 && !visited[idx - w]) { visited[idx - w] = 1; stack[sp++] = idx - w; }
      if (y < h - 1 && bin[idx + w] === 1 && !visited[idx + w]) { visited[idx + w] = 1; stack[sp++] = idx + w; }
    }
    const bboxW = maxX - minX + 1, bboxH = maxY - minY + 1;
    const area = bboxW * bboxH;
    if (!best || count > best.count) best = { count, minX, minY, maxX, maxY, bboxW, bboxH, area };
  }
  return best;
}

function scoreCandidate(cand, procW, procH) {
  if (!cand) return null;
  const frameArea = procW * procH;
  const areaRatio = cand.area / frameArea;
  const fillRatio = cand.count / cand.area;
  const aspect = cand.bboxW / cand.bboxH;
  if (areaRatio < 0.10 || areaRatio > 0.94) return null;
  if (fillRatio < 0.5) return null;
  if (aspect < 0.35 || aspect > 2.8) return null;
  // si ocupa casi todo el cuadro por los 4 lados, probablemente es el fondo, no una hoja
  if (cand.minX <= 1 && cand.maxX >= procW - 2 && cand.minY <= 1 && cand.maxY >= procH - 2) return null;

  const cx = (cand.minX + cand.maxX) / 2 / procW;
  const cy = (cand.minY + cand.maxY) / 2 / procH;
  const centerDist = Math.hypot(cx - 0.5, cy - 0.5);
  const score = fillRatio * 0.5 + (1 - Math.min(1, centerDist * 1.4)) * 0.5;
  return { rect: { x: cand.minX / procW, y: cand.minY / procH, w: cand.bboxW / procW, h: cand.bboxH / procH }, score };
}

function detectDocumentRect(video) {
  const nativeW = video.videoWidth, nativeH = video.videoHeight;
  if (!nativeW || !nativeH) return null;

  const procW = 150;
  const procH = Math.max(1, Math.round((procW * nativeH) / nativeW));
  const n = procW * procH;
  if (!scannerDetectCanvas) scannerDetectCanvas = document.createElement('canvas');
  scannerDetectCanvas.width = procW;
  scannerDetectCanvas.height = procH;
  const ctx = scannerDetectCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, procW, procH);

  let data;
  try {
    data = ctx.getImageData(0, 0, procW, procH).data;
  } catch (e) { return null; }

  const lum = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
    lum[p] = l;
    hist[l]++;
  }
  const threshold = otsuThreshold(hist, n);

  const bright = new Uint8Array(n);
  const dark = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const isBright = lum[p] > threshold ? 1 : 0;
    bright[p] = isBright;
    dark[p] = isBright ? 0 : 1;
  }

  const visited = new Uint8Array(n);
  const stack = new Int32Array(n);

  const candBright = scoreCandidate(largestComponent(bright, procW, procH, visited, stack), procW, procH);
  const candDark = scoreCandidate(largestComponent(dark, procW, procH, visited, stack), procW, procH);

  let winner = null;
  if (candBright && candDark) winner = candBright.score >= candDark.score ? candBright : candDark;
  else winner = candBright || candDark;

  return winner ? winner.rect : null;
}

function startAutoFrame(wrap) {
  const video = $('#scannerVideo', wrap);
  scannerFrameState = null;
  scannerGoodTicksLeft = 0;
  scannerLastGoodTarget = null;

  scannerDetectTimer = setInterval(() => {
    try {
      const contBox = wrap.getBoundingClientRect();
      const nativeW = video.videoWidth, nativeH = video.videoHeight;
      if (!nativeW || !nativeH) return;

      const coverScale = Math.max(contBox.width / nativeW, contBox.height / nativeH);
      const offsetX = (contBox.width - nativeW * coverScale) / 2;
      const offsetY = (contBox.height - nativeH * coverScale) / 2;

      let det = null;
      try { det = detectDocumentRect(video); } catch (e) { det = null; }

      let target;
      if (det) {
        target = {
          left: offsetX + det.x * nativeW * coverScale,
          top: offsetY + det.y * nativeH * coverScale,
          width: det.w * nativeW * coverScale,
          height: det.h * nativeH * coverScale,
        };
        scannerLastGoodTarget = target;
        scannerGoodTicksLeft = 6; // mantiene la última posición buena unos instantes si se pierde el tracking
      } else if (scannerGoodTicksLeft > 0 && scannerLastGoodTarget) {
        target = scannerLastGoodTarget;
        scannerGoodTicksLeft--;
      } else {
        target = defaultFrameTarget(wrap);
      }
      target.contW = contBox.width;
      target.contH = contBox.height;

      if (!scannerFrameState) scannerFrameState = { ...target };
      const L = 0.32;
      scannerFrameState.left += (target.left - scannerFrameState.left) * L;
      scannerFrameState.top += (target.top - scannerFrameState.top) * L;
      scannerFrameState.width += (target.width - scannerFrameState.width) * L;
      scannerFrameState.height += (target.height - scannerFrameState.height) * L;
      scannerFrameState.contW = contBox.width;
      scannerFrameState.contH = contBox.height;

      positionFrameAndMask(wrap, scannerFrameState);
    } catch (e) {
      /* nunca dejar que un error de detección rompa el escáner */
    }
  }, 220);
}

function stopAutoFrame() {
  if (scannerDetectTimer) {
    clearInterval(scannerDetectTimer);
    scannerDetectTimer = null;
  }
  scannerFrameState = null;
  scannerLastGoodTarget = null;
}

function captureScannerFrame(wrap) {
  const video = $('#scannerVideo', wrap);
  const frame = $('#scannerFrame', wrap);
  if (!video.videoWidth) return;

  const videoBox = video.getBoundingClientRect();
  const frameBox = frame.getBoundingClientRect();

  // el <video> se muestra con object-fit:cover; calculamos el recorte real
  // en píxeles nativos que corresponde al área marcada por el marco guía
  const nativeW = video.videoWidth;
  const nativeH = video.videoHeight;
  const coverScale = Math.max(videoBox.width / nativeW, videoBox.height / nativeH);
  const renderW = nativeW * coverScale;
  const renderH = nativeH * coverScale;
  const offsetX = (videoBox.width - renderW) / 2;
  const offsetY = (videoBox.height - renderH) / 2;

  const sx = (frameBox.left - videoBox.left - offsetX) / coverScale;
  const sy = (frameBox.top - videoBox.top - offsetY) / coverScale;
  const sw = frameBox.width / coverScale;
  const sh = frameBox.height / coverScale;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    scannerPageCount += 1;
    const countEl = $('#scannerCount');
    if (countEl) countEl.textContent = `${scannerPageCount} página${scannerPageCount > 1 ? 's' : ''}`;
    const file = new File([blob], `escaneo-${Date.now()}.jpg`, { type: 'image/jpeg' });
    handleFiles([file]);
    flashScanner(wrap);
  }, 'image/jpeg', 0.92);
}

function flashScanner(wrap) {
  const f = document.createElement('div');
  f.className = 'scanner-flash';
  wrap.appendChild(f);
  requestAnimationFrame(() => { f.style.opacity = '0'; });
  setTimeout(() => f.remove(), 260);
}
const recentList = $('#recentList');
function renderRecent() {
  if (state.recent.length === 0) {
    recentList.innerHTML = `
      <div class="recent-empty glass">
        ${icon('empty')}
        <div>Tus conversiones aparecerán aquí</div>
      </div>`;
    return;
  }
  recentList.innerHTML = '';
  state.recent.slice().reverse().forEach((item) => {
    const row = document.createElement('div');
    row.className = 'recent-item glass';
    row.innerHTML = `
      <div class="recent-thumb">${icon(item.tool.icon)}</div>
      <div class="recent-meta">
        <div class="name">${item.name}</div>
        <div class="sub">${item.tool.title} · ${bytesToSize(item.size)}</div>
      </div>
      <button class="recent-dl">${icon('download')}</button>
    `;
    $('.recent-dl', row).addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = item.name;
      a.click();
    });
    recentList.appendChild(row);
  });
}
function addRecent(item) {
  state.recent.push(item);
  renderRecent();
}
$('#clearRecent').addEventListener('click', () => {
  state.recent = [];
  renderRecent();
});
renderRecent();

/* =========================================================
   AJUSTES / INSTALAR
   ========================================================= */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function handleInstallClick() {
  if (isStandalone()) {
    showToast('BravoFiles ya está instalada');
    return;
  }
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    return;
  }
  if (isIos()) {
    openIosInstallSheet();
  } else {
    openIosInstallSheet(true);
  }
}
$('#btnInstall').addEventListener('click', handleInstallClick);

function openIosInstallSheet(generic = false) {
  sheetContent.innerHTML = `
    <div class="sheet-head">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="tool-icon">${icon('download')}</div>
        <div class="sheet-title"><h3>Instalar BravoFiles</h3><p>Úsala como una app nativa</p></div>
      </div>
      <button class="sheet-close" id="sheetCloseBtn">${icon('x')}</button>
    </div>
    <div class="sheet-body">
      <div class="ios-steps">
        <div class="ios-step"><div class="num">1</div><p>Toca el botón <b>Compartir</b> ${generic ? '(o el menú ⋮ del navegador)' : ''} en la barra de tu navegador.</p></div>
        <div class="ios-step"><div class="num">2</div><p>Selecciona <b>"Añadir a pantalla de inicio"</b>.</p></div>
        <div class="ios-step"><div class="num">3</div><p>Toca <b>"Añadir"</b>. El ícono de BravoFiles aparecerá en tu pantalla de inicio, como una app.</p></div>
      </div>
      <button class="ghost-btn" id="doneBtn2">Entendido</button>
    </div>
  `;
  $('#sheetCloseBtn').addEventListener('click', closeSheet);
  $('#doneBtn2').addEventListener('click', closeSheet);
  openSheetRaw();
}

function openSettingsSheet() {
  sheetContent.innerHTML = `
    <div class="sheet-head">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="tool-icon">${icon('folder')}</div>
        <div class="sheet-title"><h3>Ajustes</h3><p>BravoFiles</p></div>
      </div>
      <button class="sheet-close" id="sheetCloseBtn">${icon('x')}</button>
    </div>
    <div class="sheet-body">
      <button class="primary-btn" id="installFromSettings">${icon('download')}Añadir a pantalla de inicio</button>
      <button class="ghost-btn" id="clearFromSettings">Borrar recientes</button>
      <p style="text-align:center;font-size:11.5px;color:var(--ink-3);margin:4px 0 0 0;">
        Todas las conversiones se procesan en tu celular. Ningún archivo se sube a internet.
      </p>
    </div>
  `;
  $('#sheetCloseBtn').addEventListener('click', closeSheet);
  $('#installFromSettings').addEventListener('click', handleInstallClick);
  $('#clearFromSettings').addEventListener('click', () => { state.recent = []; renderRecent(); showToast('Recientes borrados'); });
  openSheetRaw();
}
$('#btnSettings').addEventListener('click', openSettingsSheet);

/* =========================================================
   SERVICE WORKER
   ========================================================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

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

async function imagesToPdf(files, onProgress) {
  const { jsPDF } = window.jspdf;
  let doc = null;
  for (let i = 0; i < files.length; i++) {
    onProgress?.(`Añadiendo página ${i + 1} de ${files.length}…`);
    const dataUrl = await readAsDataURL(files[i]);
    const img = await loadImage(dataUrl);
    const isPng = files[i].type === 'image/png';
    const pageW = img.width * 72 / 96;
    const pageH = img.height * 72 / 96;
    if (!doc) {
      doc = new jsPDF({ unit: 'pt', format: [pageW, pageH] });
    } else {
      doc.addPage([pageW, pageH]);
    }
    doc.addImage(dataUrl, isPng ? 'PNG' : 'JPEG', 0, 0, pageW, pageH);
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
    if (!doc) doc = new jsPDF({ unit: 'pt', format: [pageW, pageH] });
    else doc.addPage([pageW, pageH]);
    doc.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH);
  }
  return doc.output('blob');
}

async function pdfToImages(files, onProgress, format = 'png') {
  const file = files[0];
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = format === 'png' ? 'png' : 'jpg';

  if (pdf.numPages === 1) {
    onProgress?.('Exportando imagen…');
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL(mime, 0.92);
    const blob = await (await fetch(dataUrl)).blob();
    return { blob, filename: `pagina.${ext}` };
  }

  const zip = new JSZip();
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Exportando página ${i} de ${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL(mime, 0.92);
    zip.file(`pagina-${String(i).padStart(2, '0')}.${ext}`, dataUrl.split(',')[1], { base64: true });
  }
  onProgress?.('Comprimiendo en ZIP…');
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, filename: `paginas.zip` };
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
    run: async (files, onProgress, opts) => {
      const { blob, filename } = await pdfToImages(files, onProgress, opts.format);
      return blob;
      // filename handled via closure below
    },
    outputName: () => `paginas-${Date.now()}`,
    outputMime: 'application/octet-stream',
    dynamicOutput: true,
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
    const camInput = document.createElement('input');
    camInput.type = 'file';
    camInput.accept = 'image/*';
    camInput.capture = 'environment';
    camInput.addEventListener('change', (e) => handleFiles(Array.from(e.target.files)));
    document.body.appendChild(camInput);
    $('#pickCamera').addEventListener('click', () => camInput.click());
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
          <a class="primary-btn" href="${url}" download="${filename}" id="dlLink">${icon('download')}Descargar</a>
          <button class="ghost-btn" id="doneBtn">Hecho</button>
        </div>
      </div>
    </div>
  `;
  $('#sheetCloseBtn').addEventListener('click', closeSheet);
  $('#doneBtn').addEventListener('click', closeSheet);
  $('#dlLink').addEventListener('click', () => {
    addRecent({ name: filename, size: blob.size, url, tool: state.currentTool });
    showToast('Guardado en Recientes');
  });
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
    let blob, filename;
    if (tool.id === 'pdf2img') {
      const res = await pdfToImages(state.selectedFiles, onProgress, state.format);
      blob = res.blob;
      filename = res.filename;
    } else {
      blob = await tool.run(state.selectedFiles, onProgress, { quality: state.quality, format: state.format });
      filename = tool.outputName();
    }
    renderResultStep(blob, filename);
  } catch (err) {
    renderErrorStep(err);
  }
}

/* =========================================================
   RECIENTES
   ========================================================= */
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

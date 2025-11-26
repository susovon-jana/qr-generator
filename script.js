/* ============================================================
   1. DOM REFERENCES (Cached for Performance)
============================================================ */
const DOM = {
  type: el("type"),
  area: el("inputs-area"),
  bgCheck: el("hasBackground"),
  bgColor: el("bgColor"),
  qrColor: el("qrColor"),
  dots: el("dotStyle"),
  eyes: el("eyeStyle"),

  logoUpload: el("logoUpload"),
  logoSize: el("logoSize"),
  logoRadius: el("logoRadius"),
  logoSizeLabel: el("logoSizeLabel"),
  logoRadiusLabel: el("logoRadiusLabel"),
  logoRemove: el("removeLogo"),

  resolution: el("resolution"),
  format: el("format"),

  downloadPng: el("downloadPng"),
  downloadSvg: el("downloadSvg"),
  copyQR: el("copyQR"),
  reset: el("resetBtn"),

  preview: el("qrPreview"),
  error: el("error")
};

/* Utility GET */
function el(id) { return document.getElementById(id); }

/* ============================================================
   2. GLOBAL STATE
============================================================ */
let lastPayload = "";
let currentLogoDataURL = null;
let debounceTimer = null;

const PREVIEW_SIZE = 380;

/* ============================================================
   3. INPUT FIELD CONFIGURATION (Modular)
============================================================ */
const FIELD_MAP = {
  url: [{ id: "value_url", label: "Website URL", type: "url", req: true }],
  phone: [{ id: "value_phone", label: "Phone Number", type: "tel", req: true }],
  whatsapp: [
    { id: "value_wa", label: "WhatsApp Number", type: "tel", req: true },
    { id: "value_wa_msg", label: "Message", type: "text" }
  ],
  email: [
    { id: "value_email", label: "Email Address", type: "email", req: true },
    { id: "value_email_sub", label: "Subject", type: "text" },
    { id: "value_email_body", label: "Body", type: "textarea" }
  ],
  text: [{ id: "value_text", label: "Custom Text", type: "textarea", req: true }],
  wifi: [
    { id: "value_ssid", label: "Network SSID", type: "text", req: true },
    { id: "value_password", label: "Password", type: "password" },
    { id: "value_auth", label: "Encryption", type: "select", options: ["WPA","WEP","nopass"], req: true }
  ],
  sms: [
  { id: "sms_number", label: "Phone Number", type: "tel", req: true },
  { id: "sms_message", label: "Message", type: "textarea" }
  ],
  multiurl: [
    { id: "multi_1", label: "Primary URL", type: "url", req: true },
    { id: "multi_2", label: "Secondary URL", type: "url" },
    { id: "multi_3", label: "Third URL", type: "url" }
  ],

  contact: [
    { id: "c_name", label: "Full Name", type: "text", req: true },
    { id: "c_phone", label: "Phone Number", type: "tel" },
    { id: "c_email", label: "Email", type: "email" },
    { id: "c_org", label: "Organization", type: "text" },
    { id: "c_title", label: "Job Title", type: "text" }
  ],
    upi: [
      { id: "value_vpa", label: "UPI ID (VPA)", type: "text", req: true },
      { id: "value_name", label: "Payee Name", type: "text" },
      { id: "value_amount", label: "Amount", type: "number" },
      { id: "value_note", label: "Note / Description", type: "text" }
  ]
};

/* ============================================================
   4. RENDER INPUT FIELDS BASED ON SELECTED TYPE
============================================================ */
function renderFields() {
  DOM.area.innerHTML = "";
  const fields = FIELD_MAP[DOM.type.value] || [];

  fields.forEach(f => {
    const group = document.createElement("div");
    group.className = "input-group";

    const label = document.createElement("label");
    label.textContent = f.label;

    let input = null;

    if (f.type === "textarea") {
      input = document.createElement("textarea");
    }
    else if (f.type === "select") {
      input = document.createElement("select");
      f.options.forEach(o => {
        const opt = document.createElement("option");
        opt.value = o;
        opt.textContent = o;
        input.appendChild(opt);
      });
    }
    else {
      input = document.createElement("input");
      input.type = f.type;
      if (f.type === "number") input.step = "0.01";
    }

    input.id = f.id;
    if (f.req) input.required = true;

    group.appendChild(label);
    group.appendChild(input);
    DOM.area.appendChild(group);
  });

  DOM.area.querySelectorAll("input, textarea, select")
    .forEach(el => el.addEventListener("input", debouncedPreview));
}

/* ============================================================
   5. PAYLOAD GENERATOR FOR ALL QR TYPES
============================================================ */
function getValue(id) { return (el(id)?.value || "").trim(); }

function buildPayload() {
  const type = DOM.type.value;

  switch (type) {
    case "url": {
      let v = getValue("value_url");
      if (!v) throw Error("Please enter a URL.");
      if (!/^https?:\/\//i.test(v)) v = "https://" + v;
      return v;
    }

    case "phone": {
      const p = getValue("value_phone").replace(/[^\d+]/g, "");
      if (!p) throw Error("Please enter a phone number.");
      return "tel:" + p;
    }

    case "whatsapp": {
      const num = getValue("value_wa").replace(/[^\d]/g, "");
      if (!num) throw Error("Please enter WhatsApp number.");
      const msg = getValue("value_wa_msg");
      return msg
        ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/${num}`;
    }

    case "email": {
      const email = getValue("value_email");
      if (!email) throw Error("Please enter an email.");
      const p = new URLSearchParams();
      if (getValue("value_email_sub")) p.set("subject", getValue("value_email_sub"));
      if (getValue("value_email_body")) p.set("body", getValue("value_email_body"));
      return p.toString() ? `mailto:${email}?${p.toString()}` : `mailto:${email}`;
    }

    case "text": {
      const t = getValue("value_text");
      if (!t) throw Error("Please enter text.");
      return t;
    }

    case "wifi": {
      const ssid = getValue("value_ssid");
      if (!ssid) throw Error("Please enter SSID.");
      const auth = getValue("value_auth") || "WPA";
      const pw = getValue("value_password") || "";
      const esc = s => s.replace(/([\\;,:"])/g, "\\$1");
      const pwPart = auth === "nopass" ? "" : `;P:${esc(pw)}`;
      return `WIFI:T:${auth};S:${esc(ssid)}${pwPart};H:false;;`;
    }

    case "sms": {
  let num = getValue("sms_number").replace(/[^\d+]/g, "");
  if (!num) throw Error("Enter phone number for SMS.");
  const msg = getValue("sms_message");

  return msg
    ? `sms:${num}?body=${encodeURIComponent(msg)}`
    : `sms:${num}`;
}

case "multiurl": {
  const u1 = getValue("multi_1");
  const u2 = getValue("multi_2");
  const u3 = getValue("multi_3");

  if (!u1) throw Error("Primary URL required.");

  return [u1, u2, u3].filter(v => v).join("\n");
}


case "contact": {
  const name = getValue("c_name");
  if (!name) throw Error("Full name required.");

  const phone = getValue("c_phone");
  const email = getValue("c_email");
  const org = getValue("c_org");
  const title = getValue("c_title");

  return `BEGIN:VCARD
VERSION:3.0
FN:${name}
ORG:${org || ""}
TITLE:${title || ""}
TEL:${phone || ""}
EMAIL:${email || ""}
END:VCARD`;
}


    case "upi": {
      const vpa = getValue("value_vpa");
      if (!vpa) throw Error("Please enter UPI ID.");
      const p = new URLSearchParams({ pa: vpa, cu: "INR" });
      if (getValue("value_name")) p.set("pn", getValue("value_name"));
      if (getValue("value_amount")) p.set("am", parseFloat(getValue("value_amount")).toFixed(2));
      if (getValue("value_note")) p.set("tn", getValue("value_note"));
      return "upi://pay?" + p.toString();
    }
  }

  throw Error("Unsupported QR type.");
}

/* ============================================================
   6. SUPPORT: LOGO LOADING + CANVAS ROUND RECT
============================================================ */
function fileToDataURL(file) {
  return new Promise(res => {
    if (!file) return res(null);
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej("Image load failed");
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

/* ============================================================
   7. COMPOSE QR WITH EMBEDDED LOGO (Canvas)
============================================================ */
async function composeQR({
  payload, size, logoPct, radiusPct,
  bg, color, dots, eyes
}) {
  const qr = new QRCodeStyling({
    width: size,
    height: size,
    data: payload,
    backgroundOptions: { color: bg },
    dotsOptions: { color, type: dots },
    cornersSquareOptions: { type: eyes, color },
    qrOptions: { errorCorrectionLevel: "H" }
  });

  const tempDiv = document.createElement("div");
  await qr.append(tempDiv);

  const srcCanvas = tempDiv.querySelector("canvas");

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (srcCanvas) ctx.drawImage(srcCanvas, 0, 0, size, size);

  if (currentLogoDataURL) {
    const box = Math.round(size * (logoPct / 100));
    const x = (size - box) / 2;
    const y = x;
    const radius = Math.round(box * (radiusPct / 100));
    const pad = Math.round(box * 0.06);

    ctx.save();
    roundRect(ctx, x, y, box, box, radius);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    const img = await loadImage(currentLogoDataURL);
    const maxW = box - pad * 2;
    const maxH = box - pad * 2;
    const scale = Math.min(maxW / img.width, maxH / img.height);

    const w = img.width * scale;
    const h = img.height * scale;
    const cx = x + (box - w) / 2;
    const cy = y + (box - h) / 2;

    ctx.save();
    roundRect(ctx, cx, cy, w, h, radius);
    ctx.clip();
    ctx.drawImage(img, cx, cy, w, h);
    ctx.restore();
  }

  return canvas;
}

/* ============================================================
   8. PREVIEW RENDERING (Debounced)
============================================================ */
function debounce(fn, ms = 160) {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), ms);
  };
}

async function renderPreview() {
  DOM.error.textContent = "";

  try {
    lastPayload = buildPayload();
  } catch (err) {
    DOM.error.textContent = err.message;
    disableButtons();
    return;
  }

  try {
    const canvas = await composeQR({
      payload: lastPayload,
      size: PREVIEW_SIZE,
      logoPct: +DOM.logoSize.value,
      radiusPct: +DOM.logoRadius.value,
      bg: DOM.bgCheck.checked ? DOM.bgColor.value : "transparent",
      color: DOM.qrColor.value,
      dots: DOM.dots.value,
      eyes: DOM.eyes.value
    });

    DOM.preview.innerHTML = "";
    DOM.preview.appendChild(canvas);
    enableButtons();
  } catch {
    DOM.error.textContent = "Failed to render preview.";
    disableButtons();
  }
}

const debouncedPreview = debounce(renderPreview);

/* ============================================================
   9. DOWNLOAD (PNG / SVG)
============================================================ */
async function download(type) {
  if (!lastPayload) return;

  const size = +DOM.resolution.value;

  const canvas = await composeQR({
    payload: lastPayload,
    size,
    logoPct: +DOM.logoSize.value,
    radiusPct: +DOM.logoRadius.value,
    bg: DOM.bgCheck.checked ? DOM.bgColor.value : "transparent",
    color: DOM.qrColor.value,
    dots: DOM.dots.value,
    eyes: DOM.eyes.value
  });

  if (type === "png") {
    canvas.toBlob(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `qr-${Date.now()}.png`;
      a.click();
    });
  } else {
    const png = canvas.toDataURL("image/png");
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <image href="${png}" width="${size}" height="${size}" />
      </svg>
    `;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${Date.now()}.svg`;
    a.click();
  }
}

/* ============================================================
   10. COPY TO CLIPBOARD
============================================================ */
async function copyQR() {
  const canvas = DOM.preview.querySelector("canvas");
  if (!canvas) return;

  canvas.toBlob(async blob => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);

      DOM.copyQR.textContent = "Copied!";
      setTimeout(() => (DOM.copyQR.textContent = "Copy QR"), 1200);
    } catch {
      DOM.error.textContent = "Clipboard permission denied.";
    }
  });
}

/* ============================================================
   11. BUTTON STATE HANDLERS
============================================================ */
function disableButtons() {
  DOM.downloadPng.disabled = true;
  DOM.downloadSvg.disabled = true;
  DOM.copyQR.disabled = true;
}

function enableButtons() {
  DOM.downloadPng.disabled = false;
  DOM.downloadSvg.disabled = false;
  DOM.copyQR.disabled = false;
}

/* ============================================================
   12. EVENT LISTENERS
============================================================ */

/* Render fields when QR type changes */
DOM.type.addEventListener("change", () => {
  renderFields();
  debouncedPreview();
});

/* Appearance-related inputs */
[
  DOM.bgCheck, DOM.bgColor, DOM.qrColor,
  DOM.dots, DOM.eyes, DOM.resolution, DOM.format
].forEach(el => el.addEventListener("input", debouncedPreview));

/* Logo upload */
DOM.logoUpload.addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return currentLogoDataURL = null;

  if (!file.type.startsWith("image/")) {
    DOM.error.textContent = "Logo must be an image.";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    DOM.error.textContent = "Logo must be less than 8 MB.";
    return;
  }

  currentLogoDataURL = await fileToDataURL(file);
  debouncedPreview();
});

/* Remove logo */
DOM.logoRemove.addEventListener("click", () => {
  currentLogoDataURL = null;
  DOM.logoUpload.value = "";
  debouncedPreview();
});

/* Logo sliders */
DOM.logoSize.addEventListener("input", () => {
  DOM.logoSizeLabel.textContent = DOM.logoSize.value + "%";
  debouncedPreview();
});
DOM.logoRadius.addEventListener("input", () => {
  DOM.logoRadiusLabel.textContent = DOM.logoRadius.value + "%";
  debouncedPreview();
});

/* Actions */
DOM.downloadPng.addEventListener("click", () => download("png"));
DOM.downloadSvg.addEventListener("click", () => download("svg"));
DOM.copyQR.addEventListener("click", copyQR);

/* Reset */
DOM.reset.addEventListener("click", () => {
  document.getElementById("qr-form").reset();
  currentLogoDataURL = null;
  lastPayload = "";
  DOM.preview.innerHTML = `<p class='muted-text'>Live preview will appear here.</p>`;
  disableButtons();
  renderFields();
});

/* ============================================================
   13. INITIALIZATION
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  renderFields();
  disableButtons();
  debouncedPreview();
});

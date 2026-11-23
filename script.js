const slider = document.querySelector(".build__slider");
const list  = document.querySelector(".instructions__list");
const canvas = document.querySelector("#build-canvas");
const tools  = document.querySelectorAll(".build__tool");
const trash = document.querySelector(".build__delete");
const slots   = document.querySelectorAll(".storage__slot");
const puppets = [];

const SHAPE_SIZE = 80;
let topZ = 1; 

function updateProgress() {
	list.style.setProperty("--progress", slider.value / slider.max);
}

function createShape(tool) {
  const shape = document.createElement("div");
  shape.className = "shape";
  shape.dataset.type = tool.dataset.tool;
  shape.append(tool.querySelector("svg").cloneNode(true));

  // formas já colocadas podem ser agarradas outra vez
  shape.addEventListener("pointerdown", (e) => {
    const box = shape.getBoundingClientRect();
    beginDrag(shape, e, { x: e.clientX - box.left, y: e.clientY - box.top }, false);
  });

  return shape;
}

function beginDrag(shape, e, grab, isNew) {
  const rect = canvas.getBoundingClientRect();
  const prev = { left: shape.style.left, top: shape.style.top };

  shape.setPointerCapture(e.pointerId);   // continua a receber eventos mesmo fora do elemento
  shape.style.zIndex = ++topZ;
  shape.classList.add("is-dragging");

  function move(ev) {
    shape.style.left = `${ev.clientX - rect.left - grab.x}px`;
    shape.style.top  = `${ev.clientY - rect.top  - grab.y}px`;
  }

  function end() {
    shape.removeEventListener("pointermove", move);
    shape.removeEventListener("pointerup", end);
    shape.removeEventListener("pointercancel", end);
    shape.classList.remove("is-dragging");

    // o centro da forma está dentro do canvas?
    const box = shape.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const inside = cx >= rect.left && cx <= rect.right &&
                   cy >= rect.top  && cy <= rect.bottom;

    if (!inside) {
      if (isNew) shape.remove();                  // forma nova largada fora: descarta
      else Object.assign(shape.style, prev);      // forma antiga: volta onde estava
    }
    //se arrasta para o lixo apaga !
    const t = trash.getBoundingClientRect();
    const overTrash = cx >= t.left - 20 && cx <= t.right + 20 &&
                      cy >= t.top  - 20 && cy <= t.bottom + 20;

    if (overTrash) {
      shape.remove();
      return;
    }
  }

  shape.addEventListener("pointermove", move);
  shape.addEventListener("pointerup", end);
  shape.addEventListener("pointercancel", end);

  move(e);   // posiciona logo debaixo do dedo
}

// Carregar numa ferramenta cria uma forma nova e começa a arrastá-la
tools.forEach((tool) => {
  tool.addEventListener("pointerdown", (e) => {
    const shape = createShape(tool);
    canvas.append(shape);
    beginDrag(shape, e, { x: SHAPE_SIZE / 2, y: SHAPE_SIZE / 2 }, true);
  });
});

canvas.addEventListener("pointerdown", (e) => {
  if (e.target !== canvas) return;               // só no fundo vazio

  const rect = canvas.getBoundingClientRect();
  const clamp = (v, max) => Math.max(0, Math.min(v, max));
  const startX = clamp(e.clientX - rect.left, rect.width);
  const startY = clamp(e.clientY - rect.top, rect.height);

  const frame = document.createElement("div");
  frame.className = "frame";
  canvas.append(frame);
  canvas.setPointerCapture(e.pointerId);

  function move(ev) {
    const x = clamp(ev.clientX - rect.left, rect.width);
    const y = clamp(ev.clientY - rect.top, rect.height);
    frame.style.left   = `${Math.min(startX, x)}px`;
    frame.style.top    = `${Math.min(startY, y)}px`;
    frame.style.width  = `${Math.abs(x - startX)}px`;
    frame.style.height = `${Math.abs(y - startY)}px`;
  }

  function end() {
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", end);
    canvas.removeEventListener("pointercancel", end);

    // moldura minúscula = toque sem querer: descarta
    if (frame.offsetWidth < 60 || frame.offsetHeight < 60) {
      frame.remove();
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "frame__ready";
    btn.textContent = "READY";
    btn.addEventListener("click", () => finishPuppet(frame));
    frame.append(btn);

      const close = document.createElement("button");
    close.type = "button";
    close.className = "frame__close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Remove selection");
    close.addEventListener("click", () => frame.remove());
    frame.append(close);
  }

  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
})

// Apanha as formas dentro da moldura e guarda-as no primeiro slot livre
function finishPuppet(frame) {
  const f = frame.getBoundingClientRect();

  const inside = [...canvas.querySelectorAll(".shape")]
    .filter((s) => {
      const r = s.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return cx >= f.left && cx <= f.right && cy >= f.top && cy <= f.bottom;
    })
    .sort((a, b) => (Number(a.style.zIndex) || 0) - (Number(b.style.zIndex) || 0));   // mantém quem está por cima

  if (inside.length === 0) return;   // moldura sem formas: não guarda nada

  const index = [...slots].findIndex((_, i) => !puppets[i]);
  if (index === -1) {                // todos os slots ocupados
    flashFull();
    return;                          // a moldura e as formas ficam, para não perderes o trabalho
  }

  const puppet = {
    ratio: f.width / f.height,
    shapes: inside.map((s) => {
      const r = s.getBoundingClientRect();
      return {
        type: s.dataset.type,
        x: (r.left - f.left) / f.width,     // tudo relativo à moldura (0 a 1)
        y: (r.top  - f.top)  / f.height,
        w: r.width  / f.width,
        h: r.height / f.height,
      };
    }),
  };

  puppets[index] = puppet;
  renderPuppet(slots[index], puppet);
  inside.forEach((s) => s.remove());
  frame.remove();
}

// Desenha a miniatura dentro do slot
function renderPuppet(slot, puppet) {
  const FIT = 84;   // % do slot que a miniatura pode ocupar
  const box = document.createElement("div");
  box.className = "puppet";
  box.style.width  = `${puppet.ratio >= 1 ? FIT : FIT * puppet.ratio}%`;
  box.style.height = `${puppet.ratio >= 1 ? FIT / puppet.ratio : FIT}%`;

  puppet.shapes.forEach((s) => {
    const el = document.createElement("div");
    el.className = "puppet__shape";
    el.style.left   = `${s.x * 100}%`;
    el.style.top    = `${s.y * 100}%`;
    el.style.width  = `${s.w * 100}%`;
    el.style.height = `${s.h * 100}%`;
    // reaproveita o desenho que já está no botão da toolbar
    el.append(document.querySelector(`.build__tool[data-tool="${s.type}"] svg`).cloneNode(true));
    box.append(el);
  });

  slot.append(box);
}

// O × de cada slot esvazia-o
slots.forEach((slot, i) => {
  slot.querySelector(".storage__remove").addEventListener("click", () => {
    slot.querySelector(".puppet")?.remove();
    puppets[i] = null;
  });
});

// Aviso visual quando não há slots livres
function flashFull() {
  const list = document.querySelector(".storage__list");
  list.classList.remove("is-full");
  void list.offsetWidth;             // reinicia a animação se carregarem várias vezes
  list.classList.add("is-full");
}



slider.addEventListener("input", updateProgress);
updateProgress();
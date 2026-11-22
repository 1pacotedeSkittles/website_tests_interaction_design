const slider = document.querySelector(".build__slider");
const list  = document.querySelector(".instructions__list");
const canvas = document.querySelector("#build-canvas");
const tools  = document.querySelectorAll(".build__tool");
const trash = document.querySelector(".build__delete");

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
});

// Apanha as formas que estão dentro da moldura e fecha-as como marioneta
function finishPuppet(frame) {
  const f = frame.getBoundingClientRect();
  const inside = [...canvas.querySelectorAll(".shape")].filter((s) => {
    const r = s.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return cx >= f.left && cx <= f.right && cy >= f.top && cy <= f.bottom;
  });

  const puppet = inside.map((s) => {
    const r = s.getBoundingClientRect();
    return {
      type: s.dataset.type,
      x: (r.left - f.left) / f.width,    // posição relativa à moldura (0 a 1)
      y: (r.top  - f.top)  / f.height,
    };
  });

  console.log(puppet);          // por agora só mostramos na consola
  inside.forEach((s) => s.remove());
  frame.remove();
}

slider.addEventListener("input", updateProgress);
updateProgress();
const slider = document.querySelector(".build__slider");
const list  = document.querySelector(".instructions__list");
const canvas = document.querySelector("#build-canvas");
const tools  = document.querySelectorAll(".build__tool");

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

slider.addEventListener("input", updateProgress);
updateProgress();
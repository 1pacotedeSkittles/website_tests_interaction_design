const slider = document.querySelector(".build__slider");
const list   = document.querySelector(".instructions__list");
const canvas = document.querySelector("#build-canvas");
const tools  = document.querySelectorAll(".build__tool");
const trash  = document.querySelector(".build__delete");
const stage  = document.querySelector("#manipulate-stage");
const slots  = document.querySelectorAll(".storage__slot");

const SHAPE_SIZE  = 80;   // px, tamanho das formas no canvas
const ANCHOR_SIZE = 44;   // px, tamanho do ponto âncora no canvas
const MARKER_SIZE = 32;   // px, tamanho do ponto âncora no palco
const TAP_DISTANCE = 8;   // px, abaixo disto um toque num âncora conta como "selecionar"

let topZ = 1;
let orderSeq = 0;           // ordem de criação das formas (define a "base" da marioneta)
let selectedAnchor = null;  // ponto âncora selecionado na construção
const puppets = [];         // puppets[i] = dados da marioneta guardada no slot i

// Toque: a pressão longa abre o menu de contexto e cancela o gesto
document.addEventListener("contextmenu", (e) => e.preventDefault());


/* ==========================================================
   INSTRUÇÕES (slider)
   ========================================================== */

function updateProgress() {
	list.style.setProperty("--progress", slider.value / slider.max);
}

slider.addEventListener("input", updateProgress);
updateProgress();


/* ==========================================================
   AJUDAS GERAIS
   ========================================================== */

// O centro do elemento está dentro da moldura?
function centerInside(el, f) {
	const r = el.getBoundingClientRect();
	const cx = r.left + r.width / 2;
	const cy = r.top + r.height / 2;
	return cx >= f.left && cx <= f.right && cy >= f.top && cy <= f.bottom;
}

// O ponto (x, y) do ecrã está dentro da forma, mesmo estando ela rodada?
// (roda o ponto para o referencial da forma e vê se cai na caixa dela)
function shapeContains(shape, x, y) {
	const r = shape.getBoundingClientRect();
	const dx = x - (r.left + r.width / 2);
	const dy = y - (r.top + r.height / 2);
	const a = -(Number(shape.dataset.rot) || 0) * Math.PI / 180;
	const lx = dx * Math.cos(a) - dy * Math.sin(a);
	const ly = dx * Math.sin(a) + dy * Math.cos(a);
	return Math.abs(lx) <= shape.offsetWidth / 2 && Math.abs(ly) <= shape.offsetHeight / 2;
}

// Centro de um elemento, em coordenadas do ecrã
function centerOf(el) {
	const r = el.getBoundingClientRect();
	return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}


/* ==========================================================
   FASE DE CONSTRUÇÃO: formas e pontos âncora
   ========================================================== */

function createShape(tool) {
	const isAnchor = tool.dataset.tool === "anchor";

	const shape = document.createElement("div");
	shape.className = isAnchor ? "shape shape--anchor" : "shape";
	shape.dataset.type = tool.dataset.tool;
	shape.dataset.order = ++orderSeq;
	shape.dataset.rot = 0;
	shape.append(tool.querySelector("svg").cloneNode(true));

	shape.addEventListener("pointerdown", (e) => {
		if (shape.classList.contains("is-dragging")) return;   // já está a ser mexida por outro dedo

		// ligada ao âncora selecionado: arrastar RODA à volta dele
		if (shape.classList.contains("is-rotatable")) {
			beginRotate(shape, selectedAnchor, e);
			return;
		}

		// caso contrário, arrastar move
		const rect = canvas.getBoundingClientRect();
		const grab = {
			x: e.clientX - rect.left - parseFloat(shape.style.left),
			y: e.clientY - rect.top  - parseFloat(shape.style.top),
		};
		beginDrag(shape, e, grab, false);
	});

	return shape;
}

function beginDrag(shape, e, grab, isNew) {
	const rect = canvas.getBoundingClientRect();
	const prev = { left: shape.style.left, top: shape.style.top };
	const isAnchor = shape.dataset.type === "anchor";
	let moved = false;

	shape.setPointerCapture(e.pointerId);   // continua a receber eventos mesmo fora do elemento
	// os pontos âncora ficam sempre por cima das formas
	shape.style.zIndex = isAnchor ? ++topZ + 10000 : ++topZ;
	shape.classList.add("is-dragging");

	function move(ev) {
		if (ev.pointerId !== e.pointerId) return;   // só o dedo que agarrou a forma
		if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > TAP_DISTANCE) moved = true;
		shape.style.left = `${ev.clientX - rect.left - grab.x}px`;
		shape.style.top  = `${ev.clientY - rect.top  - grab.y}px`;
	}

	function end(ev) {
		if (ev.pointerId !== e.pointerId) return;   // só o dedo que agarrou a forma
		shape.removeEventListener("pointermove", move);
		shape.removeEventListener("pointerup", end);
		shape.removeEventListener("pointercancel", end);
		shape.classList.remove("is-dragging");

		// o centro da forma está dentro do canvas?
		const c = centerOf(shape);
		const inside = c.x >= rect.left && c.x <= rect.right &&
		               c.y >= rect.top  && c.y <= rect.bottom;

		if (!inside) {
			if (isNew) {                                // forma nova largada fora: descarta
				shape.remove();
				return;
			}
			Object.assign(shape.style, prev);           // forma antiga: volta onde estava
		}

		// se arrastas para o lixo, apaga
		const t = trash.getBoundingClientRect();
		const overTrash = c.x >= t.left - 20 && c.x <= t.right + 20 &&
		                  c.y >= t.top  - 20 && c.y <= t.bottom + 20;

		if (overTrash) {
			shape.remove();
		}

		refreshAnchors();   // os âncoras podem ter ficado ligados ou desligados

		// um toque (sem arrastar) num âncora seleciona-o / deseleciona-o
		if (isAnchor && !isNew && !moved && !overTrash) toggleAnchor(shape);
	}

	shape.addEventListener("pointermove", move);
	shape.addEventListener("pointerup", end);
	shape.addEventListener("pointercancel", end);

	move(e);   // posiciona logo debaixo do dedo
}

// Roda uma forma à volta do ponto âncora (e não à volta do próprio centro)
function beginRotate(shape, anchor, e) {
	const crect = canvas.getBoundingClientRect();
	const pivot = centerOf(anchor);              // pivô, no ecrã
	const c0    = centerOf(shape);               // centro da forma no início
	const rot0  = Number(shape.dataset.rot) || 0;
	const a0    = Math.atan2(e.clientY - pivot.y, e.clientX - pivot.x);

	shape.setPointerCapture(e.pointerId);
	shape.style.zIndex = ++topZ;
	shape.classList.add("is-dragging");

	function move(ev) {
		if (ev.pointerId !== e.pointerId) return;   // só o dedo que agarrou a forma

		const d  = Math.atan2(ev.clientY - pivot.y, ev.clientX - pivot.x) - a0;   // quanto o dedo rodou
		const dx = c0.x - pivot.x;
		const dy = c0.y - pivot.y;

		// o centro da forma dá a volta ao pivô...
		const cx = pivot.x + dx * Math.cos(d) - dy * Math.sin(d);
		const cy = pivot.y + dx * Math.sin(d) + dy * Math.cos(d);
		shape.style.left = `${cx - crect.left - SHAPE_SIZE / 2}px`;
		shape.style.top  = `${cy - crect.top  - SHAPE_SIZE / 2}px`;

		// ...e a forma roda o mesmo
		const rot = rot0 + d * 180 / Math.PI;
		shape.dataset.rot = rot;
		shape.style.transform = `rotate(${rot}deg)`;
	}

	function end(ev) {
		if (ev.pointerId !== e.pointerId) return;
		shape.removeEventListener("pointermove", move);
		shape.removeEventListener("pointerup", end);
		shape.removeEventListener("pointercancel", end);
		shape.classList.remove("is-dragging");
		refreshAnchors();
	}

	shape.addEventListener("pointermove", move);
	shape.addEventListener("pointerup", end);
	shape.addEventListener("pointercancel", end);
}

// Formas que o ponto âncora tem por baixo
function linkedShapes(anchor) {
	const c = centerOf(anchor);
	return [...canvas.querySelectorAll(".shape:not(.shape--anchor)")]
		.filter((s) => shapeContains(s, c.x, c.y));
}

// Um ponto âncora fica azul quando está em cima de dois (ou mais) elementos
function refreshAnchors() {
	canvas.querySelectorAll(".shape--anchor").forEach((a) => {
		a.classList.toggle("is-connected", linkedShapes(a).length >= 2);
	});
	refreshSelection();
}

// Mostra qual o âncora selecionado e que formas ele deixa rodar
function refreshSelection() {
	if (selectedAnchor && !selectedAnchor.isConnected) selectedAnchor = null;   // foi apagado

	canvas.querySelectorAll(".shape--anchor").forEach((a) => {
		a.classList.toggle("is-selected", a === selectedAnchor);
	});

	const linked = selectedAnchor ? linkedShapes(selectedAnchor) : [];
	canvas.querySelectorAll(".shape:not(.shape--anchor)").forEach((s) => {
		s.classList.toggle("is-rotatable", linked.includes(s));
	});
}

function toggleAnchor(anchor) {
	selectedAnchor = (selectedAnchor === anchor) ? null : anchor;
	refreshSelection();
}

// Tocar no fundo vazio do canvas deseleciona o âncora
canvas.addEventListener("pointerdown", (e) => {
	if (e.target === canvas && selectedAnchor) {
		selectedAnchor = null;
		refreshSelection();
	}
});

// Carregar numa ferramenta cria uma forma nova e começa a arrastá-la
tools.forEach((tool) => {
	tool.addEventListener("pointerdown", (e) => {
		const shape = createShape(tool);
		canvas.append(shape);
		const half = (tool.dataset.tool === "anchor" ? ANCHOR_SIZE : SHAPE_SIZE) / 2;
		beginDrag(shape, e, { x: half, y: half }, true);
	});
});


/* ==========================================================
   MOLDURA DE SELEÇÃO (serve a construção e o palco)
   Arrasta no fundo vazio de uma área para desenhar a moldura;
   o botão da moldura chama onReady(frame).
   ========================================================== */

function enableSelection(area, onReady, label = "READY", extraClass = "") {
	area.addEventListener("pointerdown", (e) => {
		if (e.target !== area) return;               // só no fundo vazio

		const rect = area.getBoundingClientRect();
		const clamp = (v, max) => Math.max(0, Math.min(v, max));
		const startX = clamp(e.clientX - rect.left, rect.width);
		const startY = clamp(e.clientY - rect.top, rect.height);

		const frame = document.createElement("div");
		frame.className = "frame";
		area.append(frame);
		area.setPointerCapture(e.pointerId);

		function move(ev) {
			if (ev.pointerId !== e.pointerId) return;   // ignora outros dedos
			const x = clamp(ev.clientX - rect.left, rect.width);
			const y = clamp(ev.clientY - rect.top, rect.height);
			frame.style.left   = `${Math.min(startX, x)}px`;
			frame.style.top    = `${Math.min(startY, y)}px`;
			frame.style.width  = `${Math.abs(x - startX)}px`;
			frame.style.height = `${Math.abs(y - startY)}px`;
		}

		function end(ev) {
			if (ev.pointerId !== e.pointerId) return;   // ignora outros dedos
			area.removeEventListener("pointermove", move);
			area.removeEventListener("pointerup", end);
			area.removeEventListener("pointercancel", end);

			// moldura minúscula = toque sem querer: descarta
			if (frame.offsetWidth < 60 || frame.offsetHeight < 60) {
				frame.remove();
				return;
			}

			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = `frame__ready ${extraClass}`;
			btn.textContent = label;
			btn.addEventListener("click", () => onReady(frame));
			frame.append(btn);

			const close = document.createElement("button");
			close.type = "button";
			close.className = "frame__close";
			close.textContent = "×";
			close.setAttribute("aria-label", "Remove selection");
			close.addEventListener("click", () => frame.remove());
			frame.append(close);
		}

		area.addEventListener("pointermove", move);
		area.addEventListener("pointerup", end);
		area.addEventListener("pointercancel", end);
	});
}

enableSelection(canvas, finishPuppet);                                        // construção: formas -> slot
enableSelection(stage, returnToStorage, "Return", "frame__ready--return");    // palco: marionetas -> slots

// CONSTRUÇÃO: apanha o que está dentro da moldura e guarda-o no primeiro slot livre.
// Cada ponto âncora que esteja em cima de dois ou mais elementos torna-se uma articulação.
function finishPuppet(frame) {
	const f = frame.getBoundingClientRect();

	const byZ = (a, b) => (Number(a.style.zIndex) || 0) - (Number(b.style.zIndex) || 0);
	const picked  = [...canvas.querySelectorAll(".shape")].filter((s) => centerInside(s, f));
	const parts   = picked.filter((s) => s.dataset.type !== "anchor").sort(byZ);   // mantém quem está por cima
	const anchors = picked.filter((s) => s.dataset.type === "anchor");

	if (parts.length === 0) return;   // moldura sem formas: não guarda nada

	const index = [...slots].findIndex((_, i) => !puppets[i]);
	if (index === -1) {               // todos os slots ocupados
		flashFull();
		return;                       // a moldura e as formas ficam, para não perderes o trabalho
	}

	// posição e tamanho da moldura dentro do canvas (px)
	const fx = parseFloat(frame.style.left);
	const fy = parseFloat(frame.style.top);
	const fw = parseFloat(frame.style.width);
	const fh = parseFloat(frame.style.height);

	// articulações: cada âncora liga TODAS as formas que tem por baixo
	const joints = [];
	anchors.forEach((a) => {
		const c = centerOf(a);

		const under = parts
			.map((s, i) => ({ s, i }))
			.filter(({ s }) => shapeContains(s, c.x, c.y))
			.map(({ i }) => i);

		if (under.length < 2) return;   // âncora solta: não liga nada

		joints.push({
			x: (parseFloat(a.style.left) + ANCHOR_SIZE / 2 - fx) / fw,   // relativo à moldura (0 a 1)
			y: (parseFloat(a.style.top)  + ANCHOR_SIZE / 2 - fy) / fh,
			parts: under,                                                // índices em puppet.shapes
		});
	});

	const puppet = {
		ratio:  fw / fh,
		width:  fw,
		height: fh,
		joints,
		shapes: parts.map((s) => ({
			type:  s.dataset.type,
			order: Number(s.dataset.order),         // ordem de criação: a mais antiga é a base
			rot:   Number(s.dataset.rot) || 0,      // rotação (graus) à volta do próprio centro
			x: (parseFloat(s.style.left) - fx) / fw,    // caixa sem rotação, relativa à moldura (0 a 1)
			y: (parseFloat(s.style.top)  - fy) / fh,
			w: SHAPE_SIZE / fw,
			h: SHAPE_SIZE / fh,
		})),
	};

	puppets[index] = puppet;
	renderPuppet(slots[index], puppet);

	picked.forEach((s) => s.remove());
	frame.remove();
	refreshSelection();
}

// PALCO: apanha as marionetas dentro da moldura e devolve-as aos slots
function returnToStorage(frame) {
	const f = frame.getBoundingClientRect();

	const picked = [...stage.querySelectorAll(".puppet")].filter((el) => centerInside(el, f));
	if (picked.length === 0) return;   // moldura sem marionetas

	let allReturned = true;

	picked.forEach((el) => {
		const index = [...slots].findIndex((_, i) => !puppets[i]);
		if (index === -1) {            // sem slots livres: esta fica no palco
			allReturned = false;
			return;
		}

		puppets[index] = el.puppetData;
		renderPuppet(slots[index], el.puppetData);
		el.remove();
	});

	if (allReturned) {
		frame.remove();
	} else {
		flashFull();                   // a moldura fica, para veres o que não coube
	}
}


/* ==========================================================
   ARMAZENAMENTO: slots
   ========================================================== */

// Cria a marioneta em miniatura (sem tamanho nem posição: quem a usa decide)
function createPuppetEl(puppet) {
	const box = document.createElement("div");
	box.className = "puppet";

	puppet.shapes.forEach((s) => {
		const el = document.createElement("div");
		el.className = "puppet__shape";
		el.style.cssText = `
			position: absolute;
			left: ${s.x * 100}%; top: ${s.y * 100}%;
			width: ${s.w * 100}%; height: ${s.h * 100}%;
			transform: rotate(${s.rot || 0}deg);
			color: #3c3c3c;
		`;

		// reaproveita o desenho que já está no botão da toolbar
		const svg = document.querySelector(`.build__tool[data-tool="${s.type}"] svg`).cloneNode(true);
		svg.style.cssText = "display: block; width: 100%; height: 100%;";

		el.append(svg);
		box.append(el);
	});

	return box;
}

// Miniatura dentro do slot
function renderPuppet(slot, puppet) {
	const FIT = 84;   // % do slot que a miniatura pode ocupar
	const w = puppet.ratio >= 1 ? FIT : FIT * puppet.ratio;
	const h = puppet.ratio >= 1 ? FIT / puppet.ratio : FIT;

	const box = createPuppetEl(puppet);
	box.style.cssText = `
		position: absolute;
		left: 50%; top: 50%;
		transform: translate(-50%, -50%);
		width: ${w}%; height: ${h}%;
		pointer-events: none;
	`;

	slot.append(box);
}

function clearSlot(slot, i) {
	slot.querySelector(".puppet")?.remove();
	puppets[i] = null;
}

// Aviso visual quando não há slots livres
function flashFull() {
	const slotList = document.querySelector(".storage__list");
	slotList.classList.remove("is-full");
	void slotList.offsetWidth;             // reinicia a animação se carregarem várias vezes
	slotList.classList.add("is-full");
}

slots.forEach((slot, i) => {
	slot.style.touchAction = "none";

	// O × esvazia o slot
	slot.querySelector(".storage__remove").addEventListener("click", () => clearSlot(slot, i));

	// Agarrar a marioneta guardada
	slot.addEventListener("pointerdown", (e) => {
		const puppet = puppets[i];
		if (!puppet || e.target.closest(".storage__remove")) return;
		if (slot.classList.contains("is-lifted")) return;   // já está a ser arrastada por outro dedo
		dragPuppetOut(slot, i, puppet, e);
	});
});


/* ==========================================================
   MOVER MARIONETAS: slot -> construção / palco
   ========================================================== */

function dragPuppetOut(slot, i, puppet, e) {
	// "fantasma" em tamanho real que acompanha o dedo
	const ghost = createPuppetEl(puppet);
	ghost.style.cssText = `
		position: fixed;
		width: ${puppet.width}px; height: ${puppet.height}px;
		transform: translate(-50%, -50%);
		opacity: 0.85;
		pointer-events: none;
		z-index: 9999;
	`;
	document.body.append(ghost);
	slot.classList.add("is-lifted");
	slot.setPointerCapture(e.pointerId);

	const inside = (el, ev) => {
		const r = el.getBoundingClientRect();
		return ev.clientX >= r.left && ev.clientX <= r.right &&
		       ev.clientY >= r.top  && ev.clientY <= r.bottom;
	};

	function move(ev) {
		if (ev.pointerId !== e.pointerId) return;   // só o dedo que agarrou a marioneta
		ghost.style.left = `${ev.clientX}px`;
		ghost.style.top  = `${ev.clientY}px`;
	}

	function cleanup(ev) {
		if (ev && ev.pointerId !== e.pointerId) return;   // cancelamento de outro dedo: ignora
		slot.removeEventListener("pointermove", move);
		slot.removeEventListener("pointerup", end);
		slot.removeEventListener("pointercancel", cleanup);
		ghost.remove();
		slot.classList.remove("is-lifted");
	}

	function end(ev) {
		if (ev.pointerId !== e.pointerId) return;   // só o dedo que agarrou a marioneta
		cleanup();
		if (inside(canvas, ev)) {
			restoreToBuild(puppet, ev);
			clearSlot(slot, i);
		} else if (inside(stage, ev)) {
			placeOnStage(puppet, ev);
			clearSlot(slot, i);          // apaga esta linha se quiseres que o slot fique ocupado
		}
		// noutro sítio: não faz nada, a marioneta continua no slot
	}

	slot.addEventListener("pointermove", move);
	slot.addEventListener("pointerup", end);
	slot.addEventListener("pointercancel", cleanup);
	move(e);
}

// Volta a transformar a marioneta em formas editáveis (e pontos âncora) na construção.
// "ev" só precisa de ter clientX e clientY (o centro onde a marioneta fica).
function restoreToBuild(puppet, ev) {
	const rect = canvas.getBoundingClientRect();
	const left = ev.clientX - rect.left - puppet.width / 2;
	const top  = ev.clientY - rect.top  - puppet.height / 2;

	const base = topZ;
	topZ += puppet.shapes.length;

	// recria pela ordem de criação original, para a base da marioneta continuar a ser a mesma
	puppet.shapes
		.map((s, i) => ({ s, i }))
		.sort((p, q) => p.s.order - q.s.order)
		.forEach(({ s, i }) => {
			const tool  = document.querySelector(`.build__tool[data-tool="${s.type}"]`);
			const shape = createShape(tool);
			shape.style.left = `${left + s.x * puppet.width}px`;
			shape.style.top  = `${top  + s.y * puppet.height}px`;
			shape.style.zIndex = base + i + 1;      // mantém quem estava por cima

			if (s.rot) {
				shape.dataset.rot = s.rot;
				shape.style.transform = `rotate(${s.rot}deg)`;
			}

			canvas.append(shape);
		});

	// os pontos âncora voltam onde estavam
	const anchorTool = document.querySelector('.build__tool[data-tool="anchor"]');
	(puppet.joints || []).forEach((j) => {
		const anchor = createShape(anchorTool);
		anchor.style.left = `${left + j.x * puppet.width  - ANCHOR_SIZE / 2}px`;
		anchor.style.top  = `${top  + j.y * puppet.height - ANCHOR_SIZE / 2}px`;
		anchor.style.zIndex = ++topZ + 10000;
		canvas.append(anchor);
	});

	refreshAnchors();
}


/* ==========================================================
   PALCO: marionetas articuladas
   - tocar na BASE (ou num ponto âncora) move a marioneta toda
   - tocar num membro roda-o à volta do ponto âncora que o liga ao pai
   - vários membros no mesmo âncora rodam cada um por si
   A base de cada conjunto de peças ligadas é a peça criada primeiro.
   ========================================================== */

// Descobre quem é pai de quem e onde fica cada articulação (em px, na marioneta em repouso)
function buildRig(puppet) {
	const W = puppet.width;
	const H = puppet.height;
	const n = puppet.shapes.length;

	const rig = {
		parent:  Array(n).fill(null),   // índice da peça-pai (null = base)
		pivot:   Array(n).fill(null),   // ponto âncora que liga a peça ao pai
		angle:   Array(n).fill(0),      // rotação atual da peça à volta desse ponto (graus)
		markers: [],                    // pontos âncora a desenhar: { pivot, parent }
	};

	// cada articulação liga várias peças
	const joints = (puppet.joints || []).map((j) => ({
		pivot: { x: j.x * W, y: j.y * H },
		parts: j.parts,
	}));

	const jointsOf = Array.from({ length: n }, () => []);
	joints.forEach((j) => j.parts.forEach((i) => jointsOf[i].push(j)));

	// a base de cada conjunto é a peça mais antiga; a partir dela, todas as outras
	// peças de cada articulação são "filhas" e rodam à volta do mesmo ponto
	const seen = Array(n).fill(false);
	const byOrder = [...puppet.shapes.keys()].sort((a, b) => puppet.shapes[a].order - puppet.shapes[b].order);

	byOrder.forEach((root) => {
		if (seen[root]) return;
		seen[root] = true;
		const queue = [root];

		while (queue.length) {
			const cur = queue.shift();

			jointsOf[cur].forEach((j) => {
				let used = false;

				j.parts.forEach((other) => {
					if (seen[other]) return;
					seen[other] = true;
					rig.parent[other] = cur;
					rig.pivot[other]  = j.pivot;
					queue.push(other);
					used = true;
				});

				if (used) rig.markers.push({ pivot: j.pivot, parent: cur });
			});
		}
	});

	return rig;
}

// Rotação de "deg" graus à volta do ponto p
function rotateAbout(p, deg) {
	return `translate(${p.x}px, ${p.y}px) rotate(${deg}deg) translate(${-p.x}px, ${-p.y}px)`;
}

// Rotações de uma peça e de todos os seus antepassados (as do pai primeiro, a da própria por último)
function chainTransform(rig, i) {
	const parts = [];
	for (let c = i; c !== null && rig.parent[c] !== null; c = rig.parent[c]) {
		parts.unshift(rotateAbout(rig.pivot[c], rig.angle[c]));
	}
	return parts.join(" ");
}

// Onde está agora um ponto da peça k (aplica as rotações dela e dos antepassados)
function applyChain(rig, k, pt) {
	let p = { x: pt.x, y: pt.y };

	for (let c = k; c !== null && rig.parent[c] !== null; c = rig.parent[c]) {
		const rad = rig.angle[c] * Math.PI / 180;
		const o = rig.pivot[c];
		const dx = p.x - o.x;
		const dy = p.y - o.y;
		p = {
			x: o.x + dx * Math.cos(rad) - dy * Math.sin(rad),
			y: o.y + dx * Math.sin(rad) + dy * Math.cos(rad),
		};
	}

	return p;
}

function createStagePuppet(puppet) {
	const W = puppet.width;
	const H = puppet.height;
	const rig = buildRig(puppet);

	const box = document.createElement("div");
	box.className = "puppet";
	box.puppetData = puppet;           // guardamos os dados para a poder devolver aos slots
	box.rig = rig;
	box.style.cssText = `
		position: absolute;
		width: ${W}px; height: ${H}px;
		pointer-events: none;          /* só as peças recebem toques; o espaço vazio deixa passar */
	`;

	// peças (já vêm ordenadas de baixo para cima)
	const partEls = puppet.shapes.map((s, i) => {
		const el = document.createElement("div");
		el.className = "puppet__shape";
		el.style.cssText = `
			position: absolute;
			left: 0; top: 0;
			width: ${s.w * W}px; height: ${s.h * H}px;
			transform-origin: 0 0;
			color: #3c3c3c;
			pointer-events: auto;
			touch-action: none;
			cursor: grab;
		`;

		const svg = document.querySelector(`.build__tool[data-tool="${s.type}"] svg`).cloneNode(true);
		svg.style.cssText = "display: block; width: 100%; height: 100%; pointer-events: none;";
		el.append(svg);

		el.addEventListener("pointerdown", (e) => {
			if (rig.parent[i] === null) dragPuppet(box, el, e);   // base: move a marioneta
			else rotatePart(box, i, el, e);                       // membro: roda
		});

		box.append(el);
		return el;
	});

	// pontos âncora visíveis (também servem de pega para mover a marioneta)
	const markerEls = rig.markers.map(({ pivot, parent }) => {
		const el = document.createElement("div");
		el.style.cssText = `
			position: absolute;
			left: 0; top: 0;
			width: ${MARKER_SIZE}px; height: ${MARKER_SIZE}px;
			transform-origin: 0 0;
			color: #0a84ff;
			pointer-events: auto;
			touch-action: none;
			cursor: grab;
		`;

		const svg = document.querySelector('.build__tool[data-tool="anchor"] svg').cloneNode(true);
		svg.style.cssText = "display: block; width: 100%; height: 100%; pointer-events: none;";
		el.append(svg);

		el.addEventListener("pointerdown", (e) => dragPuppet(box, el, e));

		box.append(el);
		return { el, pivot, parent };
	});

	// desenha cada peça e cada ponto âncora com as rotações atuais
	box.render = () => {
		partEls.forEach((el, i) => {
			const s = puppet.shapes[i];
			const w = s.w * W;
			const h = s.h * H;
			// rotações dos pais, depois a posição da peça e a rotação dela à volta do próprio centro
			el.style.transform =
				`${chainTransform(rig, i)} ` +
				`translate(${s.x * W + w / 2}px, ${s.y * H + h / 2}px) ` +
				`rotate(${s.rot || 0}deg) ` +
				`translate(${-w / 2}px, ${-h / 2}px)`;
		});

		markerEls.forEach(({ el, pivot, parent }) => {
			// o ponto acompanha o pai (não os membros que rodam à volta dele)
			el.style.transform =
				`${chainTransform(rig, parent)} ` +
				`translate(${pivot.x - MARKER_SIZE / 2}px, ${pivot.y - MARKER_SIZE / 2}px)`;
		});
	};

	box.render();
	return box;
}

// Põe a marioneta inteira no palco
function placeOnStage(puppet, ev) {
	const rect = stage.getBoundingClientRect();
	const box = createStagePuppet(puppet);

	box.style.left = `${ev.clientX - rect.left - puppet.width / 2}px`;
	box.style.top  = `${ev.clientY - rect.top  - puppet.height / 2}px`;

	stage.append(box);
}

// Mover a marioneta toda pelo palco
function dragPuppet(box, handle, e) {
	if (box.dataset.dragging) return;   // já está a ser mexida por outro dedo
	box.dataset.dragging = "1";

	const rect = stage.getBoundingClientRect();
	const b    = box.getBoundingClientRect();
	const grab = { x: e.clientX - b.left, y: e.clientY - b.top };
	const prev = { left: box.style.left, top: box.style.top };

	handle.setPointerCapture(e.pointerId);
	box.style.zIndex = ++topZ;          // a última a ser mexida fica por cima

	function move(ev) {
		if (ev.pointerId !== e.pointerId) return;   // só o dedo que agarrou
		box.style.left = `${ev.clientX - rect.left - grab.x}px`;
		box.style.top  = `${ev.clientY - rect.top  - grab.y}px`;
	}

	function end(ev) {
		if (ev.pointerId !== e.pointerId) return;
		delete box.dataset.dragging;
		handle.removeEventListener("pointermove", move);
		handle.removeEventListener("pointerup", end);
		handle.removeEventListener("pointercancel", end);

		// o centro da marioneta tem de ficar dentro do palco
		const r  = box.getBoundingClientRect();
		const cx = r.left + r.width / 2;
		const cy = r.top  + r.height / 2;
		const inside = cx >= rect.left && cx <= rect.right &&
		               cy >= rect.top  && cy <= rect.bottom;

		if (!inside) Object.assign(box.style, prev);   // fora do palco: volta onde estava
	}

	handle.addEventListener("pointermove", move);
	handle.addEventListener("pointerup", end);
	handle.addEventListener("pointercancel", end);
}

// Rodar um membro à volta do ponto âncora que o liga ao pai (os filhos dele acompanham)
function rotatePart(box, i, handle, e) {
	// cada membro roda por si: só impede o mesmo membro de ser agarrado por dois dedos
	if (handle.dataset.rotating) return;
	handle.dataset.rotating = "1";

	const rig = box.rig;

	// onde está agora o ponto âncora (já com as rotações dos pais), em coordenadas do ecrã
	const origin = box.getBoundingClientRect();
	const pv = applyChain(rig, rig.parent[i], rig.pivot[i]);
	const cx = origin.left + pv.x;
	const cy = origin.top  + pv.y;

	const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
	const startDeg   = rig.angle[i];

	handle.setPointerCapture(e.pointerId);

	function move(ev) {
		if (ev.pointerId !== e.pointerId) return;   // só o dedo que agarrou
		const a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
		rig.angle[i] = startDeg + (a - startAngle) * 180 / Math.PI;
		box.render();
	}

	function end(ev) {
		if (ev.pointerId !== e.pointerId) return;
		delete handle.dataset.rotating;
		handle.removeEventListener("pointermove", move);
		handle.removeEventListener("pointerup", end);
		handle.removeEventListener("pointercancel", end);
	}

	handle.addEventListener("pointermove", move);
	handle.addEventListener("pointerup", end);
	handle.addEventListener("pointercancel", end);
}
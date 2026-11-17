// ============================================================================
// 0. PROTEÇÃO MÁXIMA CONTRA ZOOM NATIVO DO BROWSER
// ============================================================================
document.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());

const tools = document.querySelectorAll('.tool');
const stage = document.getElementById('stage');

// Garantir que as ferramentas da barra também não ativam scrolls nativos
tools.forEach(tool => tool.style.touchAction = 'none');

// ============================================================================
// 1. O MOTOR DE GESTOS MULTITOQUE (COZINHADO DE FORMA ÉPICA)
// ============================================================================
function makeInteractable(shape) {
    // CRUCIAL: Obriga o ecrã touch a entregar 100% dos toques ao JS
    shape.style.touchAction = 'none'; 
    
    const pointers = new Map();
    const isLine = shape.dataset.shape === 'line';
    const baseRot = isLine ? -45 : 0; // A linha já nasce rodada
    
    // Estado atual do objeto
    let currentScale = 1;
    let currentRotation = 0;
    let currentLeft = parseFloat(shape.style.left) || 0;
    let currentTop = parseFloat(shape.style.top) || 0;

    // Estado inicial no momento do toque (Baselines)
    let startDist = 0;
    let startAngle = 0;
    let startScale = 1;
    let startRotation = 0;
    let startPanX = 0;
    let startPanY = 0;
    let startLeft = 0;
    let startTop = 0;

    function render() {
        shape.style.left = `${currentLeft}px`;
        shape.style.top = `${currentTop}px`;
        shape.style.transform = `translate(-50%, -50%) rotate(${baseRot + currentRotation}deg) scale(${currentScale})`;
    }

    shape.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        shape.setPointerCapture(e.pointerId);
        
        // Traz o objeto para a frente
        stage.appendChild(shape);

        // Calcula o centro exato entre todos os dedos a tocar (Centroid)
        const pts = Array.from(pointers.values());
        startPanX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        startPanY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        startLeft = currentLeft;
        startTop = currentTop;

        // Se meter 2 dedos, grava a distância e ângulo iniciais
        if (pointers.size === 2) {
            startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            startAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * (180 / Math.PI);
            startScale = currentScale;
            startRotation = currentRotation;
        }
    });

    shape.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const pts = Array.from(pointers.values());

        // MOVER (PANNING): O objeto segue sempre o ponto central dos dedos
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        
        currentLeft = startLeft + (centerX - startPanX);
        currentTop = startTop + (centerY - startPanY);

        // ZOOM & RODAR: Apenas quando há 2 dedos
        if (pointers.size === 2) {
            const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const currentAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * (180 / Math.PI);

            // Matemática do Zoom
            if (startDist > 0) {
                currentScale = startScale * (currentDist / startDist);
                currentScale = Math.max(0.3, Math.min(currentScale, 10)); // Limites de tamanho
            }

            // Matemática da Rotação
            currentRotation = startRotation + (currentAngle - startAngle);
        }

        render(); // Aplica as transformações no ecrã
    });

    const releasePointer = (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        shape.releasePointerCapture(e.pointerId);

        // MÁGICA DE ESTABILIDADE: Recalcula o centro se o utilizador levantar só um dedo,
        // garantindo que o objeto não "teletransporta" para o dedo que ficou.
        if (pointers.size > 0) {
            const pts = Array.from(pointers.values());
            startPanX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
            startPanY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
            startLeft = currentLeft;
            startTop = currentTop;
            
            if (pointers.size === 2) {
                startDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                startAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * (180 / Math.PI);
                startScale = currentScale;
                startRotation = currentRotation;
            }
        }
    };

    shape.addEventListener('pointerup', releasePointer);
    shape.addEventListener('pointercancel', releasePointer);

    // Fallback Rato/Trackpad para testares no PC
    shape.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
            currentRotation += e.deltaY * 0.5; // Shift para rodar
        } else {
            const zoomSpeed = e.ctrlKey || e.metaKey ? 0.01 : 0.005;
            currentScale -= e.deltaY * zoomSpeed; // Pinch Trackpad para Zoom
            currentScale = Math.max(0.3, Math.min(currentScale, 10));
        }
        render();
    }, { passive: false });
    
    // Renderiza a forma na sua posição/estado inicial assim que é criada
    render();
}

// ============================================================================
// 2. LÓGICA DE DRAG & DROP (DA BARRA LATERAL PARA O PALCO)
// ============================================================================
tools.forEach(tool => {
    tool.addEventListener('pointerdown', (e) => {
        const shapeClass = Array.from(tool.classList).find(cls => cls.startsWith('shape-'));
        const shapeType = tool.dataset.shape;
        
        // Criação do clone "Fantasma" para arrastar
        const clone = document.createElement('div');
        clone.className = `tool ${shapeClass}`;
        clone.style.position = 'absolute';
        clone.style.zIndex = 1000;
        clone.style.touchAction = 'none'; // Impede bugar no touch
        
        const isLine = shapeType === 'line';
        clone.style.transform = isLine ? 'translate(-50%, -50%) rotate(-45deg)' : 'translate(-50%, -50%)';
        
        document.body.appendChild(clone);

        const moveClone = (x, y) => {
            clone.style.left = x + 'px';
            clone.style.top = y + 'px';
        };
        
        moveClone(e.clientX, e.clientY);
        tool.setPointerCapture(e.pointerId);

        tool.onpointermove = (ev) => {
            if (ev.pointerId === e.pointerId) moveClone(ev.clientX, ev.clientY);
        };

        const endDrag = (ev) => {
            if (ev.pointerId !== e.pointerId) return;
            tool.releasePointerCapture(e.pointerId);
            tool.onpointermove = null;
            tool.onpointerup = null;
            tool.onpointercancel = null;
            clone.remove();
            
            // Só "planta" no palco se for um drop válido
            if (ev.type === 'pointerup') {
                const stageRect = stage.getBoundingClientRect();
                if (ev.clientX >= stageRect.left && ev.clientX <= stageRect.right &&
                    ev.clientY >= stageRect.top && ev.clientY <= stageRect.bottom) {
                    
                    const shape = document.createElement('div');
                    shape.className = `stage-item ${shapeClass}`;
                    shape.dataset.shape = shapeType;
                    
                    // Coloca exatamente debaixo do dedo
                    shape.style.left = (ev.clientX - stageRect.left) + 'px';
                    shape.style.top = (ev.clientY - stageRect.top) + 'px';
                    
                    stage.appendChild(shape);
                    
                    // ATIVA O MOTOR ÉPICO DE MULTITOUCH NESTA FORMA
                    makeInteractable(shape);
                }
            }
        };

        tool.onpointerup = endDrag;
        tool.onpointercancel = endDrag; 
    });
});
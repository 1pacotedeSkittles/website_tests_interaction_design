// ============================================================================
// BLOQUEIO GLOBAL DO ZOOM NATIVO DA PÁGINA
// ============================================================================
document.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) e.preventDefault();
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

const tools = document.querySelectorAll('.tool');
const stage = document.getElementById('stage');

// ============================================================================
// FUNÇÃO CENTRAL PARA APLICAR ZOOM E ROTAÇÃO
// ============================================================================
function updateTransform(element) {
    const isLine = element.dataset.shape === 'line';
    const baseRotation = isLine ? -45 : 0; // A linha já começa inclinada a -45 graus
    
    const currentRotation = element._rotation || 0;
    const finalRotation = baseRotation + currentRotation;
    const scale = element._scale || 1;
    
    element.style.transform = `translate(-50%, -50%) rotate(${finalRotation}deg) scale(${scale})`;
}

// ============================================================================
// 1. DRAG AND DROP DA BARRA LATERAL PARA O PALCO
// ============================================================================
tools.forEach(tool => {
    tool.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        
        const shapeClass = Array.from(tool.classList).find(cls => cls.startsWith('shape-'));
        const shapeType = tool.dataset.shape;
        
        const clone = document.createElement('div');
        clone.className = `tool ${shapeClass}`;
        clone.dataset.shape = shapeType;
        clone.style.position = 'absolute';
        clone.style.zIndex = 1000; 
        document.body.appendChild(clone);

        const moveClone = (x, y) => {
            clone.style.left = x + 'px';
            clone.style.top = y + 'px';
        };
        
        updateTransform(clone);
        moveClone(e.clientX, e.clientY);
        tool.setPointerCapture(e.pointerId);

        tool.onpointermove = (ev) => {
            if (ev.pointerId === e.pointerId) moveClone(ev.clientX, ev.clientY);
        };

        tool.onpointerup = (ev) => {
            if (ev.pointerId !== e.pointerId) return;
            tool.releasePointerCapture(e.pointerId);
            tool.onpointermove = null;
            tool.onpointerup = null;
            clone.remove();
            
            const stageRect = stage.getBoundingClientRect();
            if (ev.clientX >= stageRect.left && ev.clientX <= stageRect.right &&
                ev.clientY >= stageRect.top && ev.clientY <= stageRect.bottom) {
                
                const shape = document.createElement('div');
                shape.className = `stage-item ${shapeClass}`;
                shape.dataset.shape = shapeType;
                shape.style.left = (ev.clientX - stageRect.left) + 'px';
                shape.style.top = (ev.clientY - stageRect.top) + 'px';
                
                // Inicializa variáveis de controlo
                shape._scale = 1;
                shape._rotation = 0; 
                
                updateTransform(shape);
                stage.appendChild(shape);
                
                shape.addEventListener('pointerdown', handleShapePointerDown);
                shape.addEventListener('wheel', handleShapeWheel, { passive: false });
            }
        };
    });
});

// ============================================================================
// 2. MOVER, ZOOM E RODAR (MULTITOQUE 2 DEDOS) NOS ELEMENTOS DO PALCO
// ============================================================================
function handleShapePointerDown(e) {
    e.preventDefault();
    const shape = e.currentTarget;
    const stageRect = stage.getBoundingClientRect();
    
    if (!shape._pointers) shape._pointers = new Map();
    shape._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    stage.appendChild(shape); // Traz para primeiro plano
    shape.setPointerCapture(e.pointerId);

    // Variáveis para guardar o estado antes de começar a mover os dedos
    let initialDistance = 0;
    let initialScale = shape._scale || 1;
    let initialAngle = 0;
    let initialRotation = shape._rotation || 0;

    // Se há 2 dedos, calcula a distância e o ângulo inicial entre eles
    if (shape._pointers.size === 2) {
        const pts = Array.from(shape._pointers.values());
        
        // Teorema de Pitágoras para a Distância (Zoom)
        initialDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        
        // Arco-tangente para calcular o Ângulo entre os 2 dedos (Rotação)
        // Convertido de Radianos para Graus
        initialAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * (180 / Math.PI);
    }

    shape.onpointermove = (ev) => {
        if (!shape._pointers.has(ev.pointerId)) return;
        shape._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

        if (shape._pointers.size === 1) {
            // MOVER (1 Dedo)
            shape.style.left = (ev.clientX - stageRect.left) + 'px';
            shape.style.top = (ev.clientY - stageRect.top) + 'px';
        } 
        else if (shape._pointers.size === 2) {
            // ZOOM E ROTAÇÃO (2 Dedos)
            const pts = Array.from(shape._pointers.values());
            
            // Distância Atual e Ângulo Atual
            const currentDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const currentAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * (180 / Math.PI);

            if (initialDistance > 0) {
                // Cálculo da Escala (Zoom)
                shape._scale = initialScale * (currentDistance / initialDistance);
                shape._scale = Math.max(0.3, Math.min(shape._scale, 10)); 
                
                // Cálculo da Rotação
                const deltaAngle = currentAngle - initialAngle;
                shape._rotation = initialRotation + deltaAngle;

                updateTransform(shape);
            }
        }
    };

    const endPointer = (ev) => {
        shape._pointers.delete(ev.pointerId);
        shape.releasePointerCapture(ev.pointerId);
        
        if (shape._pointers.size === 0) {
            shape.onpointermove = null;
            shape.onpointerup = null;
            shape.onpointercancel = null;
        } else if (shape._pointers.size === 1) {
            const remainingId = shape._pointers.keys().next().value;
            shape._pointers.set(remainingId, { x: ev.clientX, y: ev.clientY });
        }
    };

    shape.onpointerup = endPointer;
    shape.onpointercancel = endPointer;
}

// ============================================================================
// 3. ZOOM / ROTATION POR TRACKPAD/RATO NO ELEMENTO
// ============================================================================
function handleShapeWheel(e) {
    e.preventDefault(); 
    e.stopPropagation();

    const shape = e.currentTarget;
    if (!shape._scale) shape._scale = 1;
    if (!shape._rotation) shape._rotation = 0;
    
    if (e.shiftKey) {
        // ROTAÇÃO (Shift + Scroll)
        const rotationSpeed = 0.5;
        shape._rotation += e.deltaY * rotationSpeed;
    } else {
        // ZOOM (Pinch no Trackpad ou Scroll normal)
        const zoomSpeed = e.ctrlKey || e.metaKey ? 0.01 : 0.005;
        shape._scale -= e.deltaY * zoomSpeed;
        shape._scale = Math.max(0.3, Math.min(shape._scale, 10));
    }
    
    updateTransform(shape);
}
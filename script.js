// ============================================================================
// 0. BLOQUEIOS DE GESTOS NATIVOS DO BROWSER (SAFARI E CHROME)
// ============================================================================
document.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());

const tools = document.querySelectorAll('.tool');
const stage = document.getElementById('stage');

tools.forEach(tool => tool.style.touchAction = 'none');

// ============================================================================
// 1. MOTOR NATIVO DE MULTI-TOUCH (SAFARI / CHROME COMPATÍVEL)
// ============================================================================
function makeInteractable(shape) {
    shape.style.touchAction = 'none'; // Desativa qualquer comportamento de scroll do browser no elemento
    
    const isLine = shape.dataset.shape === 'line';
    const baseRot = isLine ? -45 : 0;
    
    // Estado atual
    let currentScale = 1;
    let currentRotation = 0;
    let currentLeft = parseFloat(shape.style.left) || 0;
    let currentTop = parseFloat(shape.style.top) || 0;

    // Estado inicial no momento do toque
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

    // Calcula o ponto central exato de todos os dedos que tocam no objeto
    function getCentroid(touches) {
        let x = 0, y = 0;
        for (let i = 0; i < touches.length; i++) {
            x += touches[i].clientX;
            y += touches[i].clientY;
        }
        return { x: x / touches.length, y: y / touches.length };
    }

    // Grava a baseline de posições sempre que um dedo é adicionado ou removido
    function initBaselines(touches) {
        if (touches.length === 0) return;
        
        const centroid = getCentroid(touches);
        startPanX = centroid.x;
        startPanY = centroid.y;
        startLeft = currentLeft;
        startTop = currentTop;

        if (touches.length >= 2) {
            const dx = touches[1].clientX - touches[0].clientX;
            const dy = touches[1].clientY - touches[0].clientY;
            startDist = Math.hypot(dx, dy);
            startAngle = Math.atan2(dy, dx) * (180 / Math.PI);
            startScale = currentScale;
            startRotation = currentRotation;
        }
    }

    // --- EVENTOS TOUCH (MESA) ---
    shape.addEventListener('touchstart', (e) => {
        e.preventDefault(); 
        e.stopPropagation();
        stage.appendChild(shape); // Traz para a frente
        initBaselines(e.targetTouches);
    }, { passive: false });

    shape.addEventListener('touchmove', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const touches = e.targetTouches;
        if (touches.length === 0) return;

        const centroid = getCentroid(touches);

        // MOVER (PANNING): Segue o centro dos dedos
        currentLeft = startLeft + (centroid.x - startPanX);
        currentTop = startTop + (centroid.y - startPanY);

        // ZOOM E ROTAÇÃO (2 ou mais dedos)
        if (touches.length >= 2) {
            const dx = touches[1].clientX - touches[0].clientX;
            const dy = touches[1].clientY - touches[0].clientY;
            const currentDist = Math.hypot(dx, dy);
            const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);

            if (startDist > 0) {
                currentScale = startScale * (currentDist / startDist);
                currentScale = Math.max(0.3, Math.min(currentScale, 10)); // Limites
            }

            const deltaAngle = currentAngle - startAngle;
            currentRotation = startRotation + deltaAngle;
        }

        render();
    }, { passive: false });

    shape.addEventListener('touchend', (e) => {
        e.preventDefault();
        initBaselines(e.targetTouches); // Recalcula se o utilizador levantar apenas um dedo
    }, { passive: false });

    shape.addEventListener('touchcancel', (e) => {
        initBaselines(e.targetTouches);
    }, { passive: false });

    // --- EVENTOS DE RATO (PARA TESTES NO PC) ---
    // Fallback para arrastar com o rato
    let isDragging = false;
    shape.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        stage.appendChild(shape);
        startPanX = e.clientX;
        startPanY = e.clientY;
        startLeft = currentLeft;
        startTop = currentTop;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentLeft = startLeft + (e.clientX - startPanX);
        currentTop = startTop + (e.clientY - startPanY);
        render();
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Fallback para zoom/rotacionar com Trackpad/Scroll do rato
    shape.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
            currentRotation += e.deltaY * 0.5;
        } else {
            const zoomSpeed = e.ctrlKey || e.metaKey ? 0.01 : 0.005;
            currentScale -= e.deltaY * zoomSpeed;
            currentScale = Math.max(0.3, Math.min(currentScale, 10));
        }
        render();
    }, { passive: false });
    
    render();
}

// ============================================================================
// 2. DRAG & DROP DA BARRA LATERAL (SUPORTA RATO E TOUCH EM SIMULTÂNEO)
// ============================================================================
tools.forEach(tool => {
    // Função unificada para iniciar o arrasto da ferramenta
    const startDrag = (clientX, clientY, identifier = null) => {
        const shapeClass = Array.from(tool.classList).find(cls => cls.startsWith('shape-'));
        const shapeType = tool.dataset.shape;
        
        const clone = document.createElement('div');
        clone.className = `tool ${shapeClass}`;
        clone.style.position = 'absolute';
        clone.style.zIndex = 1000;
        clone.style.touchAction = 'none';
        
        const isLine = shapeType === 'line';
        clone.style.transform = isLine ? 'translate(-50%, -50%) rotate(-45deg)' : 'translate(-50%, -50%)';
        
        document.body.appendChild(clone);

        const moveClone = (x, y) => {
            clone.style.left = x + 'px';
            clone.style.top = y + 'px';
        };
        
        moveClone(clientX, clientY);

        // Lógica de Movimento Touch
        const onTouchMove = (ev) => {
            const touch = Array.from(ev.changedTouches).find(t => t.identifier === identifier);
            if (touch) moveClone(touch.clientX, touch.clientY);
        };

        // Lógica de Fim de Touch
        const onTouchEnd = (ev) => {
            const touch = Array.from(ev.changedTouches).find(t => t.identifier === identifier);
            if (!touch) return;
            
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
            document.removeEventListener('touchcancel', onTouchEnd);
            clone.remove();
            
            handleDrop(touch.clientX, touch.clientY, shapeClass, shapeType);
        };

        // Lógica de Movimento Rato
        const onMouseMove = (ev) => moveClone(ev.clientX, ev.clientY);

        // Lógica de Fim Rato
        const onMouseUp = (ev) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            clone.remove();
            handleDrop(ev.clientX, ev.clientY, shapeClass, shapeType);
        };

        if (identifier !== null) {
            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', onTouchEnd);
            document.addEventListener('touchcancel', onTouchEnd);
        } else {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    };

    const handleDrop = (clientX, clientY, shapeClass, shapeType) => {
        const stageRect = stage.getBoundingClientRect();
        if (clientX >= stageRect.left && clientX <= stageRect.right &&
            clientY >= stageRect.top && clientY <= stageRect.bottom) {
            
            const shape = document.createElement('div');
            shape.className = `stage-item ${shapeClass}`;
            shape.dataset.shape = shapeType;
            shape.style.left = (clientX - stageRect.left) + 'px';
            shape.style.top = (clientY - stageRect.top) + 'px';
            
            stage.appendChild(shape);
            makeInteractable(shape);
        }
    };

    // Listeners independentes para garantir deteção no Safari
    tool.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        startDrag(touch.clientX, touch.clientY, touch.identifier);
    }, { passive: false });

    tool.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startDrag(e.clientX, e.clientY, null);
    });
});
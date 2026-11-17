const tools = document.querySelectorAll('.tool');
const stage = document.getElementById('stage');

// ============================================================================
// 1. CRIAR FORMAS A PARTIR DA BARRA LATERAL
// ============================================================================
tools.forEach(tool => {
    tool.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        
        // Descobre que forma é (ex: shape-circle, shape-square)
        const shapeClass = Array.from(tool.classList).find(cls => cls.startsWith('shape-'));
        
        // Cria um clone visual para seguir o dedo antes de largar no palco
        const clone = document.createElement('div');
        clone.className = `tool ${shapeClass}`;
        clone.style.position = 'absolute';
        clone.style.zIndex = 1000; 
        
        // A linha precisa da inclinação, as outras apenas precisam de estar centradas no dedo
        if(shapeClass === 'shape-line') {
            clone.style.transform = 'translate(-50%, -50%) rotate(-45deg)';
        } else {
            clone.style.transform = 'translate(-50%, -50%)';
        }
        
        document.body.appendChild(clone);

        const updateClonePos = (clientX, clientY) => {
            clone.style.left = clientX + 'px';
            clone.style.top = clientY + 'px';
        };
        
        updateClonePos(e.clientX, e.clientY);
        tool.setPointerCapture(e.pointerId);

        tool.onpointermove = (ev) => {
            if (ev.pointerId !== e.pointerId) return; 
            updateClonePos(ev.clientX, ev.clientY);
        };

        tool.onpointerup = (ev) => {
            if (ev.pointerId !== e.pointerId) return;
            
            tool.releasePointerCapture(e.pointerId);
            tool.onpointermove = null;
            tool.onpointerup = null;
            clone.remove(); // Apaga o clone temporário
            
            // Verifica se o dedo foi levantado dentro do Palco
            const stageRect = stage.getBoundingClientRect();
            if (ev.clientX >= stageRect.left && ev.clientX <= stageRect.right &&
                ev.clientY >= stageRect.top && ev.clientY <= stageRect.bottom) {
                
                // Cria a forma definitiva no palco
                const finalShape = document.createElement('div');
                finalShape.className = `stage-item ${shapeClass}`;
                
                // Posição local dentro do palco
                finalShape.style.left = (ev.clientX - stageRect.left) + 'px';
                finalShape.style.top = (ev.clientY - stageRect.top) + 'px';
                
                stage.appendChild(finalShape);
                
                // --- ADICIONA OS EVENTOS PARA MOVER E FAZER ZOOM NESTA FORMA ---
                finalShape.addEventListener('pointerdown', startMovingShape);
                
                // Evento para Trackpad/Rato (Scroll / Zoom com os 2 dedos no Mac)
                finalShape.addEventListener('wheel', (wheelEv) => {
                    // Impede que a página inteira faça zoom
                    wheelEv.preventDefault(); 
                    
                    if (!finalShape._scale) finalShape._scale = 1;
                    
                    const baseTransform = finalShape.classList.contains('shape-line') 
                        ? 'translate(-50%, -50%) rotate(-45deg)' 
                        : 'translate(-50%, -50%)';

                    // Modifica a escala (wheelEv.deltaY dita a direção do scroll)
                    finalShape._scale -= wheelEv.deltaY * 0.005;
                    
                    // Limites do Zoom: entre 0.5x (metade) e 8x (gigante)
                    finalShape._scale = Math.max(0.5, Math.min(finalShape._scale, 8));
                    
                    // Aplica a nova escala por cima da posição/rotação base
                    finalShape.style.transform = `${baseTransform} scale(${finalShape._scale})`;
                }, { passive: false }); 
            }
        };
    });
});

// ============================================================================
// 2. MOVER E FAZER ZOOM (PINCH) NAS FORMAS DO PALCO
// ============================================================================
function startMovingShape(e) {
    e.preventDefault();
    const shape = e.currentTarget;
    const stageRect = stage.getBoundingClientRect();
    
    // Inicializa propriedades personalizadas no elemento se ainda não existirem
    if (!shape._scale) shape._scale = 1;
    if (!shape._pointers) shape._pointers = {};

    // Guarda este dedo na lista de dedos a tocar na forma
    shape._pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

    // String base do CSS Transform (necessário para a linha não perder a rotação)
    const baseTransform = shape.classList.contains('shape-line') 
        ? 'translate(-50%, -50%) rotate(-45deg)' 
        : 'translate(-50%, -50%)';

    // Traz a forma para a frente das outras ao tocar
    stage.appendChild(shape); 
    shape.setPointerCapture(e.pointerId);

    // Preparação para calcular o zoom com 2 dedos (Pinch)
    const pointerIds = Object.keys(shape._pointers);
    let initialDistance = 0;
    let startScale = shape._scale;

    // Se existirem exatamente 2 dedos a tocar, calcula a distância inicial entre eles
    if (pointerIds.length === 2) {
        const p1 = shape._pointers[pointerIds[0]];
        const p2 = shape._pointers[pointerIds[1]];
        initialDistance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    shape.onpointermove = (ev) => {
        if (!shape._pointers[ev.pointerId]) return;

        // Atualiza a posição atual deste dedo
        shape._pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        const activeIds = Object.keys(shape._pointers);

        if (activeIds.length === 1) {
            // --- MOVER (1 DEDO) ---
            shape.style.left = (ev.clientX - stageRect.left) + 'px';
            shape.style.top = (ev.clientY - stageRect.top) + 'px';
        } 
        else if (activeIds.length === 2) {
            // --- ZOOM / PINCH (2 DEDOS) ---
            const p1 = shape._pointers[activeIds[0]];
            const p2 = shape._pointers[activeIds[1]];
            
            // Calcula a nova distância entre os 2 dedos
            const currentDistance = Math.hypot(p1.x - p2.x, p1.y - p2.y);

            if (initialDistance > 0) {
                // A nova escala é a proporção da distância atual pela distância inicial
                shape._scale = startScale * (currentDistance / initialDistance);
                
                // Limites do Zoom: entre 0.5x e 8x
                shape._scale = Math.max(0.5, Math.min(shape._scale, 8));
                
                // Aplica a escala à forma
                shape.style.transform = `${baseTransform} scale(${shape._scale})`;
            }
        }
    };

    // Função que corre quando se levanta um dedo
    const endPointer = (ev) => {
        delete shape._pointers[ev.pointerId];
        shape.releasePointerCapture(ev.pointerId);
        
        // Se já não houver dedos nenhuns na forma, limpa os eventos
        if (Object.keys(shape._pointers).length === 0) {
            shape.onpointermove = null;
            shape.onpointerup = null;
            shape.onpointercancel = null;
        } else {
            // Se levantaste 1 dedo, mas o outro ainda lá ficou, precisamos de 
            // recalcular a posição para a forma não "saltar"
            const remainingIds = Object.keys(shape._pointers);
            if (remainingIds.length === 1) {
                shape._pointers[remainingIds[0]] = { x: ev.clientX, y: ev.clientY };
            }
        }
    };

    shape.onpointerup = endPointer;
    shape.onpointercancel = endPointer;
}
const tools = document.querySelectorAll('.tool');
const stage = document.getElementById('stage');

// 1. LÓGICA DE CRIAR A FORMA A PARTIR DA BARRA LATERAL
tools.forEach(tool => {
    tool.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        
        // Descobre qual forma foi clicada (circle, square, etc)
        const shapeClass = Array.from(tool.classList).find(cls => cls.startsWith('shape-'));
        
        // Cria um clone temporário para seguir o dedo pelo ecrã inteiro
        const clone = document.createElement('div');
        clone.className = `tool ${shapeClass}`;
        clone.style.position = 'absolute';
        clone.style.zIndex = 1000; // Fica por cima de tudo
        
        if(shapeClass === 'shape-line') {
            clone.style.transform = 'translate(-50%, -50%) rotate(-45deg)';
        } else {
            clone.style.transform = 'translate(-50%, -50%)';
        }
        
        document.body.appendChild(clone);

        // Função para atualizar posição
        const updateClonePos = (clientX, clientY) => {
            clone.style.left = clientX + 'px';
            clone.style.top = clientY + 'px';
        };
        
        // Posiciona logo onde o utilizador tocou
        updateClonePos(e.clientX, e.clientY);

        // Prende os eventos de movimento a este dedo/ponteiro específico
        tool.setPointerCapture(e.pointerId);

        tool.onpointermove = (ev) => {
            if (ev.pointerId !== e.pointerId) return; // Ignora outros dedos
            updateClonePos(ev.clientX, ev.clientY);
        };

        // Quando o utilizador levanta o dedo
        tool.onpointerup = (ev) => {
            if (ev.pointerId !== e.pointerId) return;
            
            tool.releasePointerCapture(e.pointerId);
            tool.onpointermove = null;
            tool.onpointerup = null;
            
            // Remove o clone temporário
            clone.remove();
            
            // Verifica se o dedo foi levantado dentro do Palco
            const stageRect = stage.getBoundingClientRect();
            if (ev.clientX >= stageRect.left && ev.clientX <= stageRect.right &&
                ev.clientY >= stageRect.top && ev.clientY <= stageRect.bottom) {
                
                // Se sim, cria a forma permanente dentro da div do palco
                const finalShape = document.createElement('div');
                finalShape.className = `stage-item ${shapeClass}`;
                
                // Calcula a posição relativa ao canto do palco
                finalShape.style.left = (ev.clientX - stageRect.left) + 'px';
                finalShape.style.top = (ev.clientY - stageRect.top) + 'px';
                
                stage.appendChild(finalShape);
                
                // Torna a nova forma arrastável
                finalShape.addEventListener('pointerdown', startMovingShape);
            }
        };
    });
});


// 2. LÓGICA PARA MOVER FORMAS QUE JÁ ESTÃO NO PALCO
function startMovingShape(e) {
    e.preventDefault();
    const shape = e.currentTarget;
    const stageRect = stage.getBoundingClientRect();
    
    // Traz a forma para a frente das outras ao tocar
    stage.appendChild(shape);
    
    // Captura o ponteiro
    shape.setPointerCapture(e.pointerId);
    
    shape.onpointermove = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        
        // Move centrado no dedo, sempre restrito às coordenadas locais do palco
        shape.style.left = (ev.clientX - stageRect.left) + 'px';
        shape.style.top = (ev.clientY - stageRect.top) + 'px';
    };
    
    shape.onpointerup = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        shape.releasePointerCapture(e.pointerId);
        shape.onpointermove = null;
        shape.onpointerup = null;
    };
}
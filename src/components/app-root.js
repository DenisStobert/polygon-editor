// src/components/app-root.js
class AppRoot extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };
        this.draggedElement = null;

        this.shadowRoot.innerHTML = `
        <style>
          .container {
            font-family: sans-serif;
          }
          .controls {
            margin-bottom: 10px;
          }
          .zone {
            border: 1px solid #ccc;
            height: 200px;
            margin-bottom: 10px;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            padding: 5px;
            overflow: auto;
          }
          .workspace-wrapper {
            border: 1px solid #000;
            height: 400px;
            overflow: hidden;
            position: relative;
          }
          #workspace {
            width: 2000px;
            height: 2000px;
            transform-origin: 0 0;
            position: relative;
            background-size: 100px 100px;
            background-image: linear-gradient(to right, #eee 1px, transparent 1px),
                              linear-gradient(to bottom, #eee 1px, transparent 1px);
          }
          .polygon-wrapper {
            width: 100px;
            height: 100px;
            cursor: grab;
          }
          .polygon-wrapper:hover {
            outline: 2px dashed #007acc;
            box-shadow: 0 0 5px rgba(0,0,0,0.2);
          }
          .workspace .polygon-wrapper {
            position: absolute;
          }
          svg {
            width: 100%;
            height: 100%;
          }
          .ruler-x, .ruler-y {
            user-select: none;
            pointer-events: none;
            position: absolute;
            font-size: 10px;
            color: #000;
            z-index: 10;
          }
          .ruler-x {
            top: 0;
            left: 20px;
            height: 20px;
            width: calc(100% - 20px);
            display: flex;
          }
          .ruler-y {
            top: 20px;
            left: 0;
            width: 20px;
            height: calc(100% - 20px);
            display: flex;
            flex-direction: column;
          }
          .tick {
            flex-shrink: 0;
            text-align: center;
            color: #666;
          }
        </style>
        <div class="container">
          <div class="controls">
            <button id="create">Создать</button>
            <button id="save">Сохранить</button>
            <button id="load">Загрузить</button>
            <button id="reset">Сбросить</button>
          </div>
          <div class="zone" id="buffer">Буферная зона</div>
          <div class="workspace-wrapper" id="workspaceContainer">
            <div class="ruler-x" id="rulerX"></div>
            <div class="ruler-y" id="rulerY"></div>
            <div id="workspace"></div>
          </div>
        </div>
        `;

        this.buffer = this.shadowRoot.getElementById('buffer');
        this.workspaceContainer = this.shadowRoot.getElementById('workspaceContainer');
        this.workspace = this.shadowRoot.getElementById('workspace');
        this.rulerX = this.shadowRoot.getElementById('rulerX');
        this.rulerY = this.shadowRoot.getElementById('rulerY');

        this.shadowRoot.getElementById('create').addEventListener('click', () => this.createPolygons());
        this.shadowRoot.getElementById('save').addEventListener('click', () => this.save());
        this.shadowRoot.getElementById('load').addEventListener('click', () => this.load());
        this.shadowRoot.getElementById('reset').addEventListener('click', () => this.reset());

        this.buffer.addEventListener('dragover', e => e.preventDefault());
        this.buffer.addEventListener('drop', e => {
          e.preventDefault();
          if (this.draggedElement) {
            this.buffer.appendChild(this.draggedElement);
            this.draggedElement = null;
          }
        });

        this.workspace.addEventListener('dragover', e => e.preventDefault());
        this.workspace.addEventListener('drop', e => {
          e.preventDefault();
          if (this.draggedElement) {
            const rect = this.workspace.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.offset.x) / this.scale;
            const y = (e.clientY - rect.top - this.offset.y) / this.scale;
            this.draggedElement.style.left = `${x}px`;
            this.draggedElement.style.top = `${y}px`;
            this.workspace.appendChild(this.draggedElement);
            this.draggedElement = null;
          }
        });

        this.workspaceContainer.addEventListener('wheel', e => {
          e.preventDefault();
          const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
          this.scale *= scaleFactor;
          this.updateTransform();
          this.renderRulers();
        });

        this.workspaceContainer.addEventListener('mousedown', e => {
          if (e.button !== 0 || e.target.closest('.polygon-wrapper')) return;
          this.isPanning = true;
          this.workspaceContainer.style.cursor = 'grabbing';
          this.lastMouse = { x: e.clientX, y: e.clientY };
        });

        this.workspaceContainer.addEventListener('mousemove', e => {
          if (!this.isPanning) return;
          const dx = e.clientX - this.lastMouse.x;
          const dy = e.clientY - this.lastMouse.y;
          this.offset.x += dx;
          this.offset.y += dy;
          this.lastMouse = { x: e.clientX, y: e.clientY };
          this.updateTransform();
          this.renderRulers();
        });

        ['mouseup', 'mouseleave'].forEach(ev => {
          this.workspaceContainer.addEventListener(ev, () => {
            this.isPanning = false;
            this.workspaceContainer.style.cursor = 'default';
          });
        });

        this.load();
        this.renderRulers();
    }

    updateTransform() {
        this.workspace.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
    }

    renderRulers() {
        this.rulerX.innerHTML = '';
        this.rulerY.innerHTML = '';
        const step = 100;
        const rect = this.workspace.getBoundingClientRect();
        const countX = rect.width / (step * this.scale);
        const countY = rect.height / (step * this.scale);

        for (let i = 0; i < countX; i++) {
            const tick = document.createElement('div');
            tick.classList.add('tick');
            tick.style.width = `${step * this.scale}px`;
            tick.textContent = i * step;
            this.rulerX.appendChild(tick);
        }

        for (let i = 0; i < countY; i++) {
            const tick = document.createElement('div');
            tick.classList.add('tick');
            tick.style.height = `${step * this.scale}px`;
            tick.textContent = i * step;
            this.rulerY.appendChild(tick);
        }
    }

    createPolygons() {
        this.buffer.innerHTML = '';
        const count = Math.floor(Math.random() * 16) + 5;
        for (let i = 0; i < count; i++) {
            const wrapper = document.createElement('div');
            wrapper.classList.add('polygon-wrapper');
            wrapper.setAttribute('draggable', 'true');
            wrapper.title = "ЛКМ — перетащить, ПКМ — удалить";

            wrapper.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (confirm('Удалить полигон?')) wrapper.remove();
            });

            wrapper.addEventListener('dragstart', () => this.draggedElement = wrapper);
            wrapper.addEventListener('dragend', () => this.draggedElement = null);

            wrapper.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                const offsetX = e.offsetX;
                const offsetY = e.offsetY;
                const move = (ev) => {
                    const rect = this.workspace.getBoundingClientRect();
                    const x = (ev.clientX - rect.left - this.offset.x - offsetX) / this.scale;
                    const y = (ev.clientY - rect.top - this.offset.y - offsetY) / this.scale;
                    wrapper.style.left = `${x}px`;
                    wrapper.style.top = `${y}px`;
                };
                const up = () => {
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
            });

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('fill', this.randomColor());
            polygon.setAttribute('points', this.randomPoints());
            svg.appendChild(polygon);
            wrapper.appendChild(svg);
            this.buffer.appendChild(wrapper);
        }
    }

    randomPoints() {
        const n = Math.floor(Math.random() * 5) + 3;
        const cx = 50, cy = 50, r = 40;
        let pts = '';
        for (let i = 0; i < n; i++) {
            const angle = (Math.PI * 2 * i) / n;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            pts += `${x},${y} `;
        }
        return pts.trim();
    }

    randomColor() {
        return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
    }

    save() {
        const data = {
            buffer: this.buffer.innerHTML,
            workspace: this.workspace.innerHTML,
            transform: {
                scale: this.scale,
                offset: this.offset
            }
        };
        localStorage.setItem('polygons-data', JSON.stringify(data));
    }

    load() {
        const data = localStorage.getItem('polygons-data');
        if (!data) return;
        const parsed = JSON.parse(data);
        this.buffer.innerHTML = parsed.buffer;
        this.workspace.innerHTML = parsed.workspace;
        this.scale = parsed.transform.scale;
        this.offset = parsed.transform.offset;
        this.updateTransform();
        this.restoreDragEvents(this.buffer);
        this.restoreDragEvents(this.workspace);
    }

    reset() {
        localStorage.removeItem('polygons-data');
        this.buffer.innerHTML = '';
        this.workspace.innerHTML = '';
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.updateTransform();
        this.renderRulers();
    }

    restoreDragEvents(container) {
        container.querySelectorAll('.polygon-wrapper').forEach(wrapper => {
            wrapper.setAttribute('draggable', 'true');
            wrapper.title = "ЛКМ — перетащить, ПКМ — удалить";

            wrapper.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (confirm('Удалить полигон?')) wrapper.remove();
            });

            wrapper.addEventListener('dragstart', () => this.draggedElement = wrapper);
            wrapper.addEventListener('dragend', () => this.draggedElement = null);

            wrapper.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                const offsetX = e.offsetX;
                const offsetY = e.offsetY;
                const move = (ev) => {
                    const rect = this.workspace.getBoundingClientRect();
                    const x = (ev.clientX - rect.left - this.offset.x - offsetX) / this.scale;
                    const y = (ev.clientY - rect.top - this.offset.y - offsetY) / this.scale;
                    wrapper.style.left = `${x}px`;
                    wrapper.style.top = `${y}px`;
                };
                const up = () => {
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
            });
        });
    }
}

customElements.define('app-root', AppRoot);
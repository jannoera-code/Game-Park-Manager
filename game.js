/**
 * African Wildlife Reserve Manager - Tactical Survival Hybrid
 * Core Game Engine & Class Architecture
 */

// Helper deterministic pseudo-random generator based on seed
function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// Helper simple string hash for seed generation
function hashCoordinates(x, y) {
    let hash = 17;
    hash = hash * 31 + x;
    hash = hash * 31 + y;
    return Math.abs(hash);
}

/**
 * ResourceNode Class
 * Represents harvestable Trees and Rocks in the world with a 5-hit HP system.
 */
class ResourceNode {
    constructor(id, type, x, y) {
        this.id = id;
        this.type = type; // 'tree' or 'rock'
        this.x = x;
        this.y = y;
        this.hp = 5;
        this.maxHp = 5;
        this.radius = type === 'tree' ? 22 : 18;
        this.yieldAmount = type === 'tree' ? 5 : 3;
        this.hitFlashTimer = 0; // Duration for hit flash visual effect
    }

    hit(damage = 1) {
        this.hp = Math.max(0, this.hp - damage);
        this.hitFlashTimer = 0.15; // 150ms flash effect
        const isDestroyed = this.hp <= 0;
        return {
            destroyed: isDestroyed,
            type: this.type,
            yieldAmount: isDestroyed ? this.yieldAmount : 0,
            hp: this.hp
        };
    }

    update(dt) {
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
        }
    }

    render(ctx, images) {
        ctx.save();
        ctx.translate(this.x, this.y);

        let scale = 1;
        if (this.hitFlashTimer > 0) {
            scale = 1.15;
        }
        ctx.scale(scale, scale);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        if (this.type === 'tree') {
            ctx.ellipse(2, this.radius - 2, this.radius * 0.9, this.radius * 0.3, 0, 0, Math.PI * 2);
        } else {
            ctx.ellipse(3, this.radius * 0.4, this.radius, this.radius * 0.4, 0, 0, Math.PI * 2);
        }
        ctx.fill();

        const imgKey = this.type === 'tree' ? 'tree.png' : 'rock.png';
        const img = images[imgKey];

        if (img && img.complete) {
            const drawSize = this.type === 'tree' ? this.radius * 2.8 : this.radius * 2.4;
            ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        } else {
            ctx.fillStyle = this.type === 'tree' ? '#1e5e27' : '#7f8c8d';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.hitFlashTimer > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.hp < this.maxHp) {
            const barW = 30;
            const barH = 5;
            const barX = -barW / 2;
            const barY = -this.radius - 12;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

            const hpRatio = this.hp / this.maxHp;
            ctx.fillStyle = hpRatio > 0.4 ? '#2ecc71' : '#e74c3c';
            ctx.fillRect(barX, barY, barW * hpRatio, barH);
        }

        ctx.restore();
    }
}

/**
 * Chunk Class
 * Represents a single 1000x1000 pixel area in the infinite procedural world.
 */
class Chunk {
    constructor(chunkX, chunkY, chunkSize, reserveBounds) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.chunkSize = chunkSize;
        this.worldX = chunkX * chunkSize;
        this.worldY = chunkY * chunkSize;
        this.resourceNodes = [];

        this.generate(reserveBounds);
    }

    generate(reserveBounds) {
        const seed = hashCoordinates(this.chunkX, this.chunkY);
        let localSeed = seed;

        const isInsideReserve = (x, y, margin = 50) => {
            return (
                x >= reserveBounds.x - margin &&
                x <= reserveBounds.x + reserveBounds.width + margin &&
                y >= reserveBounds.y - margin &&
                y <= reserveBounds.y + reserveBounds.height + margin
            );
        };

        const nodeCount = Math.floor(12 + seededRandom(localSeed++) * 10);

        for (let i = 0; i < nodeCount; i++) {
            const nodeX = this.worldX + seededRandom(localSeed++) * this.chunkSize;
            const nodeY = this.worldY + seededRandom(localSeed++) * this.chunkSize;

            if (isInsideReserve(nodeX, nodeY, 40)) {
                continue;
            }

            const type = seededRandom(localSeed++) > 0.4 ? 'tree' : 'rock';
            const nodeId = `node_${this.chunkX}_${this.chunkY}_${i}`;
            this.resourceNodes.push(new ResourceNode(nodeId, type, nodeX, nodeY));
        }
    }

    update(dt) {
        this.resourceNodes.forEach(node => node.update(dt));
    }

    render(ctx, images, viewBounds) {
        this.resourceNodes.forEach(node => {
            if (
                node.x + node.radius >= viewBounds.minX &&
                node.x - node.radius <= viewBounds.maxX &&
                node.y + node.radius >= viewBounds.minY &&
                node.y - node.radius <= viewBounds.maxY
            ) {
                node.render(ctx, images);
            }
        });
    }
}

/**
 * ChunkManager Class
 * Manages dynamic loading, unloading, and query of 1000x1000 procedural chunks.
 */
class ChunkManager {
    constructor(chunkSize = 1000, renderRadius = 2) {
        this.chunkSize = chunkSize;
        this.renderRadius = renderRadius;
        this.loadedChunks = new Map();
    }

    getChunkKey(cx, cy) {
        return `${cx},${cy}`;
    }

    update(playerX, playerY, reserveBounds, dt) {
        const currentChunkX = Math.floor(playerX / this.chunkSize);
        const currentChunkY = Math.floor(playerY / this.chunkSize);

        const activeKeys = new Set();

        for (let dx = -this.renderRadius; dx <= this.renderRadius; dx++) {
            for (let dy = -this.renderRadius; dy <= this.renderRadius; dy++) {
                const cx = currentChunkX + dx;
                const cy = currentChunkY + dy;
                const key = this.getChunkKey(cx, cy);
                activeKeys.add(key);

                if (!this.loadedChunks.has(key)) {
                    this.loadedChunks.set(key, new Chunk(cx, cy, this.chunkSize, reserveBounds));
                }
            }
        }

        for (const [key, chunk] of this.loadedChunks.entries()) {
            if (!activeKeys.has(key)) {
                this.loadedChunks.delete(key);
            } else {
                chunk.update(dt);
            }
        }
    }

    getAllResourceNodes() {
        const nodes = [];
        for (const chunk of this.loadedChunks.values()) {
            nodes.push(...chunk.resourceNodes);
        }
        return nodes;
    }

    removeResourceNode(nodeId) {
        for (const chunk of this.loadedChunks.values()) {
            const idx = chunk.resourceNodes.findIndex(n => n.id === nodeId);
            if (idx !== -1) {
                chunk.resourceNodes.splice(idx, 1);
                return true;
            }
        }
        return false;
    }

    render(ctx, images, viewBounds) {
        for (const chunk of this.loadedChunks.values()) {
            chunk.render(ctx, images, viewBounds);
        }
    }
}

/**
 * Player Class
 * Controls player movement, screen-shake on hit, and rendering.
 * Can pass freely through reserve fences, but collides with resources and placed structures.
 */
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 16;
        this.speed = 240; // px / sec
        this.image = Math.random() < 0.5 ? 'ranger1.png' : 'ranger2.png';
        this.bobTimer = 0;
        this.bobY = 0;
        this.wobbleAngle = 0;
        this.facingLeft = false;
        this.screenShakeTimer = 0;
        this.screenShakeIntensity = 0;
    }

    triggerScreenShake(intensity = 6, duration = 0.15) {
        this.screenShakeIntensity = intensity;
        this.screenShakeTimer = duration;
    }

    getScreenShakeOffset() {
        if (this.screenShakeTimer > 0) {
            const rx = (Math.random() - 0.5) * 2 * this.screenShakeIntensity;
            const ry = (Math.random() - 0.5) * 2 * this.screenShakeIntensity;
            return { x: rx, y: ry };
        }
        return { x: 0, y: 0 };
    }

    checkCollision(px, py, resourceNodes, placedBuildings) {
        const r = this.radius;

        // Player passes FREELY through reserve fences!
        // Player collides with Resource Nodes (Trees / Rocks)
        for (const node of resourceNodes) {
            const dist = Math.hypot(px - node.x, py - node.y);
            if (dist < r + node.radius * 0.7) return true;
        }

        // Player collides with Placed Buildings (Furnaces, Ranger Huts)
        for (const b of placedBuildings) {
            const bx1 = b.x - b.width / 2;
            const bx2 = b.x + b.width / 2;
            const by1 = b.y - b.height / 2;
            const by2 = b.y + b.height / 2;

            const closestX = Math.max(bx1, Math.min(px, bx2));
            const closestY = Math.max(by1, Math.min(py, by2));
            const distX = px - closestX;
            const distY = py - closestY;

            if ((distX * distX + distY * distY) < r * r) {
                return true;
            }
        }

        return false;
    }

    update(dt, keys, resourceNodes, placedBuildings) {
        if (this.screenShakeTimer > 0) {
            this.screenShakeTimer = Math.max(0, this.screenShakeTimer - dt);
        }

        let dx = 0;
        let dy = 0;

        if (keys.w || keys.ArrowUp) dy -= 1;
        if (keys.s || keys.ArrowDown) dy += 1;
        if (keys.a || keys.ArrowLeft) dx -= 1;
        if (keys.d || keys.ArrowRight) dx += 1;

        if (dx !== 0 && dy !== 0) {
            dx *= Math.SQRT1_2;
            dy *= Math.SQRT1_2;
        }

        const moveX = dx * this.speed * dt;
        const moveY = dy * this.speed * dt;

        if (moveX !== 0) {
            const newX = this.x + moveX;
            if (!this.checkCollision(newX, this.y, resourceNodes, placedBuildings)) {
                this.x = newX;
            }
        }

        if (moveY !== 0) {
            const newY = this.y + moveY;
            if (!this.checkCollision(this.x, newY, resourceNodes, placedBuildings)) {
                this.y = newY;
            }
        }

        const isMoving = (dx !== 0 || dy !== 0);
        if (dx < 0) this.facingLeft = true;
        else if (dx > 0) this.facingLeft = false;

        if (isMoving) {
            this.bobTimer += dt * 14;
            this.bobY = Math.sin(this.bobTimer) * 4;
            this.wobbleAngle = Math.sin(this.bobTimer * 0.5) * (6 * Math.PI / 180);
        } else {
            this.bobY += (0 - this.bobY) * Math.min(1, dt * 10);
            this.wobbleAngle += (0 - this.wobbleAngle) * Math.min(1, dt * 10);
        }
    }

    render(ctx, images) {
        const playerImg = images[this.image];
        ctx.save();
        ctx.translate(this.x, this.y + this.bobY);
        ctx.rotate(this.wobbleAngle);

        if (this.facingLeft) {
            ctx.scale(-1, 1);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 18, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (playerImg && playerImg.complete) {
            const size = 48;
            ctx.drawImage(playerImg, -size / 2, -size / 2, size, size);
        } else {
            ctx.fillStyle = '#d35400';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * Ranger Class
 * Represents hired rangers that ONLY physically spawn if a Ranger Hut is built.
 * Tied to the Ranger Hut location and patrols nearby.
 */
class Ranger {
    constructor(id, name, hutX, hutY, image) {
        this.id = id;
        this.name = name;
        this.hutX = hutX;
        this.hutY = hutY;
        this.x = hutX + (Math.random() - 0.5) * 40;
        this.y = hutY + (Math.random() - 0.5) * 40;
        this.targetX = this.x;
        this.targetY = this.y;
        this.speed = 40 + Math.random() * 20;
        this.image = image || (Math.random() < 0.5 ? 'ranger1.png' : 'ranger2.png');
        this.bobTimer = Math.random() * 10;
        this.bobY = 0;
        this.wobbleAngle = 0;
        this.facingLeft = false;
        this.patrolRadius = 120;
    }

    update(dt) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 10) {
            // Pick new target near home Ranger Hut
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * this.patrolRadius;
            this.targetX = this.hutX + Math.cos(angle) * r;
            this.targetY = this.hutY + Math.sin(angle) * r;
        } else {
            if (dx < 0) this.facingLeft = true;
            else if (dx > 0) this.facingLeft = false;

            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;

            this.bobTimer += dt * 8;
            this.bobY = Math.sin(this.bobTimer) * 3;
            this.wobbleAngle = Math.sin(this.bobTimer * 0.5) * (4 * Math.PI / 180);
        }
    }

    render(ctx, images) {
        const rangerImg = images[this.image];
        ctx.save();
        ctx.translate(this.x, this.y + this.bobY);
        ctx.rotate(this.wobbleAngle);

        if (this.facingLeft) {
            ctx.scale(-1, 1);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, 16, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (rangerImg && rangerImg.complete) {
            const size = 44;
            ctx.drawImage(rangerImg, -size / 2, -size / 2, size, size);
        } else {
            ctx.fillStyle = '#2980b9';
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * Furnace Class
 * Handles background smelting ticks: Consumes Wood fuel to smelt Stone into Processed Stone.
 */
class Furnace {
    constructor(id, x, y, width = 70, height = 70) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.fuelWood = 0;       // Current wood fuel level
        this.maxFuel = 20;
        this.rawStone = 0;       // Current unsmelted stone
        this.maxMaterial = 20;
        this.processedStone = 0; // Finished product ready for pickup

        this.isSmelting = false;
        this.smeltTimer = 0;
        this.smeltDuration = 3.0; // 3 seconds per stone smelted
    }

    addFuel(amount) {
        const added = Math.min(amount, this.maxFuel - this.fuelWood);
        this.fuelWood += added;
        return added;
    }

    addMaterial(amount) {
        const added = Math.min(amount, this.maxMaterial - this.rawStone);
        this.rawStone += added;
        return added;
    }

    collectOutput() {
        const collected = this.processedStone;
        this.processedStone = 0;
        return collected;
    }

    update(dt) {
        if (this.fuelWood > 0 && this.rawStone > 0) {
            this.isSmelting = true;
            this.smeltTimer += dt;

            if (this.smeltTimer >= this.smeltDuration) {
                this.smeltTimer = 0;
                this.fuelWood -= 1; // Consume 1 Wood
                this.rawStone -= 1; // Consume 1 Stone
                this.processedStone += 1; // Produce 1 Processed Stone
            }
        } else {
            this.isSmelting = false;
            this.smeltTimer = 0;
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Furnace Base Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, this.height / 2 - 4, this.width * 0.5, this.height * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stone Furnace Body
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.strokeStyle = '#2c2c2c';
        ctx.lineWidth = 3;
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Brick grid details
        ctx.strokeStyle = '#383838';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, 0);
        ctx.lineTo(this.width / 2, 0);
        ctx.stroke();

        // Furnace Door / Fire Pit
        ctx.fillStyle = this.isSmelting ? '#e67e22' : '#1a1a1a';
        ctx.beginPath();
        ctx.arc(0, this.height / 4, 12, Math.PI, 0, false);
        ctx.fill();

        if (this.isSmelting) {
            // Animated Fire Glow
            const glow = 2 + Math.sin(performance.now() / 150) * 2;
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(0, this.height / 4, 6 + glow, 0, Math.PI * 2);
            ctx.fill();
        }

        // Label / Icon
        ctx.fillStyle = '#f0f4f8';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FURNACE', 0, -this.height / 4);

        ctx.restore();
    }
}

/**
 * Main ReserveGame Manager Class
 */
class ReserveGame {
    constructor() {
        this.state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
        this.dayDuration = 120; // 120s per day
        this.tickInterval = 100; // 100ms background tick
        this.timeElapsedInDay = 0;

        // Reserve Fixed Coordinate Zone
        this.reserve = { x: 500, y: 500, width: 1000, height: 1000 };
        this.gridSize = 20; // Grid snapping for placement mode

        // OOP Managers & Entities
        this.chunkManager = new ChunkManager(1000, 2);
        this.player = new Player(250, 250); // Spawns outside fence in wild
        this.rangers = [];
        this.furnaces = [];
        this.renderedAnimals = [];
        this.floatingTexts = [];

        // Building Blueprint Placement Mode
        this.placementMode = {
            active: false,
            buildingDef: null,
            gridX: 0,
            gridY: 0,
            valid: false
        };

        // Active Furnace Modal Tracking
        this.activeFurnace = null;

        // Asset Preloading
        this.images = {};
        this.preloadAssets();

        // Canvas Setup
        this.canvas = document.getElementById('reserveCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        // Inputs
        this.keys = {
            w: false, a: false, s: false, d: false,
            ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
        };
        this.mouse = {
            screenX: 0,
            screenY: 0,
            worldX: 0,
            worldY: 0
        };

        this.lastFrameTime = performance.now();

        this.init();
    }

    preloadAssets() {
        const assetFiles = [
            'ranger1.png', 'ranger2.png',
            'tree.png', 'rock.png',
            'elephant.png', 'impala.png', 'lion.png', 'rhino.png', 'zebra.png'
        ];
        assetFiles.forEach(file => {
            const img = new Image();
            img.src = file;
            this.images[file] = img;
        });
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.setupUIControls();
        this.setupInputListeners();
        this.initVisualAnimals();
        this.syncRangersWithInfrastructure();
        this.updateUI();

        this.startBackgroundLoop();
        this.startRenderLoop();
    }

    resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupInputListeners() {
        window.addEventListener('keydown', (e) => {
            const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (k in this.keys) {
                this.keys[k] = true;
            }
            if (e.key === 'Escape') {
                this.cancelPlacement();
                this.closeFurnaceModal();
            }
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (k in this.keys) {
                this.keys[k] = false;
            }
        });

        if (this.canvas) {
            this.canvas.addEventListener('mousemove', (e) => {
                this.mouse.screenX = e.clientX;
                this.mouse.screenY = e.clientY;

                // Calculate world coords relative to player camera
                const camX = this.player.x - this.canvas.width / 2;
                const camY = this.player.y - this.canvas.height / 2;
                this.mouse.worldX = camX + this.mouse.screenX;
                this.mouse.worldY = camY + this.mouse.screenY;

                this.updatePlacementCursor();
            });

            this.canvas.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // Left click
                    if (this.placementMode.active) {
                        this.tryPlaceBuilding();
                    } else {
                        this.handleWorldClick();
                    }
                }
            });
        }
    }

    setupUIControls() {
        // Dock buttons click to open drawer panel
        const dockBtns = document.querySelectorAll('.dock-btn');
        const floatingPanel = document.getElementById('floating-panel-container');
        const panelTitle = document.getElementById('panel-title');
        const closePanelBtn = document.getElementById('close-panel-btn');

        dockBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPanelId = btn.getAttribute('data-panel');

                // Toggle active state on dock buttons
                dockBtns.forEach(b => b.classList.remove('active'));

                if (floatingPanel.classList.contains('hidden') || panelTitle.getAttribute('data-active') !== targetPanelId) {
                    btn.classList.add('active');
                    floatingPanel.classList.remove('hidden');

                    // Hide all panel sections
                    document.querySelectorAll('.panel-section').forEach(sec => sec.classList.add('hidden'));

                    // Show target section
                    const targetSec = document.getElementById(targetPanelId);
                    if (targetSec) targetSec.classList.remove('hidden');

                    const titleMap = {
                        'panel-animals': '🦁 Animal Market',
                        'panel-rangers': '🤠 Ranger Staff',
                        'panel-crafting': '🔨 Crafting & Building',
                        'panel-upgrades': '🏗️ Reserve Upgrades'
                    };
                    panelTitle.textContent = titleMap[targetPanelId] || 'Management Panel';
                    panelTitle.setAttribute('data-active', targetPanelId);
                } else {
                    floatingPanel.classList.add('hidden');
                    panelTitle.removeAttribute('data-active');
                }
            });
        });

        if (closePanelBtn) {
            closePanelBtn.addEventListener('click', () => {
                floatingPanel.classList.add('hidden');
                dockBtns.forEach(b => b.classList.remove('active'));
            });
        }

        // Furnace Modal controls
        const closeFurnaceBtn = document.getElementById('close-furnace-btn');
        if (closeFurnaceBtn) {
            closeFurnaceBtn.addEventListener('click', () => this.closeFurnaceModal());
        }

        const addFuelBtn = document.getElementById('add-fuel-btn');
        if (addFuelBtn) {
            addFuelBtn.addEventListener('click', () => {
                if (this.activeFurnace && this.state.wood >= 5) {
                    const added = this.activeFurnace.addFuel(5);
                    this.state.wood -= added;
                    this.updateUI();
                    this.updateFurnaceModalUI();
                }
            });
        }

        const addMatBtn = document.getElementById('add-material-btn');
        if (addMatBtn) {
            addMatBtn.addEventListener('click', () => {
                if (this.activeFurnace && this.state.stone >= 5) {
                    const added = this.activeFurnace.addMaterial(5);
                    this.state.stone -= added;
                    this.updateUI();
                    this.updateFurnaceModalUI();
                }
            });
        }

        const collectBtn = document.getElementById('collect-output-btn');
        if (collectBtn) {
            collectBtn.addEventListener('click', () => {
                if (this.activeFurnace) {
                    const collected = this.activeFurnace.collectOutput();
                    this.state.processedStone += collected;
                    if (collected > 0) {
                        this.showNotification(`Collected +${collected} Processed Stone!`);
                    }
                    this.updateUI();
                    this.updateFurnaceModalUI();
                }
            });
        }
    }

    showNotification(msg) {
        const banner = document.getElementById('status-banner');
        if (!banner) return;
        banner.textContent = msg;
        banner.classList.remove('hidden');
        clearTimeout(this.notifTimeout);
        this.notifTimeout = setTimeout(() => {
            banner.classList.add('hidden');
        }, 3000);
    }

    // World Interaction: Harvesting & Furnace Click
    handleWorldClick() {
        const mx = this.mouse.worldX;
        const my = this.mouse.worldY;

        // 1. Check Furnace Click
        for (const furnace of this.furnaces) {
            const halfW = furnace.width / 2;
            const halfH = furnace.height / 2;
            if (mx >= furnace.x - halfW && mx <= furnace.x + halfW &&
                my >= furnace.y - halfH && my <= furnace.y + halfH) {
                const dist = Math.hypot(this.player.x - furnace.x, this.player.y - furnace.y);
                if (dist <= 150) {
                    this.openFurnaceModal(furnace);
                    return;
                } else {
                    this.showNotification('Move closer to the Furnace to use it!');
                    return;
                }
            }
        }

        // 2. Check Resource Node Click (5-Hit HP System)
        const reach = 80; // Reach distance from player
        const allNodes = this.chunkManager.getAllResourceNodes();

        let targetNode = null;
        let minDist = reach;

        for (const node of allNodes) {
            const distToClick = Math.hypot(mx - node.x, my - node.y);
            const distToPlayer = Math.hypot(this.player.x - node.x, this.player.y - node.y);

            if (distToClick <= node.radius + 15 && distToPlayer <= reach) {
                if (distToClick < minDist) {
                    minDist = distToClick;
                    targetNode = node;
                }
            }
        }

        if (targetNode) {
            const result = targetNode.hit(1);
            this.player.triggerScreenShake(5, 0.12);

            if (result.destroyed) {
                this.chunkManager.removeResourceNode(targetNode.id);
                if (result.type === 'tree') {
                    this.state.wood += result.yieldAmount;
                    this.addFloatingText(`+${result.yieldAmount} Wood`, targetNode.x, targetNode.y - 10, '#2ecc71');
                } else {
                    this.state.stone += result.yieldAmount;
                    this.addFloatingText(`+${result.yieldAmount} Stone`, targetNode.x, targetNode.y - 10, '#bdc3c7');
                }
                this.updateUI();
            } else {
                this.addFloatingText(`Hit! (${result.hp}/5)`, targetNode.x, targetNode.y - 10, '#e74c3c');
            }
        }
    }

    // Furnace Modal
    openFurnaceModal(furnace) {
        this.activeFurnace = furnace;
        const modal = document.getElementById('furnace-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateFurnaceModalUI();
        }
    }

    closeFurnaceModal() {
        this.activeFurnace = null;
        const modal = document.getElementById('furnace-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    updateFurnaceModalUI() {
        if (!this.activeFurnace) return;

        const statusText = document.getElementById('furnace-status-text');
        const fillBar = document.getElementById('furnace-progress-fill');
        const fuelCount = document.getElementById('furnace-fuel-count');
        const matCount = document.getElementById('furnace-material-count');
        const outputCount = document.getElementById('furnace-output-count');

        if (statusText) statusText.textContent = this.activeFurnace.isSmelting ? '🔥 Smelting...' : 'Idle';
        if (fillBar) {
            const pct = (this.activeFurnace.smeltTimer / this.activeFurnace.smeltDuration) * 100;
            fillBar.style.width = `${pct}%`;
        }
        if (fuelCount) fuelCount.textContent = `${this.activeFurnace.fuelWood} / ${this.activeFurnace.maxFuel} Wood`;
        if (matCount) matCount.textContent = `${this.activeFurnace.rawStone} / ${this.activeFurnace.maxMaterial} Stone`;
        if (outputCount) outputCount.textContent = `${this.activeFurnace.processedStone} Processed Stone`;
    }

    // Building Blueprint Placement System
    startPlacementMode(buildingDef) {
        this.placementMode = {
            active: true,
            buildingDef: buildingDef,
            gridX: 0,
            gridY: 0,
            valid: false
        };
        this.showNotification(`Placing ${buildingDef.name}. Click inside Reserve to build, ESC to cancel.`);
    }

    cancelPlacement() {
        if (this.placementMode.active) {
            this.placementMode.active = false;
            this.placementMode.buildingDef = null;
            this.showNotification('Placement cancelled.');
        }
    }

    updatePlacementCursor() {
        if (!this.placementMode.active || !this.placementMode.buildingDef) return;

        const bDef = this.placementMode.buildingDef;
        // Snap world mouse to grid
        const gx = Math.floor(this.mouse.worldX / this.gridSize) * this.gridSize + bDef.width / 2;
        const gy = Math.floor(this.mouse.worldY / this.gridSize) * this.gridSize + bDef.height / 2;

        this.placementMode.gridX = gx;
        this.placementMode.gridY = gy;

        // Restriction check: ONLY allowed strictly inside defined Reserve coordinates
        const halfW = bDef.width / 2;
        const halfH = bDef.height / 2;

        const insideReserve = (
            gx - halfW >= this.reserve.x &&
            gx + halfW <= this.reserve.x + this.reserve.width &&
            gy - halfH >= this.reserve.y &&
            gy + halfH <= this.reserve.y + this.reserve.height
        );

        // Check non-overlapping with existing buildings
        let overlap = false;
        for (const b of this.state.placedBuildings) {
            if (Math.abs(b.x - gx) < (b.width + bDef.width) / 2 &&
                Math.abs(b.y - gy) < (b.height + bDef.height) / 2) {
                overlap = true;
                break;
            }
        }

        this.placementMode.valid = insideReserve && !overlap;
    }

    tryPlaceBuilding() {
        if (!this.placementMode.active || !this.placementMode.valid) {
            this.showNotification('Invalid placement! Must be inside Reserve bounds.');
            return;
        }

        const bDef = this.placementMode.buildingDef;

        // Deduct resource cost
        if (this.state.wood >= bDef.woodCost &&
            this.state.stone >= bDef.stoneCost &&
            this.state.processedStone >= (bDef.processedStoneCost || 0)) {

            this.state.wood -= bDef.woodCost;
            this.state.stone -= bDef.stoneCost;
            this.state.processedStone -= (bDef.processedStoneCost || 0);

            const buildingObj = {
                id: `${bDef.id}_${Date.now()}`,
                type: bDef.id,
                name: bDef.name,
                x: this.placementMode.gridX,
                y: this.placementMode.gridY,
                width: bDef.width,
                height: bDef.height
            };

            this.state.placedBuildings.push(buildingObj);

            if (bDef.id === 'furnace') {
                this.furnaces.push(new Furnace(buildingObj.id, buildingObj.x, buildingObj.y, bDef.width, bDef.height));
            } else if (bDef.id === 'ranger_hut') {
                this.syncRangersWithInfrastructure();
            }

            this.showNotification(`${bDef.name} constructed!`);
            this.placementMode.active = false;
            this.placementMode.buildingDef = null;
            this.updateUI();
        } else {
            this.showNotification('Insufficient resources to build!');
        }
    }

    // Ranger Spawning & Infrastructure Dependency
    syncRangersWithInfrastructure() {
        // Find placed Ranger Huts
        const rangerHuts = this.state.placedBuildings.filter(b => b.type === 'ranger_hut');

        if (rangerHuts.length === 0) {
            // No Ranger Hut exists yet: Hired Rangers DO NOT spawn in canvas world
            this.rangers = [];
            return;
        }

        // Hired Rangers spawn into canvas world tied to the Ranger Hut locations
        this.rangers = [];
        this.state.hiredRangers.forEach((hired, idx) => {
            const rangerDef = RANGERS_DATA.find(r => r.id === hired.id);
            if (rangerDef) {
                // Distribute rangers across available huts
                const targetHut = rangerHuts[idx % rangerHuts.length];
                this.rangers.push(new Ranger(
                    hired.id,
                    rangerDef.name,
                    targetHut.x,
                    targetHut.y,
                    rangerDef.image
                ));
            }
        });
    }

    // Floating Text Helpers
    addFloatingText(text, x, y, color = '#ffffff') {
        this.floatingTexts.push({
            text: text,
            x: x,
            y: y,
            color: color,
            alpha: 1.0,
            life: 1.0
        });
    }

    updateFloatingTexts(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.life -= dt;
            ft.y -= 25 * dt;
            ft.alpha = Math.max(0, ft.life);
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    // Animal Reserve Bounds Collision & Traversal
    initVisualAnimals() {
        this.renderedAnimals = [];
        this.state.ownedAnimals.forEach(item => {
            const animalDef = ANIMALS_DATA.find(a => a.id === item.id);
            if (animalDef) {
                for (let i = 0; i < item.count; i++) {
                    this.addVisualAnimal(animalDef);
                }
            }
        });
    }

    addVisualAnimal(animalDef) {
        const margin = 50;
        const minX = this.reserve.x + margin;
        const maxX = this.reserve.x + this.reserve.width - margin;
        const minY = this.reserve.y + margin;
        const maxY = this.reserve.y + this.reserve.height - margin;

        const startX = minX + Math.random() * (maxX - minX);
        const startY = minY + Math.random() * (maxY - minY);

        this.renderedAnimals.push({
            id: animalDef.id,
            icon: animalDef.icon,
            image: animalDef.image,
            x: startX,
            y: startY,
            targetX: minX + Math.random() * (maxX - minX),
            targetY: minY + Math.random() * (maxY - minY),
            speed: 20 + Math.random() * 25,
            bobTimer: Math.random() * 10,
            bobY: 0,
            wobbleAngle: 0,
            facingLeft: false,
            isMoving: true
        });
    }

    updateMapAnimals(dt) {
        // Animals are STRICTLY bounded by collision to stay INSIDE the reserve fences
        const margin = 40;
        const minX = this.reserve.x + margin;
        const maxX = this.reserve.x + this.reserve.width - margin;
        const minY = this.reserve.y + margin;
        const maxY = this.reserve.y + this.reserve.height - margin;

        this.renderedAnimals.forEach(animal => {
            const dx = animal.targetX - animal.x;
            const dy = animal.targetY - animal.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 10) {
                animal.targetX = minX + Math.random() * (maxX - minX);
                animal.targetY = minY + Math.random() * (maxY - minY);
                animal.isMoving = false;
            } else {
                animal.isMoving = true;
                if (dx < 0) animal.facingLeft = true;
                else if (dx > 0) animal.facingLeft = false;

                animal.x += (dx / dist) * animal.speed * dt;
                animal.y += (dy / dist) * animal.speed * dt;

                // Strict bounding clamp inside reserve
                animal.x = Math.max(minX, Math.min(animal.x, maxX));
                animal.y = Math.max(minY, Math.min(animal.y, maxY));
            }

            if (animal.isMoving) {
                animal.bobTimer += dt * 8;
                animal.bobY = Math.sin(animal.bobTimer) * 3;
                animal.wobbleAngle = Math.sin(animal.bobTimer * 0.5) * (5 * Math.PI / 180);
            } else {
                animal.bobY += (0 - animal.bobY) * Math.min(1, dt * 10);
                animal.wobbleAngle += (0 - animal.wobbleAngle) * Math.min(1, dt * 10);
            }
        });
    }

    // Calculations & Economy
    getTotalCapacity() {
        const campConfig = CAMP_TIERS_DATA.find(c => c.tier === this.state.campTier) || CAMP_TIERS_DATA[0];
        let total = campConfig.baseCapacity;

        this.state.hiredRangers.forEach(hired => {
            const rangerDef = RANGERS_DATA.find(r => r.id === hired.id);
            if (rangerDef) {
                total += rangerDef.capacityBonus;
            }
        });
        return total;
    }

    getCurrentAnimalCount() {
        return this.state.ownedAnimals.reduce((sum, item) => sum + item.count, 0);
    }

    getDailyAttractionIncome() {
        let totalIncome = 0;
        this.state.ownedAnimals.forEach(item => {
            const animalDef = ANIMALS_DATA.find(a => a.id === item.id);
            if (animalDef) {
                totalIncome += (animalDef.attractionScore * 2 - animalDef.upkeep) * item.count;
            }
        });
        return Math.max(0, totalIncome);
    }

    getDailyRangerWages() {
        let totalWages = 0;
        this.state.hiredRangers.forEach(hired => {
            const rangerDef = RANGERS_DATA.find(r => r.id === hired.id);
            if (rangerDef) {
                totalWages += rangerDef.dailyWage;
            }
        });
        return totalWages;
    }

    getNetDailyIncome() {
        return this.getDailyAttractionIncome() - this.getDailyRangerWages();
    }

    // Loops
    startBackgroundLoop() {
        setInterval(() => {
            const deltaSec = this.tickInterval / 1000;
            this.timeElapsedInDay += deltaSec;
            this.state.dayProgress = (this.timeElapsedInDay / this.dayDuration) * 100;

            if (this.timeElapsedInDay >= this.dayDuration) {
                this.timeElapsedInDay = 0;
                this.processNewDay();
            }

            // Update Furnace Background Smelting
            this.furnaces.forEach(f => f.update(deltaSec));
            if (this.activeFurnace) {
                this.updateFurnaceModalUI();
            }

            this.updateProgressBar();
            this.updateMapAnimals(deltaSec);
        }, this.tickInterval);
    }

    startRenderLoop() {
        const frame = (timestamp) => {
            const dt = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000);
            this.lastFrameTime = timestamp;

            const resourceNodes = this.chunkManager.getAllResourceNodes();
            this.player.update(dt, this.keys, resourceNodes, this.state.placedBuildings);
            this.chunkManager.update(this.player.x, this.player.y, this.reserve, dt);

            this.rangers.forEach(r => r.update(dt));
            this.updateFloatingTexts(dt);

            this.render();

            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    processNewDay() {
        this.state.day += 1;
        const netIncome = this.getNetDailyIncome();
        this.state.funds += netIncome;
        this.showNotification(`Day ${this.state.day} started! Daily net income: ${netIncome >= 0 ? '+' : ''}$${netIncome}`);
        this.updateUI();
    }

    // UI Updates
    updateProgressBar() {
        const progressBar = document.getElementById('day-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, this.state.dayProgress))}%`;
        }
    }

    updateUI() {
        const elFunds = document.getElementById('stat-funds');
        if (elFunds) elFunds.textContent = `$${this.state.funds.toLocaleString()}`;

        const elDay = document.getElementById('stat-day');
        if (elDay) elDay.textContent = this.state.day;

        const netInc = this.getNetDailyIncome();
        const elNetInc = document.getElementById('stat-net-income');
        if (elNetInc) {
            elNetInc.textContent = `${netInc >= 0 ? '+' : ''}$${netInc.toLocaleString()}/d`;
            elNetInc.className = `stat-value ${netInc >= 0 ? 'positive' : 'negative'}`;
        }

        const elCap = document.getElementById('stat-capacity');
        if (elCap) elCap.textContent = `${this.getCurrentAnimalCount()} / ${this.getTotalCapacity()}`;

        const elWood = document.getElementById('stat-wood');
        if (elWood) elWood.textContent = this.state.wood;

        const elStone = document.getElementById('stat-stone');
        if (elStone) elStone.textContent = this.state.stone;

        const elPStone = document.getElementById('stat-pstone');
        if (elPStone) elPStone.textContent = this.state.processedStone;

        this.renderAnimalMarket();
        this.renderRangerHiring();
        this.renderCraftingMenu();
        this.renderUpgrades();
    }

    renderAnimalMarket() {
        const grid = document.getElementById('animal-market-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const currentFence = FENCE_TIERS_DATA.find(f => f.tier === this.state.fenceTier) || FENCE_TIERS_DATA[0];

        ANIMALS_DATA.forEach(animal => {
            const owned = this.state.ownedAnimals.find(a => a.id === animal.id);
            const count = owned ? owned.count : 0;

            const canAfford = this.state.funds >= animal.cost;
            const hasCapacity = this.getCurrentAnimalCount() < this.getTotalCapacity();
            const meetFenceReq = currentFence.maxAnimalTier >= animal.enclosureTierReq;

            const card = document.createElement('div');
            card.className = 'item-card';

            let disableReason = '';
            if (!canAfford) disableReason = 'Insufficient Funds';
            else if (!hasCapacity) disableReason = 'Max Capacity Reached';
            else if (!meetFenceReq) disableReason = `Requires Tier ${animal.enclosureTierReq} Fence`;

            const iconHTML = animal.image
                ? `<img src="${animal.image}" alt="${animal.name}" class="card-thumb-img">`
                : animal.icon;

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">${iconHTML}</div>
                    <div class="card-title-group">
                        <h3>${animal.name}</h3>
                        <span class="card-sub">Owned: ${count}</span>
                    </div>
                </div>
                <p class="card-body">${animal.description}</p>
                <div class="card-stats">
                    <span class="badge">Cost: $${animal.cost}</span>
                    <span class="badge badge-good">+${animal.attractionScore} Attr</span>
                    <span class="badge">Req T${animal.enclosureTierReq} Fence</span>
                </div>
                <button class="action-btn" ${(!canAfford || !hasCapacity || !meetFenceReq) ? 'disabled' : ''}>
                    ${disableReason ? disableReason : `Buy ($${animal.cost})`}
                </button>
            `;

            const btn = card.querySelector('.action-btn');
            if (btn && !disableReason) {
                btn.addEventListener('click', () => this.buyAnimal(animal));
            }

            grid.appendChild(card);
        });
    }

    buyAnimal(animal) {
        if (this.state.funds >= animal.cost && this.getCurrentAnimalCount() < this.getTotalCapacity()) {
            this.state.funds -= animal.cost;
            const owned = this.state.ownedAnimals.find(a => a.id === animal.id);
            if (owned) {
                owned.count += 1;
            } else {
                this.state.ownedAnimals.push({ id: animal.id, count: 1 });
            }
            this.addVisualAnimal(animal);
            this.updateUI();
        }
    }

    renderRangerHiring() {
        const grid = document.getElementById('ranger-hiring-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const hasRangerHut = this.state.placedBuildings.some(b => b.type === 'ranger_hut');

        RANGERS_DATA.forEach(ranger => {
            const isHired = this.state.hiredRangers.some(r => r.id === ranger.id);

            const card = document.createElement('div');
            card.className = 'item-card';

            const traitsHTML = ranger.traits.map(t =>
                `<span class="badge ${t.type === 'good' ? 'badge-good' : 'badge-bad'}">${t.name}</span>`
            ).join(' ');

            const iconHTML = ranger.image
                ? `<img src="${ranger.image}" alt="${ranger.name}" class="card-thumb-img">`
                : '🤠';

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">${iconHTML}</div>
                    <div class="card-title-group">
                        <h3>${ranger.name}</h3>
                        <span class="card-sub">${isHired ? 'Hired' : 'Available'}</span>
                    </div>
                </div>
                <div class="card-stats">
                    <span class="badge">Wage: $${ranger.dailyWage}/d</span>
                    <span class="badge badge-good">+${ranger.capacityBonus} Cap</span>
                </div>
                <div>${traitsHTML}</div>
                ${!hasRangerHut ? '<div style="font-size:0.75rem; color:var(--accent-gold); margin-top:4px;">⚠️ Requires Ranger Hut to spawn</div>' : ''}
                <button class="action-btn" ${isHired ? 'disabled' : ''}>
                    ${isHired ? 'Active Staff' : `Hire ($${ranger.dailyWage}/d)`}
                </button>
            `;

            const btn = card.querySelector('.action-btn');
            if (btn && !isHired) {
                btn.addEventListener('click', () => this.hireRanger(ranger));
            }

            grid.appendChild(card);
        });
    }

    hireRanger(ranger) {
        if (!this.state.hiredRangers.some(r => r.id === ranger.id)) {
            this.state.hiredRangers.push({ id: ranger.id });
            this.syncRangersWithInfrastructure();
            this.updateUI();
        }
    }

    renderCraftingMenu() {
        const grid = document.getElementById('crafting-grid');
        if (!grid) return;
        grid.innerHTML = '';

        BUILDINGS_DATA.forEach(bDef => {
            const canAfford = this.state.wood >= bDef.woodCost &&
                              this.state.stone >= bDef.stoneCost &&
                              this.state.processedStone >= (bDef.processedStoneCost || 0);

            const card = document.createElement('div');
            card.className = 'item-card';

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">${bDef.icon}</div>
                    <div class="card-title-group">
                        <h3>${bDef.name}</h3>
                        <span class="card-sub">Structure</span>
                    </div>
                </div>
                <p class="card-body">${bDef.description}</p>
                <div class="card-stats">
                    <span class="badge">Wood: ${bDef.woodCost}</span>
                    <span class="badge">Stone: ${bDef.stoneCost}</span>
                    ${bDef.processedStoneCost ? `<span class="badge">P-Stone: ${bDef.processedStoneCost}</span>` : ''}
                </div>
                <button class="action-btn" ${!canAfford ? 'disabled' : ''}>
                    ${!canAfford ? 'Insufficient Resources' : `Place ${bDef.name}`}
                </button>
            `;

            const btn = card.querySelector('.action-btn');
            if (btn && canAfford) {
                btn.addEventListener('click', () => this.startPlacementMode(bDef));
            }

            grid.appendChild(card);
        });
    }

    renderUpgrades() {
        const grid = document.getElementById('upgrades-grid');
        if (!grid) return;
        grid.innerHTML = '';

        // Camp Tier Card
        const nextCamp = CAMP_TIERS_DATA.find(c => c.tier === this.state.campTier + 1);
        const currentCamp = CAMP_TIERS_DATA.find(c => c.tier === this.state.campTier);

        const campCard = document.createElement('div');
        campCard.className = 'item-card';

        if (nextCamp) {
            const canAfford = this.state.funds >= nextCamp.cost &&
                              this.state.wood >= nextCamp.woodCost &&
                              this.state.stone >= (nextCamp.stoneCost || 0) &&
                              this.state.processedStone >= (nextCamp.processedStoneCost || 0);
            campCard.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">🏕️</div>
                    <div class="card-title-group">
                        <h3>Upgrade Camp: ${nextCamp.name}</h3>
                        <span class="card-sub">Current: Tier ${currentCamp.tier}</span>
                    </div>
                </div>
                <p class="card-body">${nextCamp.description}</p>
                <div class="card-stats">
                    <span class="badge">Cost: $${nextCamp.cost}</span>
                    <span class="badge">Wood: ${nextCamp.woodCost}</span>
                    <span class="badge">Stone: ${nextCamp.stoneCost || 0}</span>
                    ${nextCamp.processedStoneCost ? `<span class="badge">P-Stone: ${nextCamp.processedStoneCost}</span>` : ''}
                </div>
                <button class="action-btn" ${!canAfford ? 'disabled' : ''}>
                    ${!canAfford ? 'Insufficient Resources' : `Upgrade to ${nextCamp.name}`}
                </button>
            `;
            const btn = campCard.querySelector('.action-btn');
            if (btn && canAfford) {
                btn.addEventListener('click', () => {
                    this.state.funds -= nextCamp.cost;
                    this.state.wood -= nextCamp.woodCost;
                    this.state.stone -= (nextCamp.stoneCost || 0);
                    this.state.processedStone -= (nextCamp.processedStoneCost || 0);
                    this.state.campTier += 1;
                    this.updateUI();
                });
            }
        } else {
            campCard.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">🏛️</div>
                    <div class="card-title-group">
                        <h3>Camp Tier: ${currentCamp.name}</h3>
                        <span class="card-sub">Max Level</span>
                    </div>
                </div>
                <p class="card-body">${currentCamp.description}</p>
            `;
        }
        grid.appendChild(campCard);

        // Fence Tier Card
        const nextFence = FENCE_TIERS_DATA.find(f => f.tier === this.state.fenceTier + 1);
        const currentFence = FENCE_TIERS_DATA.find(f => f.tier === this.state.fenceTier);

        const fenceCard = document.createElement('div');
        fenceCard.className = 'item-card';

        if (nextFence) {
            const canAfford = this.state.funds >= nextFence.cost &&
                              this.state.wood >= nextFence.woodCost &&
                              this.state.stone >= (nextFence.stoneCost || 0) &&
                              this.state.processedStone >= (nextFence.processedStoneCost || 0);
            fenceCard.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">🛡️</div>
                    <div class="card-title-group">
                        <h3>Upgrade Fence: ${nextFence.name}</h3>
                        <span class="card-sub">Current: Tier ${currentFence.tier}</span>
                    </div>
                </div>
                <p class="card-body">${nextFence.description}</p>
                <div class="card-stats">
                    <span class="badge">Cost: $${nextFence.cost}</span>
                    <span class="badge">Wood: ${nextFence.woodCost}</span>
                    <span class="badge">Stone: ${nextFence.stoneCost || 0}</span>
                    ${nextFence.processedStoneCost ? `<span class="badge">P-Stone: ${nextFence.processedStoneCost}</span>` : ''}
                </div>
                <button class="action-btn" ${!canAfford ? 'disabled' : ''}>
                    ${!canAfford ? 'Insufficient Resources' : `Upgrade to ${nextFence.name}`}
                </button>
            `;
            const btn = fenceCard.querySelector('.action-btn');
            if (btn && canAfford) {
                btn.addEventListener('click', () => {
                    this.state.funds -= nextFence.cost;
                    this.state.wood -= nextFence.woodCost;
                    this.state.stone -= (nextFence.stoneCost || 0);
                    this.state.processedStone -= (nextFence.processedStoneCost || 0);
                    this.state.fenceTier += 1;
                    this.updateUI();
                });
            }
        } else {
            fenceCard.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">⚡</div>
                    <div class="card-title-group">
                        <h3>Fence Tier: ${currentFence.name}</h3>
                        <span class="card-sub">Max Level</span>
                    </div>
                </div>
                <p class="card-body">${currentFence.description}</p>
            `;
        }
        grid.appendChild(fenceCard);
    }

    // World Rendering Engine
    render() {
        if (!this.ctx || !this.canvas) return;

        const screenW = this.canvas.width;
        const screenH = this.canvas.height;

        // Clear Screen
        this.ctx.clearRect(0, 0, screenW, screenH);

        // Screen Shake Offset
        const shake = this.player.getScreenShakeOffset();

        // Camera Offset: Centered on Player
        const camX = this.player.x - screenW / 2 + shake.x;
        const camY = this.player.y - screenH / 2 + shake.y;

        this.ctx.save();
        this.ctx.translate(-camX, -camY);

        // Viewport bounds in world coordinates for frustum culling
        const viewBounds = {
            minX: camX - 100,
            maxX: camX + screenW + 100,
            minY: camY - 100,
            maxY: camY + screenH + 100
        };

        // 1. World Background (Infinite Grass Terrain)
        this.ctx.fillStyle = '#1c2818';
        this.ctx.fillRect(camX - 200, camY - 200, screenW + 400, screenH + 400);

        // Subtle Grid Overlay
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        this.ctx.lineWidth = 1;
        const startX = Math.floor(viewBounds.minX / 100) * 100;
        const startY = Math.floor(viewBounds.minY / 100) * 100;
        for (let x = startX; x <= viewBounds.maxX; x += 100) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, viewBounds.minY);
            this.ctx.lineTo(x, viewBounds.maxY);
            this.ctx.stroke();
        }
        for (let y = startY; y <= viewBounds.maxY; y += 100) {
            this.ctx.beginPath();
            this.ctx.moveTo(viewBounds.minX, y);
            this.ctx.lineTo(viewBounds.maxX, y);
            this.ctx.stroke();
        }

        // 2. Reserve Enclosure Area (Central Fixed Coordinate Zone)
        this.ctx.fillStyle = '#26381e';
        this.ctx.fillRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);

        // Reserve Waterhole
        const whX = this.reserve.x + 500;
        const whY = this.reserve.y + 500;
        this.ctx.fillStyle = '#1f4866';
        this.ctx.beginPath();
        this.ctx.ellipse(whX, whY, 140, 80, Math.PI / 6, 0, Math.PI * 2);
        ctxFillSafely(this.ctx);

        this.ctx.fillStyle = '#295b80';
        this.ctx.beginPath();
        this.ctx.ellipse(whX - 10, whY - 5, 110, 60, Math.PI / 6, 0, Math.PI * 2);
        ctxFillSafely(this.ctx);

        // Central Camp HQ
        const campX = this.reserve.x + 100;
        const campY = this.reserve.y + 100;
        this.ctx.fillStyle = '#5c4028';
        this.ctx.fillRect(campX, campY, 100, 70);
        this.ctx.strokeStyle = '#3a2717';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(campX, campY, 100, 70);

        this.ctx.fillStyle = '#f39c12';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`RESERVE HQ T${this.state.campTier}`, campX + 50, campY + 35);

        // Reserve Perimeter Fences
        const fenceColor = this.state.fenceTier === 3 ? '#3498db' : (this.state.fenceTier === 2 ? '#bdc3c7' : '#8e44ad');
        this.ctx.strokeStyle = fenceColor;
        this.ctx.lineWidth = 6;
        this.ctx.strokeRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);

        if (this.state.fenceTier === 3) {
            const pulse = 4 + Math.sin(performance.now() / 200) * 4;
            this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
            this.ctx.lineWidth = 6 + pulse;
            this.ctx.strokeRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);
        }

        // Fence Corner Posts
        this.ctx.fillStyle = '#f39c12';
        const corners = [
            [this.reserve.x, this.reserve.y],
            [this.reserve.x + this.reserve.width, this.reserve.y],
            [this.reserve.x, this.reserve.y + this.reserve.height],
            [this.reserve.x + this.reserve.width, this.reserve.y + this.reserve.height]
        ];
        corners.forEach(([cx, cy]) => {
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // 3. Render Infinite Procedural Chunks (Trees / Rocks)
        this.chunkManager.render(this.ctx, this.images, viewBounds);

        // 4. Render Placed Buildings & Furnaces
        this.state.placedBuildings.forEach(b => {
            if (b.type === 'furnace') {
                const furnaceObj = this.furnaces.find(f => f.id === b.id);
                if (furnaceObj) {
                    furnaceObj.render(this.ctx);
                }
            } else if (b.type === 'ranger_hut') {
                this.ctx.save();
                this.ctx.translate(b.x, b.y);

                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                this.ctx.fillRect(-b.width / 2 + 4, -b.height / 2 + 4, b.width, b.height);

                this.ctx.fillStyle = '#6e4f34';
                this.ctx.fillRect(-b.width / 2, -b.height / 2, b.width, b.height);
                this.ctx.strokeStyle = '#3d2b1c';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(-b.width / 2, -b.height / 2, b.width, b.height);

                this.ctx.fillStyle = '#2ecc71';
                this.ctx.font = 'bold 12px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('RANGER HUT', 0, 0);

                this.ctx.restore();
            }
        });

        // 5. Render Blueprint Cursor in Placement Mode
        if (this.placementMode.active && this.placementMode.buildingDef) {
            const bDef = this.placementMode.buildingDef;
            const gx = this.placementMode.gridX;
            const gy = this.placementMode.gridY;

            this.ctx.save();
            this.ctx.translate(gx, gy);

            this.ctx.fillStyle = this.placementMode.valid ? 'rgba(46, 204, 113, 0.4)' : 'rgba(231, 76, 60, 0.4)';
            this.ctx.fillRect(-bDef.width / 2, -bDef.height / 2, bDef.width, bDef.height);

            this.ctx.strokeStyle = this.placementMode.valid ? '#2ecc71' : '#e74c3c';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(-bDef.width / 2, -bDef.height / 2, bDef.width, bDef.height);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(bDef.name, 0, 0);

            this.ctx.restore();
        }

        // 6. Render Reserve Animals
        this.renderedAnimals.forEach(animal => {
            const animalImg = this.images[animal.image];
            this.ctx.save();
            this.ctx.translate(animal.x, animal.y + (animal.bobY || 0));
            this.ctx.rotate(animal.wobbleAngle || 0);

            if (animal.facingLeft) {
                this.ctx.scale(-1, 1);
            }

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            this.ctx.beginPath();
            this.ctx.ellipse(0, 18, 16, 6, 0, 0, Math.PI * 2);
            this.ctx.fill();

            if (animalImg && animalImg.complete) {
                const size = 48;
                this.ctx.drawImage(animalImg, -size / 2, -size / 2, size, size);
            } else {
                this.ctx.font = '28px serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(animal.icon, 0, 0);
            }

            this.ctx.restore();
        });

        // 7. Render Hired Rangers (Patrolling near Ranger Huts)
        this.rangers.forEach(ranger => ranger.render(this.ctx, this.images));

        // 8. Render Player Character
        this.player.render(this.ctx, this.images);

        // 9. Render Floating Feedback Texts
        this.ctx.font = 'bold 15px sans-serif';
        this.ctx.textAlign = 'center';
        this.floatingTexts.forEach(ft => {
            this.ctx.fillStyle = ft.color;
            this.ctx.globalAlpha = ft.alpha;
            this.ctx.fillText(ft.text, ft.x, ft.y);
            this.ctx.globalAlpha = 1.0;
        });

        this.ctx.restore();
    }
}

// Helper canvas fill method
function ctxFillSafely(ctx) {
    ctx.fill();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ReserveGame();
});

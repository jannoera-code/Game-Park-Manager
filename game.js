/**
 * Core Game Logic & State Management
 * African Wildlife Reserve Management Game
 */

class ReserveGame {
    constructor() {
        this.state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
        this.dayDuration = 120; // 120 seconds per day
        this.tickInterval = 100; // update every 100ms
        this.timeElapsedInDay = 0; // in seconds

        // Canvas & visual state
        this.canvas = document.getElementById('reserveCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        // World & Camera Config
        this.world = { width: 2000, height: 2000 };
        this.reserve = { x: 500, y: 500, width: 1000, height: 1000 };

        // Player object (spawns outside fence in the Wild)
        this.player = {
            x: 250,
            y: 250,
            radius: 16,
            speed: 220, // px / sec
            angle: 0,
            isGathering: false,
            gatherTimer: 0,
            gatherDuration: 0.4, // seconds
            currentTarget: null
        };

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

        // Environment Objects in the Wild
        this.trees = [];
        this.rocks = [];
        this.renderedAnimals = [];
        this.floatingTexts = [];

        // Animation loop tracking
        this.lastFrameTime = performance.now();

        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.setupTabListeners();
        this.setupControls();
        this.generateWildResources();
        this.initVisualAnimals();
        this.updateUI();
        this.startLoop();
        this.startRenderLoop();
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width || 800;
        this.canvas.height = rect.height || 450;
    }

    // Input & Movement setup
    setupControls() {
        window.addEventListener('keydown', (e) => {
            const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (k in this.keys) {
                this.keys[k] = true;
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
                const rect = this.canvas.getBoundingClientRect();
                this.mouse.screenX = e.clientX - rect.left;
                this.mouse.screenY = e.clientY - rect.top;
            });

            this.canvas.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // Left click
                    this.tryGatherResource();
                }
            });
        }
    }

    tryGatherResource() {
        if (this.player.isGathering) return;

        const reach = 70; // Gathering reach distance
        let closestObj = null;
        let closestDist = reach;
        let objType = null;

        // Check trees
        for (const tree of this.trees) {
            const dist = Math.hypot(this.player.x - tree.x, this.player.y - tree.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestObj = tree;
                objType = 'tree';
            }
        }

        // Check rocks
        for (const rock of this.rocks) {
            const dist = Math.hypot(this.player.x - rock.x, this.player.y - rock.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestObj = rock;
                objType = 'rock';
            }
        }

        if (closestObj) {
            this.player.isGathering = true;
            this.player.gatherTimer = 0;
            this.player.currentTarget = { obj: closestObj, type: objType };
        }
    }

    updateGathering(dt) {
        if (!this.player.isGathering || !this.player.currentTarget) return;

        this.player.gatherTimer += dt;
        if (this.player.gatherTimer >= this.player.gatherDuration) {
            const target = this.player.currentTarget;
            if (target.type === 'tree') {
                const index = this.trees.findIndex(t => t.id === target.obj.id);
                if (index !== -1) {
                    this.trees.splice(index, 1);
                    this.state.wood += target.obj.yield;
                    this.addFloatingText(`+${target.obj.yield} Wood`, target.obj.x, target.obj.y - 10, '#2ecc71');
                    // Respawn tree in 12s
                    setTimeout(() => this.respawnSingleResource('tree'), 12000);
                }
            } else if (target.type === 'rock') {
                const index = this.rocks.findIndex(r => r.id === target.obj.id);
                if (index !== -1) {
                    this.rocks.splice(index, 1);
                    this.state.stone += target.obj.yield;
                    this.addFloatingText(`+${target.obj.yield} Stone`, target.obj.x, target.obj.y - 10, '#bdc3c7');
                    // Respawn rock in 12s
                    setTimeout(() => this.respawnSingleResource('rock'), 12000);
                }
            }

            this.player.isGathering = false;
            this.player.currentTarget = null;
            this.updateUI();
        }
    }

    respawnSingleResource(type) {
        const isOutsideReserve = (x, y, margin = 40) => {
            return (
                x < this.reserve.x - margin ||
                x > this.reserve.x + this.reserve.width + margin ||
                y < this.reserve.y - margin ||
                y > this.reserve.y + this.reserve.height + margin
            );
        };

        let attempts = 0;
        while (attempts < 100) {
            attempts++;
            const x = 50 + Math.random() * (this.world.width - 100);
            const y = 50 + Math.random() * (this.world.height - 100);

            if (isOutsideReserve(x, y, 40)) {
                if (type === 'tree') {
                    this.trees.push({
                        id: 'tree_' + Math.random(),
                        x: x,
                        y: y,
                        radius: 20,
                        yield: 5
                    });
                    break;
                } else if (type === 'rock') {
                    this.rocks.push({
                        id: 'rock_' + Math.random(),
                        x: x,
                        y: y,
                        radius: 18,
                        yield: 3
                    });
                    break;
                }
            }
        }
    }

    addFloatingText(text, x, y, color = '#ffffff') {
        this.floatingTexts.push({
            text: text,
            x: x,
            y: y,
            color: color,
            alpha: 1.0,
            life: 1.0 // 1 second
        });
    }

    updateFloatingTexts(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.life -= dt;
            ft.y -= 25 * dt; // float upward
            ft.alpha = Math.max(0, ft.life);
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    checkCollision(px, py) {
        const r = this.player.radius;

        // World bounds
        if (px - r < 0 || px + r > this.world.width || py - r < 0 || py + r > this.world.height) {
            return true;
        }

        // Reserve fence rectangle collision
        const rx1 = this.reserve.x;
        const ry1 = this.reserve.y;
        const rx2 = this.reserve.x + this.reserve.width;
        const ry2 = this.reserve.y + this.reserve.height;

        const closestX = Math.max(rx1, Math.min(px, rx2));
        const closestY = Math.max(ry1, Math.min(py, ry2));
        const distX = px - closestX;
        const distY = py - closestY;
        if ((distX * distX + distY * distY) < r * r) {
            return true;
        }

        // Trees collision
        for (const tree of this.trees) {
            const d = Math.hypot(px - tree.x, py - tree.y);
            if (d < r + tree.radius) return true;
        }

        // Rocks collision
        for (const rock of this.rocks) {
            const d = Math.hypot(px - rock.x, py - rock.y);
            if (d < r + rock.radius) return true;
        }

        return false;
    }

    updatePlayer(dt) {
        if (this.player.isGathering) return; // freeze movement while gathering animation plays

        let dx = 0;
        let dy = 0;

        if (this.keys.w || this.keys.ArrowUp) dy -= 1;
        if (this.keys.s || this.keys.ArrowDown) dy += 1;
        if (this.keys.a || this.keys.ArrowLeft) dx -= 1;
        if (this.keys.d || this.keys.ArrowRight) dx += 1;

        if (dx !== 0 && dy !== 0) {
            dx *= Math.SQRT1_2;
            dy *= Math.SQRT1_2;
        }

        const moveX = dx * this.player.speed * dt;
        const moveY = dy * this.player.speed * dt;

        if (moveX !== 0) {
            const newX = this.player.x + moveX;
            if (!this.checkCollision(newX, this.player.y)) {
                this.player.x = newX;
            }
        }

        if (moveY !== 0) {
            const newY = this.player.y + moveY;
            if (!this.checkCollision(this.player.x, newY)) {
                this.player.y = newY;
            }
        }

        // Calculate world mouse position based on camera offset (player centered)
        const camX = this.player.x - (this.canvas ? this.canvas.width / 2 : 400);
        const camY = this.player.y - (this.canvas ? this.canvas.height / 2 : 225);
        this.mouse.worldX = camX + this.mouse.screenX;
        this.mouse.worldY = camY + this.mouse.screenY;

        this.player.angle = Math.atan2(this.mouse.worldY - this.player.y, this.mouse.worldX - this.player.x);
    }

    generateWildResources() {
        this.trees = [];
        this.rocks = [];

        // Helper to check if point is outside reserve with margin
        const isOutsideReserve = (x, y, margin = 40) => {
            return (
                x < this.reserve.x - margin ||
                x > this.reserve.x + this.reserve.width + margin ||
                y < this.reserve.y - margin ||
                y > this.reserve.y + this.reserve.height + margin
            );
        };

        // Spawn 60 Trees in the Wild
        let attempts = 0;
        while (this.trees.length < 60 && attempts < 1000) {
            attempts++;
            const x = 50 + Math.random() * (this.world.width - 100);
            const y = 50 + Math.random() * (this.world.height - 100);

            if (isOutsideReserve(x, y, 40)) {
                this.trees.push({
                    id: 'tree_' + Math.random(),
                    x: x,
                    y: y,
                    radius: 20,
                    yield: 5
                });
            }
        }

        // Spawn 40 Rocks in the Wild
        attempts = 0;
        while (this.rocks.length < 40 && attempts < 1000) {
            attempts++;
            const x = 50 + Math.random() * (this.world.width - 100);
            const y = 50 + Math.random() * (this.world.height - 100);

            if (isOutsideReserve(x, y, 40)) {
                // Ensure not overlapping existing tree
                const overlap = this.trees.some(t => Math.hypot(t.x - x, t.y - y) < 40);
                if (!overlap) {
                    this.rocks.push({
                        id: 'rock_' + Math.random(),
                        x: x,
                        y: y,
                        radius: 18,
                        yield: 3
                    });
                }
            }
        }
    }

    // Tab switching handler
    setupTabListeners() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const targetTabId = btn.getAttribute('data-tab');
                const targetPanel = document.getElementById(targetTabId);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
            });
        });
    }

    setupActionListeners() {
        // Obsolete UI action listeners removed (Wood chopping now done in-world)
    }

    // Calculations
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
                // Each point of attraction yields $2 daily revenue
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

    // Economy & Day Cycle Loop (100ms interval)
    startLoop() {
        setInterval(() => {
            const deltaSec = this.tickInterval / 1000;
            this.timeElapsedInDay += deltaSec;

            this.state.dayProgress = (this.timeElapsedInDay / this.dayDuration) * 100;

            if (this.timeElapsedInDay >= this.dayDuration) {
                this.timeElapsedInDay = 0;
                this.processNewDay();
            }

            this.updateProgressBar();
            this.updateMapAnimals(deltaSec);
        }, this.tickInterval);
    }

    // 60FPS Game Render Loop
    startRenderLoop() {
        const frame = (timestamp) => {
            const dt = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000);
            this.lastFrameTime = timestamp;

            this.updatePlayer(dt);
            this.updateGathering(dt);
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
        // Header Stats
        const elFunds = document.getElementById('stat-funds');
        if (elFunds) elFunds.textContent = `$${this.state.funds.toLocaleString()}`;

        const elDay = document.getElementById('stat-day');
        if (elDay) elDay.textContent = this.state.day;

        const netInc = this.getNetDailyIncome();
        const elNetInc = document.getElementById('stat-net-income');
        if (elNetInc) {
            elNetInc.textContent = `${netInc >= 0 ? '+' : ''}$${netInc.toLocaleString()}/day`;
            elNetInc.className = `stat-value ${netInc >= 0 ? 'positive' : 'negative'}`;
        }

        const elCap = document.getElementById('stat-capacity');
        if (elCap) elCap.textContent = `${this.getCurrentAnimalCount()} / ${this.getTotalCapacity()}`;

        const elWood = document.getElementById('stat-wood');
        if (elWood) elWood.textContent = `${this.state.wood} Wood`;

        const elStone = document.getElementById('stat-stone');
        if (elStone) elStone.textContent = `${this.state.stone} Stone`;

        const elCamp = document.getElementById('stat-camp-tier');
        if (elCamp) elCamp.textContent = `Tier ${this.state.campTier}`;

        const elFence = document.getElementById('stat-fence-tier');
        if (elFence) elFence.textContent = `Tier ${this.state.fenceTier}`;

        // Render Tab Panels
        this.renderAnimalMarket();
        this.renderRangerHiring();
        this.renderUpgrades();
    }

    // Panel Rendering Methods
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

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">${animal.icon}</div>
                    <div class="card-title-group">
                        <h3>${animal.name}</h3>
                        <span class="card-sub">Owned: ${count}</span>
                    </div>
                </div>
                <p class="card-body">${animal.description}</p>
                <div class="card-stats">
                    <span class="badge">Cost: $${animal.cost}</span>
                    <span class="badge badge-good">+${animal.attractionScore} Attraction</span>
                    <span class="badge">Fence Req: T${animal.enclosureTierReq}</span>
                </div>
                <button class="action-btn" ${(!canAfford || !hasCapacity || !meetFenceReq) ? 'disabled' : ''} data-animal-id="${animal.id}">
                    ${disableReason ? disableReason : `Purchase ($${animal.cost})`}
                </button>
            `;

            const btn = card.querySelector('.action-btn');
            if (btn && (!disableReason)) {
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

        RANGERS_DATA.forEach(ranger => {
            const isHired = this.state.hiredRangers.some(r => r.id === ranger.id);

            const card = document.createElement('div');
            card.className = 'item-card';

            const traitsHTML = ranger.traits.map(t =>
                `<span class="badge ${t.type === 'good' ? 'badge-good' : 'badge-bad'}">${t.name}</span>`
            ).join(' ');

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">🤠</div>
                    <div class="card-title-group">
                        <h3>${ranger.name}</h3>
                        <span class="card-sub">${isHired ? 'Currently Hired' : 'Available for Hire'}</span>
                    </div>
                </div>
                <div class="card-stats" style="margin-top: 5px;">
                    <span class="badge">Wage: $${ranger.dailyWage}/day</span>
                    <span class="badge badge-good">+${ranger.capacityBonus} Cap Bonus</span>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">TRAITS</div>
                    ${traitsHTML}
                </div>
                <button class="action-btn" ${isHired ? 'disabled' : ''}>
                    ${isHired ? 'Active Staff' : `Hire Ranger ($${ranger.dailyWage}/day)`}
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
            this.updateUI();
        }
    }

    renderUpgrades() {
        const grid = document.getElementById('upgrades-grid');
        if (!grid) return;

        grid.innerHTML = '';

        // Camp Tier Upgrade Card
        const nextCamp = CAMP_TIERS_DATA.find(c => c.tier === this.state.campTier + 1);
        const currentCamp = CAMP_TIERS_DATA.find(c => c.tier === this.state.campTier);

        const campCard = document.createElement('div');
        campCard.className = 'item-card';

        if (nextCamp) {
            const canAfford = this.state.funds >= nextCamp.cost &&
                              this.state.wood >= nextCamp.woodCost &&
                              this.state.stone >= (nextCamp.stoneCost || 0);
            campCard.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">🏕️</div>
                    <div class="card-title-group">
                        <h3>Upgrade Camp: ${nextCamp.name}</h3>
                        <span class="card-sub">Current: Tier ${currentCamp.tier} (${currentCamp.name})</span>
                    </div>
                </div>
                <p class="card-body">${nextCamp.description}</p>
                <div class="card-stats">
                    <span class="badge">Cost: $${nextCamp.cost}</span>
                    <span class="badge">Wood: ${nextCamp.woodCost}</span>
                    <span class="badge">Stone: ${nextCamp.stoneCost || 0}</span>
                    <span class="badge badge-good">Base Cap: ${nextCamp.baseCapacity}</span>
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
                        <span class="card-sub">Maximum Level Reached</span>
                    </div>
                </div>
                <p class="card-body">${currentCamp.description}</p>
            `;
        }
        grid.appendChild(campCard);

        // Fence Tier Upgrade Card
        const nextFence = FENCE_TIERS_DATA.find(f => f.tier === this.state.fenceTier + 1);
        const currentFence = FENCE_TIERS_DATA.find(f => f.tier === this.state.fenceTier);

        const fenceCard = document.createElement('div');
        fenceCard.className = 'item-card';

        if (nextFence) {
            const canAfford = this.state.funds >= nextFence.cost &&
                              this.state.wood >= nextFence.woodCost &&
                              this.state.stone >= (nextFence.stoneCost || 0);
            fenceCard.innerHTML = `
                <div class="card-header">
                    <div class="card-icon">🛡️</div>
                    <div class="card-title-group">
                        <h3>Upgrade Fence: ${nextFence.name}</h3>
                        <span class="card-sub">Current: Tier ${currentFence.tier} (${currentFence.name})</span>
                    </div>
                </div>
                <p class="card-body">${nextFence.description}</p>
                <div class="card-stats">
                    <span class="badge">Cost: $${nextFence.cost}</span>
                    <span class="badge">Wood: ${nextFence.woodCost}</span>
                    <span class="badge">Stone: ${nextFence.stoneCost || 0}</span>
                    <span class="badge badge-good">Security: ${nextFence.securityRating}</span>
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
                        <span class="card-sub">Maximum Level Reached</span>
                    </div>
                </div>
                <p class="card-body">${currentFence.description}</p>
            `;
        }
        grid.appendChild(fenceCard);
    }

    // Visual Map Renderer (2D HTML Canvas)
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
        // Spawn strictly inside the reserve fence bounds with margin
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
            x: startX,
            y: startY,
            targetX: minX + Math.random() * (maxX - minX),
            targetY: minY + Math.random() * (maxY - minY),
            speed: 20 + Math.random() * 25
        });
    }

    updateMapAnimals(deltaSec) {
        const margin = 50;
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
            } else {
                animal.x += (dx / dist) * animal.speed * deltaSec;
                animal.y += (dy / dist) * animal.speed * deltaSec;

                // Clamp strictly inside reserve fence
                animal.x = Math.max(minX, Math.min(animal.x, maxX));
                animal.y = Math.max(minY, Math.min(animal.y, maxY));
            }
        });
    }

    render() {
        if (!this.ctx || !this.canvas) return;

        const screenW = this.canvas.width;
        const screenH = this.canvas.height;

        // Clear Screen
        this.ctx.clearRect(0, 0, screenW, screenH);

        // Fixed Camera Translation: Player centered in canvas view
        const camX = this.player.x - screenW / 2;
        const camY = this.player.y - screenH / 2;

        this.ctx.save();
        this.ctx.translate(-camX, -camY);

        // 1. World Background (Wilderness Savannah)
        this.ctx.fillStyle = '#223018';
        this.ctx.fillRect(0, 0, this.world.width, this.world.height);

        // Grid lines for scale & spatial awareness
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;
        const gridSize = 100;
        for (let x = 0; x <= this.world.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.world.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= this.world.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.world.width, y);
            this.ctx.stroke();
        }

        // World Outer Boundary
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 6;
        this.ctx.strokeRect(0, 0, this.world.width, this.world.height);

        // 2. Reserve Zone (Protected Fenced Enclosure)
        this.ctx.fillStyle = '#2c3d20';
        this.ctx.fillRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);

        // Reserve Waterhole
        const whX = this.reserve.x + 500;
        const whY = this.reserve.y + 500;
        this.ctx.fillStyle = '#234e6d';
        this.ctx.beginPath();
        this.ctx.ellipse(whX, whY, 140, 80, Math.PI / 6, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#2f6891';
        this.ctx.beginPath();
        this.ctx.ellipse(whX - 10, whY - 5, 110, 60, Math.PI / 6, 0, Math.PI * 2);
        this.ctx.fill();

        // Central Camp HQ Building inside Reserve
        const campX = this.reserve.x + 100;
        const campY = this.reserve.y + 100;
        this.ctx.fillStyle = '#5c4028';
        this.ctx.fillRect(campX, campY, 100, 70);
        this.ctx.strokeStyle = '#3a2717';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(campX, campY, 100, 70);

        this.ctx.fillStyle = '#e5a93c';
        this.ctx.font = 'bold 13px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`Camp T${this.state.campTier}`, campX + 50, campY + 35);

        // Reserve Fence Perimeter
        const fenceColor = this.state.fenceTier === 3 ? '#3498db' : (this.state.fenceTier === 2 ? '#bdc3c7' : '#8e44ad');
        this.ctx.strokeStyle = fenceColor;
        this.ctx.lineWidth = 6;
        this.ctx.strokeRect(this.reserve.x, this.reserve.y, this.reserve.width, this.reserve.height);

        if (this.state.fenceTier === 3) {
            // Electric Fence Pulsing Glow
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

        // 3. Render Wild Trees
        this.trees.forEach(tree => {
            // Shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            this.ctx.beginPath();
            this.ctx.arc(tree.x + 4, tree.y + 6, tree.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Tree Canopy
            this.ctx.fillStyle = '#1e5e27';
            this.ctx.beginPath();
            this.ctx.arc(tree.x, tree.y, tree.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Inner Highlight
            this.ctx.fillStyle = '#2ecc71';
            this.ctx.beginPath();
            this.ctx.arc(tree.x - 4, tree.y - 4, tree.radius * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // 4. Render Wild Rocks
        this.rocks.forEach(rock => {
            // Shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.beginPath();
            this.ctx.ellipse(rock.x + 3, rock.y + 4, rock.radius, rock.radius * 0.7, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Rock Body
            this.ctx.fillStyle = '#7f8c8d';
            this.ctx.beginPath();
            this.ctx.ellipse(rock.x, rock.y, rock.radius, rock.radius * 0.75, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Highlight
            this.ctx.fillStyle = '#bdc3c7';
            this.ctx.beginPath();
            this.ctx.ellipse(rock.x - 3, rock.y - 2, rock.radius * 0.5, rock.radius * 0.4, 0, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // 5. Render Reserve Animals
        this.ctx.font = '28px serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.renderedAnimals.forEach(animal => {
            this.ctx.fillText(animal.icon, animal.x, animal.y);
        });

        // 6. Render Player Character
        this.ctx.save();
        this.ctx.translate(this.player.x, this.player.y);
        this.ctx.rotate(this.player.angle);

        // Player Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(2, 4, this.player.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Player Body (Ranger Outfit Color)
        this.ctx.fillStyle = '#d35400'; // Ochre / Ranger jacket
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Direction Pointer / Hands
        this.ctx.fillStyle = '#f39c12';
        this.ctx.beginPath();
        this.ctx.arc(14, -6, 5, 0, Math.PI * 2);
        this.ctx.arc(14, 6, 5, 0, Math.PI * 2);
        this.ctx.fill();

        // Tool / Axe graphic when gathering
        if (this.player.isGathering) {
            const swing = Math.sin((this.player.gatherTimer / this.player.gatherDuration) * Math.PI) * 0.8;
            this.ctx.rotate(swing);
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(12, -2, 18, 4);
        }

        this.ctx.restore();

        // 7. Render Floating Feedback Texts
        this.ctx.font = 'bold 16px sans-serif';
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

// Instantiate game on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ReserveGame();
});

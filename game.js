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
        this.renderedAnimals = [];

        this.init();
    }

    init() {
        this.setupTabListeners();
        this.setupActionListeners();
        this.initVisualAnimals();
        this.updateUI();
        this.startLoop();
        this.renderMap();
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

    // Button event listeners
    setupActionListeners() {
        const chopBtn = document.getElementById('btn-chop-wood');
        if (chopBtn) {
            chopBtn.addEventListener('click', () => {
                this.state.wood += 5;
                this.updateUI();
            });
        }
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

    // Game Loop (120 seconds per day)
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
            this.renderMap();
        }, this.tickInterval);
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
            const canAfford = this.state.funds >= nextCamp.cost && this.state.wood >= nextCamp.woodCost;
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
            const canAfford = this.state.funds >= nextFence.cost && this.state.wood >= nextFence.woodCost;
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
        this.renderedAnimals.push({
            id: animalDef.id,
            icon: animalDef.icon,
            x: 100 + Math.random() * 600,
            y: 80 + Math.random() * 280,
            targetX: 100 + Math.random() * 600,
            targetY: 80 + Math.random() * 280,
            speed: 15 + Math.random() * 20
        });
    }

    updateMapAnimals(deltaSec) {
        this.renderedAnimals.forEach(animal => {
            const dx = animal.targetX - animal.x;
            const dy = animal.targetY - animal.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 5) {
                animal.targetX = 100 + Math.random() * 600;
                animal.targetY = 80 + Math.random() * 280;
            } else {
                animal.x += (dx / dist) * animal.speed * deltaSec;
                animal.y += (dy / dist) * animal.speed * deltaSec;
            }
        });
    }

    renderMap() {
        if (!this.ctx) return;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Savannah Background
        this.ctx.fillStyle = '#2d3a22';
        this.ctx.fillRect(0, 0, width, height);

        // Grass Patches / Details
        this.ctx.fillStyle = '#344327';
        this.ctx.beginPath();
        this.ctx.arc(200, 150, 80, 0, Math.PI * 2);
        this.ctx.arc(600, 300, 110, 0, Math.PI * 2);
        this.ctx.arc(400, 220, 60, 0, Math.PI * 2);
        this.ctx.fill();

        // Waterhole
        this.ctx.fillStyle = '#2b5c7e';
        this.ctx.beginPath();
        this.ctx.ellipse(400, 220, 90, 50, Math.PI / 8, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#3a78a1';
        this.ctx.beginPath();
        this.ctx.ellipse(395, 215, 75, 40, Math.PI / 8, 0, Math.PI * 2);
        this.ctx.fill();

        // Reserve Perimeter Fence
        this.ctx.strokeStyle = this.state.fenceTier === 3 ? '#3498db' : (this.state.fenceTier === 2 ? '#bdc3c7' : '#8e44ad');
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(30, 30, width - 60, height - 60);

        if (this.state.fenceTier === 3) {
            // Glow effect for electric fence
            this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
            this.ctx.lineWidth = 10;
            this.ctx.strokeRect(30, 30, width - 60, height - 60);
        }

        // Central Ranger Camp / HQ
        this.ctx.fillStyle = '#6e5132';
        this.ctx.fillRect(50, 50, 70, 50);
        this.ctx.fillStyle = '#e5a93c';
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText(`Camp T${this.state.campTier}`, 60, 80);

        // Render Animals
        this.ctx.font = '24px serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.renderedAnimals.forEach(animal => {
            this.ctx.fillText(animal.icon, animal.x, animal.y);
        });
    }
}

// Instantiate game on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ReserveGame();
});

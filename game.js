const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreVal = document.getElementById('score-val');
const livesVal = document.getElementById('lives-val');
const waveVal = document.getElementById('wave-val');
const finalScoreVal = document.getElementById('final-score');
const menuOverlay = document.getElementById('menu-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const colorPicker = document.getElementById('player-color-picker');
const infLivesToggle = document.getElementById('inf-lives-toggle');

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_X = 150;
const PLAYER_SIZE = 24;
const FORWARD_SPEED = 7;
const VERTICAL_SPEED = 8;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Game state
let gameState = 'MENU';
let score = 0;
let distance = 0;
let lives = 3;
let infiniteLives = false;
let player;
let path = [];
let trail = []; // Array of {x, y} points
let particles = [];
let isHolding = false;

const COLORS = {
    cyan: '#00f3ff',
    magenta: '#ff00ff',
    yellow: '#fff300',
    green: '#00ff9f',
    red: '#ff3131'
};

// --- Classes ---

class WavePlayer {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = PLAYER_X;
        this.y = CANVAS_HEIGHT / 2;
        this.size = PLAYER_SIZE;
        this.color = colorPicker ? colorPicker.value : COLORS.cyan;
        this.angle = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Rotate based on direction
        const targetAngle = isHolding ? -Math.PI / 4 : Math.PI / 4;
        this.angle += (targetAngle - this.angle) * 0.2;
        ctx.rotate(this.angle);
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(this.size / 2, 0);
        ctx.lineTo(-this.size / 2, -this.size / 2);
        ctx.lineTo(-this.size / 2, this.size / 2);
        ctx.closePath();
        ctx.stroke();
        
        // Inner fill
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
        
        ctx.restore();
    }

    update() {
        if (isHolding) {
            this.y -= VERTICAL_SPEED;
        } else {
            this.y += VERTICAL_SPEED;
        }

        // Keep color updated from picker
        this.color = colorPicker ? colorPicker.value : COLORS.cyan;
    }
}

class PathSegment {
    constructor(x) {
        this.x = x;
        this.width = 10;
        this.top = 150 + Math.random() * 100;
        this.bottom = 150 + Math.random() * 100;
        this.gap = CANVAS_HEIGHT - this.top - this.bottom;
    }

    draw() {
        ctx.shadowBlur = 5;
        ctx.shadowColor = COLORS.cyan;
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.lineWidth = 2;

        // Top spikes
        ctx.beginPath();
        ctx.moveTo(this.x, 0);
        ctx.lineTo(this.x, this.top);
        ctx.lineTo(this.x + this.width, this.top);
        ctx.lineTo(this.x + this.width, 0);
        ctx.stroke();

        // Bottom spikes
        ctx.beginPath();
        ctx.moveTo(this.x, CANVAS_HEIGHT);
        ctx.lineTo(this.x, CANVAS_HEIGHT - this.bottom);
        ctx.lineTo(this.x + this.width, CANVAS_HEIGHT - this.bottom);
        ctx.lineTo(this.x + this.width, CANVAS_HEIGHT);
        ctx.stroke();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 10;
        this.speedY = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.speedX *= 0.95;
        this.speedY *= 0.95;
    }
}

// --- Game Logic ---

function init() {
    player = new WavePlayer();
    path = [];
    trail = [];
    particles = [];
    distance = 0;
    
    // Initial path
    for (let x = 0; x < CANVAS_WIDTH + 100; x += 10) {
        path.push(new PathSegment(x));
    }
}

function updatePath() {
    path.forEach(seg => seg.x -= FORWARD_SPEED);
    trail.forEach(pt => pt.x -= FORWARD_SPEED);
    
    // Limit trail length
    if (trail.length > 500) trail.shift();
    
    // Add current player position to trail
    trail.push({x: player.x, y: player.y});
    
    // Add new segment
    if (path[path.length - 1].x < CANVAS_WIDTH) {
        const lastSeg = path[path.length - 1];
        const newSeg = new PathSegment(lastSeg.x + lastSeg.width);
        
        // Smooth transitions
        newSeg.top = lastSeg.top + (Math.random() - 0.5) * 30;
        newSeg.top = Math.max(100, Math.min(CANVAS_HEIGHT - 250, newSeg.top));
        
        newSeg.bottom = lastSeg.bottom + (Math.random() - 0.5) * 30;
        newSeg.bottom = Math.max(100, Math.min(CANVAS_HEIGHT - 250, newSeg.bottom));
        
        path.push(newSeg);
    }
    
    // Remove old segments
    if (path[0].x < -20) {
        path.shift();
    }
}

function checkCollisions() {
    // Check against current path segment
    const currentSeg = path.find(seg => player.x >= seg.x && player.x < seg.x + seg.width);
    
    if (currentSeg) {
        if (player.y - player.size/4 < currentSeg.top || player.y + player.size/4 > CANVAS_HEIGHT - currentSeg.bottom) {
            handleDeath();
        }
    }

    // Screen boundaries
    if (player.y < 0 || player.y > CANVAS_HEIGHT) {
        handleDeath();
    }
}

function handleDeath() {
    createExplosion(player.x, player.y, player.color);
    
    if (!infiniteLives) {
        lives--;
        livesVal.innerText = lives;
        if (lives <= 0) {
            endGame();
        } else {
            // Short reset
            player.y = CANVAS_HEIGHT / 2;
        }
    } else {
        // Just flash or something, but keep going
        player.y = CANVAS_HEIGHT / 2;
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 30; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function startGame() {
    gameState = 'PLAYING';
    score = 0;
    lives = infiniteLives ? '∞' : 3;
    scoreVal.innerText = score;
    livesVal.innerText = lives;
    menuOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    init();
}

function endGame() {
    gameState = 'GAME_OVER';
    finalScoreVal.innerText = score;
    gameOverOverlay.classList.remove('hidden');
}

function handleInput() {
    const press = () => isHolding = true;
    const release = () => isHolding = false;

    window.onkeydown = (e) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') press(); };
    window.onkeyup = (e) => release();
    
    canvas.onmousedown = press;
    window.onmouseup = release;
    
    canvas.ontouchstart = (e) => { e.preventDefault(); press(); };
    canvas.ontouchend = release;
}

function update() {
    if (gameState !== 'PLAYING') return;

    player.update();
    updatePath();
    checkCollisions();
    
    distance += FORWARD_SPEED / 10;
    score = Math.floor(distance);
    scoreVal.innerText = score;
    
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => p.update());
}

function draw() {
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i - (distance % 40), 0);
        ctx.lineTo(i - (distance % 40), CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let j = 0; j < CANVAS_HEIGHT; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(CANVAS_WIDTH, j);
        ctx.stroke();
    }

    path.forEach(seg => seg.draw());
    
    // Draw trail
    if (trail.length > 1) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = player.color;
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x, trail[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    particles.forEach(p => p.draw());
    
    if (gameState === 'PLAYING') {
        player.draw();
        
        // Tail effect
        particles.push(new Particle(player.x - 5, player.y, player.color));
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// UI Event Listeners
startBtn.onclick = startGame;
restartBtn.onclick = startGame;

infLivesToggle.onchange = (e) => {
    infiniteLives = e.target.checked;
    livesVal.innerText = infiniteLives ? '∞' : lives;
};

handleInput();
gameLoop();

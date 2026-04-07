const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// World
const GROUND_Y = H - 70;
const GRAVITY = 0.6;

// Player tuning
const ACCEL = 0.4;
const FRICTION = 0.93;
const MAX_SPEED = 7;
const JUMP_POWER = 12;

const player = {
    x: W / 2,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
};

let cameraX = 0;

// Auto-runner config
const PLAYER_X = Math.round(W * 0.2);    // fixed screen x for the player
const AUTO_SPEED = 5.5;                  // constant horizontal velocity while playing

// Game states
const STATE_READY = 'ready';
const STATE_PLAYING = 'playing';
const STATE_GAMEOVER = 'gameover';
let gameState = STATE_READY;

// Cars
const cars = [];
const CAR_COLORS = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#8d99ae', '#b5179e'];
let nextSpawnX = 0;

// Score
let score = 0;
let highScore = 0;

// Restart lockout after a bail
const RESTART_DELAY_MS = 500;
let gameOverAt = 0;
try {
    highScore = parseInt(localStorage.getItem('skateHighScore') || '0', 10) || 0;
} catch (e) {}

function makeCar(x) {
    return {
        x: x,
        w: 78,
        h: 36 + Math.floor(Math.random() * 10),
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
        jumped: false,
    };
}

function spawnCarsIfNeeded() {
    while (nextSpawnX < player.x + 1500) {
        cars.push(makeCar(nextSpawnX));
        nextSpawnX += 320 + Math.random() * 320;
    }
}

function despawnCars() {
    for (let i = cars.length - 1; i >= 0; i--) {
        if (cars[i].x + cars[i].w < player.x - 200) {
            cars.splice(i, 1);
        }
    }
}

function resetGame() {
    player.x = PLAYER_X;
    player.y = GROUND_Y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.facing = 1;
    cars.length = 0;
    nextSpawnX = PLAYER_X + 600;
    score = 0;
    cameraX = 0;
    spawnCarsIfNeeded();
}

function endGame() {
    gameState = STATE_GAMEOVER;
    gameOverAt = performance.now();
    if (score > highScore) {
        highScore = score;
        try { localStorage.setItem('skateHighScore', String(highScore)); } catch (e) {}
    }
}

function checkCarCollisions() {
    // Player AABB (feet at player.y, ~50 tall, ~28 wide)
    const pw = 28;
    const ph = 50;
    const px = player.x - pw / 2;
    const py = player.y - ph;

    for (const car of cars) {
        const cx = car.x;
        const cy = GROUND_Y - car.h;
        const cw = car.w;
        const ch = car.h;
        if (px + pw > cx && px < cx + cw && py + ph > cy && py < cy + ch) {
            endGame();
            return;
        }
    }
}

function updateScore() {
    for (const car of cars) {
        if (car.jumped) continue;
        // Counted as jumped the first frame the player is above the car horizontally and clear of its top
        if (player.x > car.x && player.x < car.x + car.w && player.y < GROUND_Y - car.h) {
            car.jumped = true;
            score++;
        }
    }
}

// Input — any keypress (no auto-repeat) or mouse click triggers an action.
function tryAction() {
    if (gameState === STATE_READY) {
        gameState = STATE_PLAYING;
    } else if (gameState === STATE_GAMEOVER) {
        if (performance.now() - gameOverAt < RESTART_DELAY_MS) return;
        resetGame();
        gameState = STATE_PLAYING;
    } else if (gameState === STATE_PLAYING && player.onGround) {
        player.vy = -JUMP_POWER;
        player.onGround = false;
    }
}

window.addEventListener('keydown', (e) => {
    if (e.repeat) return;  // require a fresh keypress
    // Skip pure modifier keys so Cmd/Ctrl/Shift/Alt don't trigger jumps
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    tryAction();
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
});

window.addEventListener('mousedown', (e) => {
    tryAction();
    e.preventDefault();
});

function update() {
    if (gameState !== STATE_PLAYING) return;

    // Auto-run
    player.vx = AUTO_SPEED;

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;

    if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.vy = 0;
        player.onGround = true;
    }

    cameraX = player.x - PLAYER_X;

    spawnCarsIfNeeded();
    despawnCars();
    updateScore();
    checkCarCollisions();
}

function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#5BB6E8');
    sky.addColorStop(1, '#D8F0FF');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Distant mountains (slow parallax). Index by world position so each
    // mountain is stable as the camera moves.
    ctx.fillStyle = '#7A8B99';
    const mtnSpacing = 320;
    const mtnParallax = cameraX * 0.2;
    const firstMtn = Math.floor(mtnParallax / mtnSpacing) - 1;
    const lastMtn = firstMtn + Math.ceil(W / mtnSpacing) + 2;
    for (let i = firstMtn; i <= lastMtn; i++) {
        const mx = i * mtnSpacing - mtnParallax;
        ctx.beginPath();
        ctx.moveTo(mx, GROUND_Y);
        ctx.lineTo(mx + 160, GROUND_Y - 130);
        ctx.lineTo(mx + 320, GROUND_Y);
        ctx.closePath();
        ctx.fill();
    }

    // Clouds (medium parallax). Same trick — height varies by world index
    // so a given cloud always renders at the same y.
    ctx.fillStyle = '#fff';
    const cloudSpacing = 260;
    const cloudParallax = cameraX * 0.5;
    const firstCloud = Math.floor(cloudParallax / cloudSpacing) - 1;
    const lastCloud = firstCloud + Math.ceil(W / cloudSpacing) + 2;
    for (let i = firstCloud; i <= lastCloud; i++) {
        const cx = i * cloudSpacing - cloudParallax;
        const cy = 60 + (((i % 3) + 3) % 3) * 30;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.arc(cx + 20, cy + 5, 22, 0, Math.PI * 2);
        ctx.arc(cx + 42, cy, 16, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawGround() {
    // Dirt below the road
    ctx.fillStyle = '#5B4636';
    ctx.fillRect(0, GROUND_Y + 14, W, H - GROUND_Y - 14);

    // Asphalt
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, GROUND_Y + 4, W, 10);

    // Curb edge
    ctx.fillStyle = '#222';
    ctx.fillRect(0, GROUND_Y + 2, W, 2);

    // Lane stripes (scroll with camera)
    ctx.fillStyle = '#FFD24A';
    const stripeSpacing = 90;
    const stripeOffset = ((cameraX) % stripeSpacing + stripeSpacing) % stripeSpacing;
    for (let i = -1; i <= W / stripeSpacing + 1; i++) {
        ctx.fillRect(i * stripeSpacing - stripeOffset, GROUND_Y + 7, 50, 4);
    }
}

function drawCar(car) {
    const sx = car.x - cameraX;
    if (sx + car.w < -20 || sx > W + 20) return;
    const top = GROUND_Y - car.h;
    const bodyTop = top + car.h * 0.45;

    // Body (lower half)
    ctx.fillStyle = car.color;
    ctx.fillRect(sx, bodyTop, car.w, car.h * 0.55);

    // Cabin / roof
    ctx.beginPath();
    ctx.moveTo(sx + car.w * 0.18, bodyTop);
    ctx.lineTo(sx + car.w * 0.30, top);
    ctx.lineTo(sx + car.w * 0.72, top);
    ctx.lineTo(sx + car.w * 0.84, bodyTop);
    ctx.closePath();
    ctx.fill();

    // Windows
    ctx.fillStyle = '#bfe6ff';
    ctx.beginPath();
    ctx.moveTo(sx + car.w * 0.24, bodyTop - 2);
    ctx.lineTo(sx + car.w * 0.33, top + 4);
    ctx.lineTo(sx + car.w * 0.48, top + 4);
    ctx.lineTo(sx + car.w * 0.48, bodyTop - 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + car.w * 0.52, bodyTop - 2);
    ctx.lineTo(sx + car.w * 0.52, top + 4);
    ctx.lineTo(sx + car.w * 0.68, top + 4);
    ctx.lineTo(sx + car.w * 0.78, bodyTop - 2);
    ctx.closePath();
    ctx.fill();

    // Headlight
    ctx.fillStyle = '#ffeb99';
    ctx.fillRect(sx + car.w - 5, bodyTop + 6, 5, 5);

    // Wheels
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(sx + car.w * 0.22, GROUND_Y, 7, 0, Math.PI * 2);
    ctx.arc(sx + car.w * 0.78, GROUND_Y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(sx + car.w * 0.22, GROUND_Y, 3, 0, Math.PI * 2);
    ctx.arc(sx + car.w * 0.78, GROUND_Y, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawCars() {
    for (const car of cars) drawCar(car);
}

function drawUI() {
    // Score HUD (top right)
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W - 170, 10, 160, 56);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Score: ${score}`, W - 160, 32);
    ctx.fillText(`Best:  ${highScore}`, W - 160, 54);

    if (gameState === STATE_READY) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, H / 2 - 70, W, 140);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px -apple-system, sans-serif';
        ctx.fillText('SKATE!', W / 2, H / 2 - 18);
        ctx.font = '18px -apple-system, sans-serif';
        ctx.fillText('Press any key or click to start', W / 2, H / 2 + 14);
        ctx.font = '14px -apple-system, sans-serif';
        ctx.fillStyle = '#cfd8dc';
        ctx.fillText('Tap again to jump cars', W / 2, H / 2 + 38);
        ctx.textAlign = 'left';
    } else if (gameState === STATE_GAMEOVER) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, H / 2 - 90, W, 180);
        ctx.fillStyle = '#ff3b30';
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px -apple-system, sans-serif';
        ctx.fillText('BAIL!', W / 2, H / 2 - 36);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px -apple-system, sans-serif';
        ctx.fillText(`Score: ${score}`, W / 2, H / 2 + 2);
        ctx.font = '18px -apple-system, sans-serif';
        ctx.fillStyle = score > 0 && score === highScore ? '#FFD24A' : '#cfd8dc';
        const bestLabel = score > 0 && score === highScore ? `NEW BEST: ${highScore}` : `Best: ${highScore}`;
        ctx.fillText(bestLabel, W / 2, H / 2 + 28);
        if (performance.now() - gameOverAt >= RESTART_DELAY_MS) {
            ctx.font = '15px -apple-system, sans-serif';
            ctx.fillStyle = '#fff';
            ctx.fillText('Press any key or click to play again', W / 2, H / 2 + 58);
        }
        ctx.textAlign = 'left';
    }
}

function drawPlayer() {
    const px = player.x - cameraX;
    const py = player.y;

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(player.facing, 1);

    // Skateboard deck
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-22, -8, 44, 5);

    // Wheels
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-15, -1, 4, 0, Math.PI * 2);
    ctx.arc(15, -1, 4, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(-5, -24);
    ctx.moveTo(8, -8);
    ctx.lineTo(5, -24);
    ctx.stroke();

    // Body (torso)
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(-10, -42, 20, 20);

    // Arms — lean forward when moving fast
    const lean = Math.min(Math.abs(player.vx) / MAX_SPEED, 1) * 6;
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-8, -36);
    ctx.lineTo(-14 - lean, -24);
    ctx.moveTo(8, -36);
    ctx.lineTo(14 + lean, -24);
    ctx.stroke();

    // Head
    ctx.fillStyle = '#F5D0A9';
    ctx.beginPath();
    ctx.arc(2, -50, 8, 0, Math.PI * 2);
    ctx.fill();

    // Helmet
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(2, -52, 9, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function render() {
    drawBackground();
    drawGround();
    drawCars();
    drawPlayer();
    drawUI();
}

function loop() {
    update();
    render();
    requestAnimationFrame(loop);
}

resetGame();
loop();

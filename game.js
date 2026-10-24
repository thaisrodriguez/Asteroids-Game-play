'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-up: disparo triple ──────────────────────────────────────────────────
const TRIPLE_DURATION = 10;     // segundos de efecto
const TRIPLE_SPREAD   = 0.26;   // rad entre balas del abanico

// ── Power-up: asteroides lentos ───────────────────────────────────────────────
const SLOW_DURATION  = 6;        // segundos de efecto
const SLOW_FACTOR    = 0.5;      // multiplicador de velocidad de los asteroides

// ── Power-up: Bomba Nova ──────────────────────────────────────────────────────
const NOVA_KEY   = 'KeyB';
const NOVA_FLASH = 0.6;        // duración del destello al detonar

// ── Power-up: hiperpropulsión ─────────────────────────────────────────────────
const HYPER_DURATION = 8;           // segundos de efecto
const HYPER_THRUST   = 2.5;         // multiplicador de aceleración (y velocidad máxima)
const HYPER_ROT      = 1.35;        // multiplicador de giro, para esquivar con precisión

// ── Aparición de ítems ────────────────────────────────────────────────────────
// Los ítems caen al destruir asteroides, al azar. Triple, lento e hiperpropulsión
// caen al menos una vez por nivel; la Nova es escasa: una vez por juego.
const MAX_PICKUPS      = 2;      // máximo de ítems en pantalla a la vez
const PICKUP_TTL       = 12;     // segundos que dura un ítem sin recoger
const DROP_CHANCE      = 0.2;    // probabilidad base de caída por asteroide destruido
const NOVA_DROP_CHANCE = 0.04;   // probabilidad de que el ítem sea la Nova (mientras no haya caído)

const POWERUP_STYLE = {
  triple: { color: '#0ff', label: '3' },
  slow:   { color: '#6f6', label: 'L' },
  nova:   { color: '#f6f', label: 'N' },
  hyper:  { color: '#ff0', label: 'H' },
};

class PowerUp {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * 25;
    this.vy = Math.sin(angle) * 25;
    this.radius = 14;
    this.t = 0;
    this.ttl = PICKUP_TTL;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.t += dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadea en los últimos 3 s antes de desaparecer
    if (this.ttl < 3 && Math.floor(this.ttl * 6) % 2 === 0) return;
    const pulse = 1 + Math.sin(this.t * 6) * 0.12;
    ctx.save();
    ctx.translate(this.x, this.y);
    const style = POWERUP_STYLE[this.type];
    ctx.strokeStyle = style.color;
    ctx.fillStyle   = style.color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.label, 0, 1);
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const boost  = hyperTimer > 0;
    const ROT    = 3.5 * (boost ? HYPER_ROT : 1);     // rad/s
    const THRUST = 260 * (boost ? HYPER_THRUST : 1);  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (tripleTimer > 0) {
      return [-TRIPLE_SPREAD, 0, TRIPLE_SPREAD].map(d => new Bullet(ox, oy, this.angle + d));
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let tripleTimer;      // segundos restantes de disparo triple
let slowTimer;        // segundos restantes de asteroides lentos
let hyperTimer;       // segundos restantes de hiperpropulsión
let novaReady;        // true si la nave lleva una bomba lista (un solo uso)
let novaFlash;        // segundos restantes del destello de detonación
let pickups;          // ítems en pantalla (máx. MAX_PICKUPS)
let levelDrops;       // tipos que aún no han caído en este nivel
let novaPending;      // true hasta que cae la Nova (una vez por juego)

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

// Triple, lento e hiperpropulsión deben caer una vez en cada nivel
function scheduleLevelPowerUps() {
  levelDrops = ['triple', 'slow', 'hyper'];
}

// Al destruir un asteroide puede caer un ítem en su posición.
// asteroidsLeft: asteroides que quedan; la probabilidad sube para garantizar la caída del nivel.
function maybeDropPowerUp(x, y, asteroidsLeft) {
  if (pickups.length >= MAX_PICKUPS || asteroidsLeft === 0) return;
  let type = null;
  if (novaPending && Math.random() < NOVA_DROP_CHANCE) {
    novaPending = false;
    type = 'nova';
  } else if (levelDrops.length && Math.random() < Math.max(DROP_CHANCE, levelDrops.length / asteroidsLeft)) {
    type = levelDrops.splice(randInt(0, levelDrops.length - 1), 1)[0];
  }
  if (type) pickups.push(new PowerUp(type, x, y));
}

function applyPowerUp(type) {
  if (type === 'triple') tripleTimer = TRIPLE_DURATION;
  else if (type === 'slow') slowTimer = SLOW_DURATION;
  else if (type === 'hyper') hyperTimer = HYPER_DURATION;
  else if (type === 'nova') novaReady = true;
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  tripleTimer    = 0;
  slowTimer      = 0;
  pickups        = [];
  novaPending    = true;
  novaReady      = false;
  novaFlash      = 0;
  hyperTimer     = 0;
  scheduleLevelPowerUps();
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  ship.reset();
  slowTimer   = 0;
  scheduleLevelPowerUps();
  spawnAsteroids(3 + level);
}

// dt de los asteroides: la mitad mientras dura el power-up de ralentización
const asteroidDt = dt => (slowTimer > 0 ? dt * SLOW_FACTOR : dt);

// Bomba Nova: destruye todos los asteroides en pantalla (sin fragmentos)
function detonateNova() {
  novaReady = false;
  novaFlash = NOVA_FLASH;
  for (const a of asteroids) {
    a.dead = true;
    score += POINTS[a.size];
    explode(a.x, a.y, a.size * 5);
  }
  asteroids = [];
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  tripleTimer = 0;
  slowTimer   = 0;
  hyperTimer  = 0;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(asteroidDt(dt)));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Los temporizadores bajan antes que la nave, que lee hyperTimer
  if (hyperTimer  > 0) hyperTimer  = Math.max(0, hyperTimer  - dt);
  if (tripleTimer > 0) tripleTimer = Math.max(0, tripleTimer - dt);
  if (slowTimer   > 0) slowTimer   = Math.max(0, slowTimer   - dt);
  if (novaFlash   > 0) novaFlash   = Math.max(0, novaFlash   - dt);

  ship.update(dt);

  // Ítems: recoger al tocarlos con la nave
  for (const pu of pickups) {
    pu.update(dt);
    if (!pu.dead && dist(ship, pu) < ship.radius + pu.radius) {
      applyPowerUp(pu.type);
      pu.dead = true;
    }
  }
  pickups = pickups.filter(pu => !pu.dead);

  // Bomba Nova: se activa con NOVA_KEY
  if (pressed(NOVA_KEY) && novaReady) detonateNova();

  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(asteroidDt(dt)));
  particles.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  const killed = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        killed.push(a);
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);
  killed.forEach(a => maybeDropPowerUp(a.x, a.y, asteroids.length));

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  ctx.textAlign = 'left';
  let row = 48;
  if (tripleTimer > 0) {
    ctx.fillStyle = POWERUP_STYLE.triple.color;
    ctx.fillText(`TRIPLE ${tripleTimer.toFixed(1)}s`, 14, row);
    row += 22;
  }
  if (slowTimer > 0) {
    ctx.fillStyle = POWERUP_STYLE.slow.color;
    ctx.fillText(`LENTO ${slowTimer.toFixed(1)}s`, 14, row);
    row += 22;
  }
  if (novaReady) {
    ctx.fillStyle = POWERUP_STYLE.nova.color;
    ctx.fillText('NOVA [B]', 14, row);
    row += 22;
  }
  if (hyperTimer > 0) {
    ctx.fillStyle = POWERUP_STYLE.hyper.color;
    ctx.fillText(`HIPER ${hyperTimer.toFixed(1)}s`, 14, row);
  }

}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  pickups.forEach(pu => pu.draw());
  ship.draw();

  drawHUD();

  // Destello de la Bomba Nova
  if (novaFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(novaFlash / NOVA_FLASH * 0.8).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);

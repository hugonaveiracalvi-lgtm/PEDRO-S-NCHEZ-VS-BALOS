// Variables globales
const fallingImagesList = [
    '15638018297973.jpg',
    '17310186512788.webp',
    'abalos-rie.gif',
    'meme-sobre-pedro-sanchez-655x368.webp',
    'ooo.webp',
    'pedroto.webp',
    'popop.webp',
    'pppp.webp'
];

let fallingImageIntervals = []; // Track intervals to stop them
let currentUser = null;
let gameSpeed = 7; // Faster start speed (User Request: increased from 5)
let score = 0;
let gameOver = false;
let gameStarted = false;
let highScore = localStorage.getItem('pedroVsAbalosHighScore') || 0;
let lastCelebrationScore = 0;
let totalRedObstacles = 0; // Contador de obstáculos rojos (Ábalos)
let animationId;
let frames = 0;
let godMode = false; // Invincibility cheat
let obstacles = [];
let aquaticMode = false; // Aquatic theme activated at score 20

// === ACHIEVEMENT SYSTEM ===
let achievements = {
    firstGame: false,
    aquaticMode: false,
    bossMode: false,
    gameComplete: false,
    secretButton: false,
    pichula: false // New achievement
};

function loadAchievements() {
    const saved = localStorage.getItem('pedroVsAbalosAchievements');
    if (saved) {
        achievements = JSON.parse(saved);
        updateAchievementUI();
    }
}

function saveAchievements() {
    // Save locally as backup
    localStorage.setItem('pedroVsAbalosAchievements', JSON.stringify(achievements));

    // Save to Cloud
    if (window.GameManager) {
        window.GameManager.saveAchievements(achievements);
    }
}

function unlockAchievement(achievementKey, achievementId, title) {
    if (achievements[achievementKey]) return; // Already unlocked

    achievements[achievementKey] = true;
    saveAchievements();

    // Update UI
    const element = document.getElementById(achievementId);
    if (element) {
        element.setAttribute('data-locked', 'false');
        element.classList.add('unlocking');
        setTimeout(() => element.classList.remove('unlocking'), 500);
    }

    // Show notification
    showAchievementNotification(title);
}

function updateAchievementUI() {
    if (achievements.firstGame) {
        document.getElementById('achievement-1')?.setAttribute('data-locked', 'false');
    }
    if (achievements.aquaticMode) {
        document.getElementById('achievement-2')?.setAttribute('data-locked', 'false');
    }
    if (achievements.bossMode) {
        document.getElementById('achievement-3')?.setAttribute('data-locked', 'false');
    }
    if (achievements.gameComplete) {
        document.getElementById('achievement-4')?.setAttribute('data-locked', 'false');
    }
    if (achievements.secretButton) {
        document.getElementById('achievement-5')?.setAttribute('data-locked', 'false');
    }
    if (achievements.pichula) {
        document.getElementById('achievement-6')?.setAttribute('data-locked', 'false');
    }
}

function showAchievementNotification(title) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `🏆 Logro Desbloqueado: ${title}`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// === BOSS MODE VARIABLES ===
let isTransitioning = false; // Flag to prevent game restart during transitions
let bossMode = false;
let bossX = 0;
let bossY = 0;
let bossWidth = 150;
let bossHeight = 150;
let fireballs = [];
let freeRoamPlayerX = 0;
let freeRoamPlayerY = 0;
let freeRoamPlayerWidth = 60;
let freeRoamPlayerHeight = 80;
let freeRoamPlayerSpeed = 6;
let bossFireballTimer = 0;
let bossFireballInterval = 60; // frames between fireballs
let flameParticles = [];
let bossImg = null;
let bossStartTime = 0; // Track when boss mode starts
const BOSS_SURVIVAL_TIME = 10000; // 10 seconds (User Request: reduced from 15)

// Preload boss image
const bossImagePreload = new Image();
bossImagePreload.src = 'boss_abalos.jpg';

// Sistema de partículas para el fondo
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        const size = Math.random() * 3 + 1;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';

        const colors = ['var(--neon-blue)', 'var(--neon-pink)', 'var(--neon-green)'];
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + 'vw';
        particle.style.top = Math.random() * 100 + 'vh';
        particle.style.opacity = Math.random() * 0.6 + 0.1;
        particle.style.boxShadow = `0 0 ${Math.random() * 10 + 5}px currentColor`;

        // Animación
        particle.animate([
            {
                transform: 'translate(0, 0)',
                opacity: particle.style.opacity
            },
            {
                transform: `translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px)`,
                opacity: Math.random() * 0.3
            }
        ], {
            duration: Math.random() * 4000 + 2000,
            iterations: Infinity,
            direction: 'alternate',
            easing: 'ease-in-out'
        });

        particlesContainer.appendChild(particle);
    }
}

// Manejar el modal de usuario
const userModal = document.getElementById('userModal');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const guestBtn = document.getElementById('guestBtn');

// Listen for Firebase Auth Changes
window.addEventListener('firebase-auth-change', async (e) => {
    const user = e.detail.user;
    if (user) {
        currentUser = user.displayName;
        console.log("Logged in as:", currentUser);

        // Load cloud data
        if (window.GameManager) {
            const userData = await window.GameManager.loadUserData();
            if (userData) {
                if (userData.achievements) {
                    achievements = userData.achievements;
                    updateAchievementUI();
                }
                // Update local high score display if cloud has one
                // Note: highScores are usually separate, but we could sync them
            }
        }

        if (userModal) userModal.style.display = 'none';
        startGameAfterLogin();
    } else {
        // Show login modal if not logged in
        if (userModal) userModal.style.display = 'flex';
    }
});

function initUserModal() {
    // Google Login
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            if (window.GameManager) {
                await window.GameManager.loginWithGoogle();
                // Auth listener will handle the rest
            }
        });
    }

    // Guest Mode
    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            currentUser = "Invitado_" + Math.floor(Math.random() * 1000);
            if (userModal) userModal.style.display = 'none';
            startGameAfterLogin();
        });
    }
}

function startGameAfterLogin() {
    const startInstruction = document.getElementById('startInstruction');
    if (startInstruction) startInstruction.style.display = 'block';
    updateLeaderboard(); // Refresh leaderboard from cloud
    initGame();
}

// Elementos del DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const finalScoreElement = document.getElementById('finalScore');
const bossTimerElement = document.getElementById('bossTimer');
const gameOverScreen = document.getElementById('gameOverScreen');
const restartBtn = document.getElementById('restartBtn');
const startInstruction = document.getElementById('startInstruction');
const celebrationOverlay = document.getElementById('celebrationOverlay');
const celebrationImage = document.getElementById('celebrationImage');
const scoreDisplay = document.getElementById('scoreDisplay');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const leaderboardBody = document.getElementById('leaderboardBody');

// Ajustar canvas al contenedor
function resizeCanvas() {
    if (canvas) {
        // Usar dimensiones fijas internas para lógica consistente
        // pero asegurar que se ve bien
        // canvas.width = 1400; // Ya definido en HTML
        // canvas.height = 550; // Ya definido en HTML
    }
}

// Sistema de puntuación global
const GLOBAL_SCORES_KEY = 'pedroVsAbalosGlobalScores';

function getGlobalScores() {
    const scoresJSON = localStorage.getItem(GLOBAL_SCORES_KEY);
    if (scoresJSON) {
        return JSON.parse(scoresJSON);
    }
    return [];
}

function saveGlobalScore(playerName, score) {
    if (window.GameManager) {
        window.GameManager.saveScore(score);
        // Also update personal
        window.GameManager.updatePersonalHighScore(score);
    }

    updateLeaderboard();
}

async function updateLeaderboard() {
    if (!leaderboardBody) return;

    let scores = [];

    if (window.GameManager) {
        scores = await window.GameManager.getLeaderboard();
    } else {
        scores = []; // Fallback empty or local if disconnected
    }

    leaderboardBody.innerHTML = '';

    if (scores.length === 0) {
        leaderboardBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-secondary); font-size: 1.1rem;">
                    ¡Sé el primero en jugar y aparecer aquí! 🎮
                </td>
            </tr>
        `;
        return;
    }

    scores.forEach((scoreEntry, index) => {
        const row = document.createElement('tr');
        let rankClass = '';

        if (index === 0) rankClass = 'rank-1';
        else if (index === 1) rankClass = 'rank-2';
        else if (index === 2) rankClass = 'rank-3';

        // Format date safely
        let dateStr = "Hoy";
        if (scoreEntry.date) {
            // Handle ISO string or timestamp
            dateStr = new Date(scoreEntry.timestamp || Date.now()).toLocaleDateString('es-ES');
        }

        row.innerHTML = `
            <td class="${rankClass}">${index + 1}º</td>
            <td class="player-name" title="${scoreEntry.name}">${scoreEntry.name}</td>
            <td class="player-score">${scoreEntry.score}</td>
            <td>${dateStr}</td>
        `;
        leaderboardBody.appendChild(row);
    });
}

// Sistema de fondos rotativos (reparado)
const backgrounds = [
    {
        name: "Sala de reuniones",
        src: '17469860886785.jpg',
        color1: '#0a0a1a', color2: '#2a2a40' // Fallback colors
    },
    {
        name: "House of Commons",
        src: '17310186512788.webp',
        color1: '#1a0a0a', color2: '#402a2a'
    },
    {
        name: "Sanchez y Ábalos",
        src: 'abalos-sanchez-kNVB-RDHeQh7BmYqzcYJJgMVorFP-1200x840@diario_abc.webp',
        color1: '#0a1a0a', color2: '#2a402a'
    },
    {
        name: "Pedro Sánchez oficial",
        src: 'pedro_sanchez-espana_464966259_240137361_1706x960.webp',
        color1: '#0a0a2a', color2: '#2a2a60'
    }
];

let currentBackgroundIndex = 0;
let backgroundChangeTimer = 0;
const BACKGROUND_CHANGE_INTERVAL = 1000; // Cambiar cada 1000 frames aprox

// Cargar imágenes
const loadedBackgrounds = backgrounds.map(bg => {
    const img = new Image();
    img.src = bg.src;
    return { ...bg, img: img };
});


// --- LÓGICA DEL JUEGO (RECONSTRUIDA) ---

class Player {
    constructor() {
        this.width = 60;
        this.height = 110; // Increased from 90
        this.x = 100;
        this.y = canvas.height - this.height - 20;
        this.dy = 0;
        this.jumpForce = 12; // Reduced from 15 (User Request: Jump less)
        this.originalHeight = 110; // Increased from 90
        this.grounded = true;
        this.jumpTimer = 0;
        this.ducking = false;

        // Imagen (usar placeholder o color si no carga)
        this.img = document.getElementById('pedroFaceImg');
        // Fallback color si la imagen no existe o falla
        this.color = '#00f3ff';
    }

    animate() {
        // Fast Drop Logic
        if (keys['ArrowDown'] && !this.grounded) {
            this.dy += 4; // STRONG downward force
        }

        // Salto
        if (keys['Space'] || keys['ArrowUp'] || keys['click']) {
            this.jump();
        } else {
            this.jumpTimer = 0;
        }

        // Agacharse
        if (keys['ArrowDown'] || keys['ShiftLeft']) {
            this.height = this.originalHeight / 2;
            this.ducking = true;
        } else {
            this.height = this.originalHeight;
            this.ducking = false;
        }

        this.y += this.dy;

        // Gravedad
        if (this.y + this.height < canvas.height - 20) {
            this.dy += 1; // Gravedad
            this.grounded = false;
        } else {
            this.dy = 0;
            this.grounded = true;
            this.y = canvas.height - this.height - 20;
        }

        this.draw();
    }

    jump() {
        if (this.grounded && this.jumpTimer === 0) {
            this.jumpTimer = 1;
            this.dy = -this.jumpForce;
        } else if (this.jumpTimer > 0 && this.jumpTimer < 15) {
            this.jumpTimer++;
            this.dy = -this.jumpForce - (this.jumpTimer / 50);
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        // Si la imagen está cargada y es válida, dibujarla
        if (this.img && this.img.complete && this.img.naturalWidth !== 0) {
            ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
        } else {
            // Rectángulo placeholder azul neón
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            // Detalles simples cara
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x + 15, this.y + 10, 10, 10);
            ctx.fillRect(this.x + 35, this.y + 10, 10, 10);
            ctx.fillStyle = '#000'; // Traje
            ctx.fillRect(this.x, this.y + this.height - 30, this.width, 30);
        }
    }
}

class Obstacle {
    constructor(gameSpeed) {
        this.w = 50 + Math.random() * 30; // Ancho variable
        this.h = 50 + Math.random() * 50; // Alto variable
        this.x = canvas.width + this.w;
        this.y = canvas.height - this.h - 20;
        this.passed = false; // Flag for scoring

        // Type: 0 = Caja Ábalos (Suelo), 1 = Pájaro/Volador Ábalos (Requiere agacharse)
        this.type = Math.random() < 0.3 ? 1 : 0;

        if (this.type === 1) { // Volador (Ábalos con alas)
            // Altura para obligar a agacharse (cerca de la cabeza del jugador)
            // Jugador height es 90, agachado es 45. 
            // Y jugador base es canvas.height - 90 - 20 (aprox 440)
            // Y agachado es canvas.height - 45 - 20.
            // Obstáculo debe estar bajo para golpear cabeza pero alto para saltar por debajo? 
            // No, "agacharse" implica que el obstáculo viene alto.
            // Ponerlo a la altura de la cabeza del jugador de pie.
            // User requested "un poco mas abajo" (a bit lower) to ensure collision.
            // User requested "un poco mas abajo" (a bit lower) to ensure collision.
            // User Update: "mas arriba aun" -> Higher altitude (lower Y value)
            // User Update: "mas arriba aun" -> Higher altitude (lower Y value)
            // LATEST Update: "que bajen mas" -> Start lower (higher Y value) and move more
            this.y = canvas.height - 280; // Higher start so oscillation reaches ground
            this.w = 60;

            this.h = 60;
        }

        this.initialY = this.y; // Store base Y for oscillation or limits
        this.oscillationSpeed = Math.random() * 2 + 3; // Constant vertical speed
        this.direction = Math.random() < 0.5 ? 1 : -1; // Random starting direction

        // Set speed: Flying enemies are 50% faster
        if (this.type === 1) {
            this.dx = gameSpeed * 1.5;
        } else {
            this.dx = gameSpeed;
        }

        // Imagen (placeholder)
        this.img = document.getElementById('abalosFaceImg');
    }

    update() {
        this.x -= this.dx;

        // Add Movement
        if (this.type === 1) {
            // Flying: Linear Vertical Movement (Top to Bottom)
            this.y += this.oscillationSpeed * this.direction;

            // Reverse at boundaries
            if (this.y < 50 || this.y > canvas.height - this.h - 20) {
                this.direction *= -1;
            }
        }

        this.draw();
        this.dx = gameSpeed;
    }

    draw() {
        if (this.type === 0) { // Ground enemy
            if (!aquaticMode) {
                // Normal mode: Ábalos (Suelo)
                if (this.img && this.img.complete && this.img.naturalWidth !== 0) {
                    ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
                } else {
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(this.x, this.y, this.w, this.h);
                }
            } else {
                // Aquatic mode: Shark image (TIBURON.png)
                // "que en el modo acuatico las fotos sean mas gradnes"
                const tiburonImg = new Image();
                tiburonImg.src = 'TIBURON.png';

                if (tiburonImg.complete && tiburonImg.naturalWidth !== 0) {
                    // Draw 60% larger centered
                    const scale = 1.6;
                    const w = this.w * scale;
                    const h = this.h * scale;
                    const x = this.x - (w - this.w) / 2;
                    const y = this.y - (h - this.h) / 2;
                    ctx.drawImage(tiburonImg, x, y, w, h);
                } else {
                    // Fallback: draw placeholder if image not loaded
                    ctx.fillStyle = '#0088cc';
                    ctx.fillRect(this.x, this.y, this.w, this.h);
                }
            }

        } else { // Flying enemy
            if (!aquaticMode) {
                // Normal mode: Ábalos Volador con Alas
                ctx.save();
                ctx.translate(this.x + this.w / 2, this.y + this.h / 2);

                // Aleteo simple basado en frames o posición
                const flap = Math.sin(Date.now() / 100) * 10;

                ctx.fillStyle = 'white';
                ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                ctx.shadowBlur = 10;

                // Ala Izquierda
                ctx.beginPath();
                ctx.moveTo(-20, 0);
                ctx.quadraticCurveTo(-50, -30 + flap, -80, -10 + flap);
                ctx.quadraticCurveTo(-50, 10, -20, 10);
                ctx.fill();

                // Ala Derecha
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.quadraticCurveTo(50, -30 + flap, 80, -10 + flap);
                ctx.quadraticCurveTo(50, 10, 20, 10);
                ctx.fill();

                ctx.restore();

                // Cara Ábalos (Roja/Imagen)
                if (this.img && this.img.complete && this.img.naturalWidth !== 0) {
                    ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
                } else {
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(this.x, this.y, this.w, this.h);
                }
            } else {
                // Aquatic mode: Orca image (ORCA.png)
                // "que en el modo acuatico las fotos sean mas gradnes"
                const orcaImg = new Image();
                orcaImg.src = 'ORCA.png';

                if (orcaImg.complete && orcaImg.naturalWidth !== 0) {
                    // Draw 60% larger centered
                    const scale = 1.6;
                    const w = this.w * scale;
                    const h = this.h * scale;
                    const x = this.x - (w - this.w) / 2;
                    const y = this.y - (h - this.h) / 2;
                    ctx.drawImage(orcaImg, x, y, w, h);
                } else {
                    // Fallback: draw placeholder if image not loaded
                    ctx.fillStyle = '#1a5f7a';
                    ctx.fillRect(this.x, this.y, this.w, this.h);
                }
            }
        }
    }
}

// Variables instanciadas
let player;
let spawnTimer = 0;
let initialSpawnTimer = 150; // Reduced for even tighter spacing between obstacles
let keys = {};

// Event Listeners
window.addEventListener('keydown', function (e) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) > -1) {
        e.preventDefault();
    }

    // Final Message Screen Reset
    const finalScreen = document.getElementById('finalMessageScreen');
    if (finalScreen && finalScreen.style.display === 'flex' && e.code === 'Space') {
        window.location.reload();
        return;
    }

    keys[e.code] = true;
    if (keys['Space'] || keys['ArrowUp']) {
        if (gameOver) {
            resetGame();
            return;
        }

        // Iniciar juego si no ha empezado
        if (!gameStarted && currentUser && !isTransitioning) {
            // Safety check: if boss mode is active, do not start normal loop
            if (bossMode) return;

            gameStarted = true;
            stopFallingImages(); // STOP images when playing
            startInstruction.style.display = 'none';
            scoreDisplay.style.display = 'block';
            highScoreDisplay.style.display = 'block';
            lastCelebrationScore = 0;
            requestAnimationFrame(Update);
        }
    }
});

window.addEventListener('keyup', function (e) {
    keys[e.code] = false;

    // God Mode Toggle (H)
    if (e.code === 'KeyH') {
        godMode = !godMode;
        console.log('God Mode:', godMode);
        // Optional: Add visual feedback
        const feedback = document.createElement('div');
        feedback.className = 'minimal-aquatic-notification';
        feedback.innerText = godMode ? 'GOD MODE ACTIVADO' : 'GOD MODE DESACTIVADO';
        feedback.style.color = godMode ? '#ffd700' : '#ff3b30';
        document.body.appendChild(feedback);
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => feedback.remove(), 500);
        }, 1500);
    }
});



// Soporte táctil / clic
canvas.addEventListener('touchstart', () => { keys['click'] = true; });
canvas.addEventListener('touchend', () => { keys['click'] = false; });
canvas.addEventListener('mousedown', () => {
    keys['click'] = true;
    if (!gameStarted && currentUser && !isTransitioning) {
        if (bossMode) return;
        gameStarted = true;
        stopFallingImages(); // STOP images when playing
        startInstruction.style.display = 'none';
        scoreDisplay.style.display = 'block';
        highScoreDisplay.style.display = 'block';
        lastCelebrationScore = 0;

        // Achievement: First Game
        unlockAchievement('firstGame', 'achievement-1', 'Primera Partida');

        requestAnimationFrame(Update);
    }
});
canvas.addEventListener('mouseup', () => { keys['click'] = false; });

if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        resetGame();
    });
}


function drawStartScreen() {
    // Limpiar
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar fondo (Imagen actual)
    drawBackground();

    // Dibujar Texto
    ctx.textAlign = 'center';

    // Apple Style Typography
    // Pedro Sánchez - Cyan/Blue-ish
    ctx.fillStyle = '#0a84ff';
    ctx.font = '800 60px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
    ctx.shadowColor = "rgba(10, 132, 255, 0.4)";
    ctx.shadowBlur = 30;
    ctx.fillText("PEDRO SÁNCHEZ", canvas.width / 2, canvas.height / 2 - 40);

    // VS - Secondary
    ctx.fillStyle = '#8e8e93';
    ctx.font = 'italic 700 40px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillText("VS", canvas.width / 2, canvas.height / 2 + 10);

    // Ábalos - Red/Pink
    ctx.fillStyle = '#ff453a';
    ctx.font = '800 60px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
    ctx.shadowColor = "rgba(255, 69, 58, 0.4)";
    ctx.shadowBlur = 30;
    ctx.fillText("ÁBALOS", canvas.width / 2, canvas.height / 2 + 70);

    // Reset shadow
    ctx.shadowBlur = 0;
}

function initGame() {
    createParticles();
    if (highScoreElement) highScoreElement.innerText = highScore;
    updateLeaderboard();

    player = new Player();
    drawStartScreen(); // Dibujar pantalla de inicio
    // No iniciar loop hasta que usuario presione tecla
}

function spawnObstacle() {
    spawnTimer--;
    if (spawnTimer <= 0) {
        obstacles.push(new Obstacle(gameSpeed));
        spawnTimer = initialSpawnTimer - gameSpeed * 8;

        if (spawnTimer < 25) {
            spawnTimer = 25;
        }
    }
}

function drawBackground() {
    const bg = loadedBackgrounds[currentBackgroundIndex];
    if (bg.img && bg.img.complete && bg.img.naturalWidth !== 0) {
        // Dibujar imagen cover con overlay oscuro para legibilidad
        ctx.globalAlpha = 0.6;
        ctx.drawImage(bg.img, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;

        // Darken overlay
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // Dibujar gradiente fallback
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#1c1c1e');
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function Update() {
    // CRITICAL FIX: If we are transitioning, STOP EVERYTHING.
    // Even if input handler sets gameStarted=true, we force it back to false here.
    if (isTransitioning) {
        gameStarted = false;
        return;
    }

    if (!gameStarted) return;
    if (bossMode) return; // Prevent running normal loop if boss mode is active

    animationId = requestAnimationFrame(Update);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo (Fallback o Imagen)
    backgroundChangeTimer++;
    if (backgroundChangeTimer > BACKGROUND_CHANGE_INTERVAL) {
        currentBackgroundIndex = (currentBackgroundIndex + 1) % loadedBackgrounds.length;
        backgroundChangeTimer = 0;
    }

    drawBackground();

    // Lógica Juego
    spawnObstacle();

    player.animate();

    // Obstáculos
    for (let i = 0; i < obstacles.length; i++) {
        let o = obstacles[i];
        o.update();

        // Eliminar si sale de pantalla
        if (o.x + o.w < 0) {
            obstacles.splice(i, 1);
            i--; // ajustar índice
        }

        // Puntuación: +1 por obstáculo superado
        if (!o.passed && player.x > o.x + o.w) {
            score++;
            scoreElement.innerText = score;
            o.passed = true;

            // Activar modo acuático a los 20 puntos
            if (score === 20 && !aquaticMode) {
                aquaticMode = true;
                // Mostrar transición breve
                showAquaticTransition();
            }

            // === BOSS MODE AT 60 POINTS ===
            if (score === 60 && !bossMode) {
                showExplosion(() => {
                    enterBossMode();
                });
                return; // Stop the runner loop
            }
        }

        // Colisión simple AABB
        if (
            player.x < o.x + o.w &&
            player.x + player.width > o.x &&
            player.y < o.y + o.h &&
            player.y + player.height > o.y
        ) {
            // Ajuste hitbox para ser más generoso
            const hitboxPad = 10;
            if (
                player.x + hitboxPad < o.x + o.w - hitboxPad &&
                player.x + player.width - hitboxPad > o.x + hitboxPad &&
                player.y + hitboxPad < o.y + o.h - hitboxPad &&
                player.y + player.height - hitboxPad > o.y + hitboxPad
            ) {
                if (!godMode) {
                    GameOver();
                }
            }
        }
    }

    // Aceleración gradual
    gameSpeed += 0.0005;
}

function GameOver() {
    gameOver = true;
    gameStarted = false;
    cancelAnimationFrame(animationId);

    // Guardar High Score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('pedroVsAbalosHighScore', highScore);
        highScoreElement.innerText = highScore;
    }

    finalScoreElement.innerText = score;

    // Guardar en tabla global
    saveGlobalScore(currentUser, score);

    gameOverScreen.style.display = 'flex';
    startFallingImages(); // RESUME images on Game Over
}

function resetGame() {
    gameOver = false;
    score = 0;
    scoreElement.innerText = 0;
    gameSpeed = 7; // Reset speed to new start speed
    obstacles = [];
    spawnTimer = initialSpawnTimer;
    gameOverScreen.style.display = 'none';
    aquaticMode = false; // Reset aquatic mode

    // Reset boss mode
    bossMode = false;
    isTransitioning = false;
    fireballs = [];
    bossFireballInterval = 60;
    if (bossTimerElement) bossTimerElement.style.display = 'none';

    // Reiniciar jugador
    player = new Player();

    // Iniciar juego inmediatamente
    gameStarted = true;
    startInstruction.style.display = 'none';
    scoreDisplay.style.display = 'block';
    highScoreDisplay.style.display = 'block';
    stopFallingImages();
    lastCelebrationScore = 0;
    requestAnimationFrame(Update);
}

function showCelebration(imageSrc = null, duration = 2000) {
    const overlay = document.getElementById('celebrationOverlay');
    const image = document.getElementById('celebrationImage');

    if (!overlay) return;

    if (imageSrc && image) {
        image.src = imageSrc;
    }

    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.style.display = 'none';
    }, duration);
}

function showAquaticTransition() {
    // Minimalist Aquatic Notification
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;

    // Create container if it doesn't exist (though we usually append to body/container)
    // We'll append to the game container parent for relative positioning or body fixed.

    const notification = document.createElement('div');
    notification.className = 'minimal-aquatic-notification';
    notification.innerHTML = '⚡ MODO ACUÁTICO ACTIVADO ⚡';

    document.body.appendChild(notification);

    // Achievement: Aquatic Mode
    unlockAchievement('aquaticMode', 'achievement-2', 'Explorador Acuático');

    // Fade out and remove
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 2000);
}

// === BOSS MODE FUNCTIONS ===

function showExplosion(callback) {
    cancelAnimationFrame(animationId);
    gameStarted = false;
    isTransitioning = true; // Block input during explosion
    obstacles = []; // Clear any remaining obstacles
    if (player) {
        player.dy = 0; // Stop player physics
    }

    const explosionDuration = 1500;
    const startTime = Date.now();
    const particles = [];

    // Create explosion particles
    for (let i = 0; i < 100; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20,
            size: Math.random() * 20 + 10,
            color: ['#ff4500', '#ff6600', '#ffaa00', '#ffff00', '#ffffff'][Math.floor(Math.random() * 5)],
            alpha: 1
        });
    }

    function animateExplosion() {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / explosionDuration;

        // Flash effect
        if (progress < 0.1) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw particles
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.alpha = 1 - progress;
                p.size *= 0.98;

                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;

            // Text
            ctx.fillStyle = '#ff4500';
            ctx.font = 'bold 60px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 30;
            ctx.fillText('¡MODO JEFE!', canvas.width / 2, canvas.height / 2);
            ctx.shadowBlur = 0;
        }

        if (elapsed < explosionDuration) {
            requestAnimationFrame(animateExplosion);
        } else {
            if (callback) callback();
        }
    }

    animateExplosion();
}

function enterBossMode() {
    bossMode = true;
    obstacles = [];
    fireballs = [];

    // Position boss at top center
    bossX = canvas.width / 2 - bossWidth / 2;
    bossY = 30;

    // Position player at bottom center
    freeRoamPlayerX = canvas.width / 2 - freeRoamPlayerWidth / 2;
    freeRoamPlayerY = canvas.height - freeRoamPlayerHeight - 50;

    bossFireballTimer = 0;
    bossImg = bossImagePreload;

    // Initialize flame particles
    flameParticles = [];
    for (let i = 0; i < 30; i++) {
        flameParticles.push({
            x: Math.random() * canvas.width,
            y: canvas.height - Math.random() * 100,
            size: Math.random() * 30 + 20,
            speed: Math.random() * 2 + 1,
            flicker: Math.random() * Math.PI
        });
    }

    gameStarted = true;
    isTransitioning = false; // Allow input again
    bossStartTime = Date.now(); // Record start time

    // Show timer
    if (bossTimerElement) {
        bossTimerElement.style.display = 'block';
        bossTimerElement.innerText = "10.00";
        bossTimerElement.classList.remove('danger');
    }

    // Achievement: Boss Mode
    unlockAchievement('bossMode', 'achievement-3', 'Enfrentamiento Final');

    requestAnimationFrame(UpdateBossMode);
}

function UpdateBossMode() {
    if (!gameStarted || !bossMode) return;

    animationId = requestAnimationFrame(UpdateBossMode);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw boss arena
    drawBossArena();

    // Handle player movement (WASD / Arrows)
    handleFreeRoamMovement();

    // Draw player
    drawFreeRoamPlayer();

    // Boss AI - shoot fireballs
    bossFireballTimer++;
    if (bossFireballTimer >= bossFireballInterval) {
        spawnFireball();
        bossFireballTimer = 0;
        // Speed up as time goes on
        if (bossFireballInterval > 30) {
            bossFireballInterval -= 1;
        }
    }

    // Update and draw fireballs
    updateFireballs();

    // Draw boss
    drawBoss();

    // Check collisions
    checkFireballCollision();

    // Check for victory (15 seconds survival)
    const elapsedTime = Date.now() - bossStartTime;
    const remainingTime = Math.max(0, BOSS_SURVIVAL_TIME - elapsedTime);

    // Update Timer Display
    if (bossTimerElement) {
        const seconds = (remainingTime / 1000).toFixed(2);
        bossTimerElement.innerText = seconds;

        if (remainingTime < 5000) {
            bossTimerElement.classList.add('danger');
        }
    }

    if (elapsedTime >= BOSS_SURVIVAL_TIME) {
        BossVictory();
    }
}

function drawBossArena() {
    // Night sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, '#0a0a1a');
    skyGradient.addColorStop(0.5, '#1a1a2e');
    skyGradient.addColorStop(1, '#16213e');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
        const x = (i * 37) % canvas.width;
        const y = (i * 23) % (canvas.height / 2);
        const size = (i % 3) + 1;
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 500 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Green field at bottom
    const fieldGradient = ctx.createLinearGradient(0, canvas.height - 150, 0, canvas.height);
    fieldGradient.addColorStop(0, '#1a4d1a');
    fieldGradient.addColorStop(1, '#0d260d');
    ctx.fillStyle = fieldGradient;
    ctx.fillRect(0, canvas.height - 150, canvas.width, 150);

    // Grass texture lines
    ctx.strokeStyle = '#2d5a2d';
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, canvas.height - 150);
        ctx.lineTo(i + 10, canvas.height - 130);
        ctx.stroke();
    }

    // Animated flames on sides
    flameParticles.forEach((flame, index) => {
        flame.flicker += 0.1;
        const flicker = Math.sin(flame.flicker) * 10;

        // Left side flames
        const leftGradient = ctx.createRadialGradient(
            flame.x % 100, flame.y + flicker, 0,
            flame.x % 100, flame.y + flicker, flame.size
        );
        leftGradient.addColorStop(0, 'rgba(255, 200, 0, 0.8)');
        leftGradient.addColorStop(0.4, 'rgba(255, 100, 0, 0.6)');
        leftGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = leftGradient;
        ctx.beginPath();
        ctx.arc(flame.x % 100, flame.y + flicker - flame.speed * 10, flame.size, 0, Math.PI * 2);
        ctx.fill();

        // Right side flames
        const rightGradient = ctx.createRadialGradient(
            canvas.width - (flame.x % 100), flame.y + flicker, 0,
            canvas.width - (flame.x % 100), flame.y + flicker, flame.size
        );
        rightGradient.addColorStop(0, 'rgba(255, 200, 0, 0.8)');
        rightGradient.addColorStop(0.4, 'rgba(255, 100, 0, 0.6)');
        rightGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = rightGradient;
        ctx.beginPath();
        ctx.arc(canvas.width - (flame.x % 100), flame.y + flicker - flame.speed * 10, flame.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function handleFreeRoamMovement() {
    // WASD or Arrow keys
    if (keys['KeyW'] || keys['ArrowUp']) {
        freeRoamPlayerY -= freeRoamPlayerSpeed;
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
        freeRoamPlayerY += freeRoamPlayerSpeed;
    }
    if (keys['KeyA'] || keys['ArrowLeft']) {
        freeRoamPlayerX -= freeRoamPlayerSpeed;
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
        freeRoamPlayerX += freeRoamPlayerSpeed;
    }

    // Boundary checks
    if (freeRoamPlayerX < 0) freeRoamPlayerX = 0;
    if (freeRoamPlayerX > canvas.width - freeRoamPlayerWidth) freeRoamPlayerX = canvas.width - freeRoamPlayerWidth;
    if (freeRoamPlayerY < canvas.height / 2) freeRoamPlayerY = canvas.height / 2; // Can't go too high
    if (freeRoamPlayerY > canvas.height - freeRoamPlayerHeight - 20) freeRoamPlayerY = canvas.height - freeRoamPlayerHeight - 20;
}

function drawFreeRoamPlayer() {
    const playerImg = document.getElementById('pedroFaceImg');
    if (playerImg && playerImg.complete && playerImg.naturalWidth !== 0) {
        ctx.drawImage(playerImg, freeRoamPlayerX, freeRoamPlayerY, freeRoamPlayerWidth, freeRoamPlayerHeight);
    } else {
        // Fallback
        ctx.fillStyle = '#00f3ff';
        ctx.fillRect(freeRoamPlayerX, freeRoamPlayerY, freeRoamPlayerWidth, freeRoamPlayerHeight);
    }

    // Glow effect
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(freeRoamPlayerX - 2, freeRoamPlayerY - 2, freeRoamPlayerWidth + 4, freeRoamPlayerHeight + 4);
    ctx.shadowBlur = 0;
}

function drawBoss() {
    // Boss glow
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 30;

    if (bossImg && bossImg.complete && bossImg.naturalWidth !== 0) {
        ctx.drawImage(bossImg, bossX, bossY, bossWidth, bossHeight);
    } else {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(bossX, bossY, bossWidth, bossHeight);
    }

    ctx.shadowBlur = 0;

    // Boss border
    ctx.strokeStyle = '#ff4500';
    ctx.lineWidth = 4;
    ctx.strokeRect(bossX - 3, bossY - 3, bossWidth + 6, bossHeight + 6);

    // "JEFE FINAL" label
    ctx.fillStyle = '#ff4500';
    ctx.font = 'bold 16px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JEFE FINAL', bossX + bossWidth / 2, bossY - 10);
}

function spawnFireball() {
    // Aim toward player
    const startX = bossX + bossWidth / 2;
    const startY = bossY + bossHeight;

    const targetX = freeRoamPlayerX + freeRoamPlayerWidth / 2;
    const targetY = freeRoamPlayerY + freeRoamPlayerHeight / 2;

    const angle = Math.atan2(targetY - startY, targetX - startX);
    const speed = 3; // Slower fireballs (User Request: reduced from 5)

    fireballs.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 20
    });
}

function updateFireballs() {
    for (let i = fireballs.length - 1; i >= 0; i--) {
        const fb = fireballs[i];
        fb.x += fb.vx;
        fb.y += fb.vy;

        // Draw fireball
        const gradient = ctx.createRadialGradient(fb.x, fb.y, 0, fb.x, fb.y, fb.size);
        gradient.addColorStop(0, '#ffff00');
        gradient.addColorStop(0.3, '#ff8800');
        gradient.addColorStop(0.7, '#ff4400');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(fb.x, fb.y, fb.size, 0, Math.PI * 2);
        ctx.fill();

        // Trail effect
        ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(fb.x - fb.vx, fb.y - fb.vy, fb.size * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Remove if off screen
        if (fb.x < -50 || fb.x > canvas.width + 50 || fb.y < -50 || fb.y > canvas.height + 50) {
            fireballs.splice(i, 1);
        }
    }
}

function checkFireballCollision() {
    const playerCenterX = freeRoamPlayerX + freeRoamPlayerWidth / 2;
    const playerCenterY = freeRoamPlayerY + freeRoamPlayerHeight / 2;
    const playerRadius = Math.min(freeRoamPlayerWidth, freeRoamPlayerHeight) / 2 - 5; // Generous hitbox

    for (const fb of fireballs) {
        const dist = Math.sqrt((fb.x - playerCenterX) ** 2 + (fb.y - playerCenterY) ** 2);
        if (dist < playerRadius + fb.size - 5) {
            // HIT! Game Over
            if (!godMode) {
                BossGameOver();
            }
            return;
        }
    }
}

function BossGameOver() {
    gameOver = true;
    gameStarted = false;
    bossMode = false;
    cancelAnimationFrame(animationId);
    if (bossTimerElement) bossTimerElement.style.display = 'none';

    // Show game over with special boss message
    finalScoreElement.innerText = score + ' (¡Derrotado por el Jefe!)';

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('pedroVsAbalosHighScore', highScore);
        highScoreElement.innerText = highScore;
    }

    saveGlobalScore(currentUser, score);
    gameOverScreen.style.display = 'flex';
    startFallingImages();
}

function BossVictory() {
    gameOver = false; // Not a game over, it's a victory!
    gameStarted = false;
    bossMode = false;
    cancelAnimationFrame(animationId);
    if (bossTimerElement) bossTimerElement.style.display = 'none';

    // Achievement: Game Complete
    unlockAchievement('gameComplete', 'achievement-4', 'Héroe de España');

    // Show victory screen
    const victoryScreen = document.getElementById('bossVictoryScreen');
    const victoryVideo = document.getElementById('victoryVideo');
    const continueBtn = document.getElementById('victoryContinueBtn');

    if (victoryScreen) {
        victoryScreen.style.display = 'flex';
    }

    // Play video
    if (victoryVideo) {
        victoryVideo.currentTime = 0;
        victoryVideo.play().catch(e => console.log('Video play error:', e));
    }

    // Continue button handler
    if (continueBtn) {
        continueBtn.onclick = () => {
            victoryScreen.style.display = 'none';

            // Save score with victory message
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('pedroVsAbalosHighScore', highScore);
                highScoreElement.innerText = highScore;
            }

            finalScoreElement.innerText = score + ' (¡Victoria contra el Jefe!)';
            saveGlobalScore(currentUser, score);

            // Show Final Message Screen
            const finalMessageScreen = document.getElementById('finalMessageScreen');
            if (finalMessageScreen) {
                finalMessageScreen.style.display = 'flex';
            } else {
                // Fallback if not found
                gameOver = true;
                gameOverScreen.style.display = 'flex';
                startFallingImages();
            }
        };
    }
}

// Iniciar
initUserModal();
createParticles();
startFallingImages();
loadAchievements(); // Load saved achievements
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // init size

// Cat button achievement
const catButton = document.querySelector('#cat-button-container a');
if (catButton) {
    catButton.addEventListener('click', () => {
        unlockAchievement('secretButton', 'achievement-5', 'Descubridor Secreto');
    });
}

// Pichula Button Logic
const pichulaBtn = document.getElementById('pichula-btn');
if (pichulaBtn) {
    pichulaBtn.addEventListener('click', () => {
        unlockAchievement('pichula', 'achievement-6', 'Pichula Encontrada');
        showCelebration('sanchez-zoom-interior.jpg', 4000); // Show image
    });
}


// --- FALLING IMAGES ANIMATION ---
function startFallingImages() {
    // Prevent duplicates
    if (fallingImageIntervals.length > 0) return;

    const container = document.createElement('div');
    container.className = 'falling-images-container';
    document.body.appendChild(container);

    // 2 columns left, 2 columns right
    // Left: 2%, 12%
    // Right: 80%, 90%
    const positions = [2, 12, 80, 90];

    positions.forEach(pos => {
        // Start a cycle for each position with random offsets
        const intervalId = setInterval(() => {
            spawnFallingImage(container, pos);
        }, 3000 + Math.random() * 2000); // Every 3-5 seconds

        fallingImageIntervals.push(intervalId);

        // Initial spawn
        setTimeout(() => spawnFallingImage(container, pos), Math.random() * 3000);
    });
}

function stopFallingImages() {
    // Clear all intervals
    fallingImageIntervals.forEach(clearInterval);
    fallingImageIntervals = [];

    // Remove container
    const container = document.querySelector('.falling-images-container');
    if (container) {
        container.remove();
    }
}

function spawnFallingImage(container, leftPercent) {
    const img = document.createElement('img');
    img.src = fallingImagesList[Math.floor(Math.random() * fallingImagesList.length)];
    img.className = 'falling-image';
    img.style.left = leftPercent + '%';

    // Random speed
    const duration = 5 + Math.random() * 5; // 5-10 seconds to fall
    img.style.transition = `top ${duration}s linear`;

    container.appendChild(img);

    // Trigger animation
    requestAnimationFrame(() => {
        img.style.top = '110vh'; // Fall below screen
    });

    // Cleanup
    setTimeout(() => {
        img.remove();
    }, duration * 1000);
}

// --- SIMPSONS INTRO SEQUENCE ---
// --- VIDEO INTRO WITH CENTERED LOADING BAR ---
function runIntroSequence() {
    const introScreen = document.getElementById('intro-screen');
    const loadingBar = document.querySelector('.loading-bar-fill');
    const percentageText = document.querySelector('.loading-percentage');

    if (!introScreen) {
        initGame();
        return;
    }

    document.body.classList.add('intro-active');

    // Play video
    const video = document.getElementById('intro-video');
    if (video) {
        video.play().catch(e => console.log("Auto-play prevented", e));
    }

    // Ensure Game Background is visible behind
    if (!gameStarted) {
        drawStartScreen();
    }

    // Animate Loading Bar (0% -> 100% over 5 seconds)
    let width = 0;
    const duration = 5000;
    const intervalTime = 50;
    const step = 100 / (duration / intervalTime);

    const loadingInterval = setInterval(() => {
        width += step;

        // Update percentage text
        let currentPercent = Math.min(100, Math.round(width));
        if (percentageText) percentageText.textContent = currentPercent + "%";

        if (width >= 100) {
            width = 100;
            clearInterval(loadingInterval);

            // Finished Loading
            setTimeout(() => {
                introScreen.style.opacity = '0';
                introScreen.style.transition = 'opacity 0.5s ease';

                setTimeout(() => {
                    introScreen.style.display = 'none';
                    document.body.classList.remove('intro-active');

                    // Show Disclaimer AFTER Intro
                    showDisclaimer();
                }, 500);
            }, 300);
        }

        if (loadingBar) loadingBar.style.width = width + '%';

    }, intervalTime);
}

// --- GUIDE MODAL LOGIC ---
function initGuideModal() {
    const guideBtn = document.getElementById('guide-btn');
    const guideModal = document.getElementById('guideModal');
    const closeGuideBtn = document.getElementById('closeGuideBtn');

    if (guideBtn && guideModal) {
        guideBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            guideModal.style.display = 'flex';
            // Trigger reflow
            void guideModal.offsetWidth;
            guideModal.classList.add('active');
        });
    }

    if (closeGuideBtn && guideModal) {
        closeGuideBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            guideModal.classList.remove('active');
            setTimeout(() => {
                guideModal.style.display = 'none';
            }, 300);
        });
    }

    // Close on click outside
    if (guideModal) {
        guideModal.addEventListener('click', (e) => {
            if (e.target === guideModal) {
                guideModal.classList.remove('active');
                setTimeout(() => {
                    guideModal.style.display = 'none';
                }, 300);
            }
        });
    }
}

// --- DISCLAIMER LOGIC ---
function animateSignature() {
    const signature = document.querySelector('.disclaimer-signature');
    if (signature) {
        const text = signature.innerText;
        signature.innerHTML = '';

        // Wrap each character
        for (let i = 0; i < text.length; i++) {
            const span = document.createElement('span');
            span.innerText = text[i];

            // Add space handling
            if (text[i] === ' ') {
                span.style.width = '20px'; // spacing
            }

            // Stagger animation
            span.style.animationDelay = `${i * 0.1}s`;

            signature.appendChild(span);
        }
    }
}

function initDisclaimer() {
    // Animate signature on init
    animateSignature();

    const disclaimerScreen = document.getElementById('disclaimer-screen');
    const startBtn = document.getElementById('disclaimer-start-btn');

    if (startBtn && disclaimerScreen) {
        startBtn.addEventListener('click', () => {
            // Fade out disclaimer
            disclaimerScreen.style.opacity = '0';

            setTimeout(() => {
                disclaimerScreen.classList.remove('active');
                disclaimerScreen.style.display = 'none';

                // NOW show user modal or start
                const userModal = document.getElementById('userModal');
                if (userModal && !currentUser) {
                    userModal.style.display = 'flex';
                } else {
                    // If user already logged in (persistence), maybe just show start instruction?
                    startGameAfterLogin();
                }

                initGuideModal();
            }, 500);
        });
    }
}

function showDisclaimer() {
    const disclaimerScreen = document.getElementById('disclaimer-screen');
    if (disclaimerScreen) {
        disclaimerScreen.classList.add('active');
    }
}

// Start Game Flow on Load
window.addEventListener('load', () => {
    // Start with Intro
    initDisclaimer(); // Setup listeners
    initGuideModal(); // Setup guide listeners
    initUserModal();  // Setup login listeners (FIXED: Was missing)
    loadAchievements(); // Load local achievements as backup
    runIntroSequence();
});

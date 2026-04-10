const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const scoreValueEl = document.getElementById("scoreValue");
const timeValueEl = document.getElementById("timeValue");
const bestValueEl = document.getElementById("bestValue");
const statusLineEl = document.getElementById("statusLine");
const leaderboardListEl = document.getElementById("leaderboardList");
const leaderboardFormEl = document.getElementById("leaderboardForm");
const leaderboardNameEl = document.getElementById("leaderboardName");
const leaderboardSubmitEl = document.getElementById("leaderboardSubmit");
const leaderboardNoteEl = document.getElementById("leaderboardNote");
const jumpButtons = [...document.querySelectorAll("[data-jump]")];
const touchButtons = [...document.querySelectorAll("[data-touch]")];
const resetButton = document.getElementById("resetButton");
const bootOverlayEl = document.getElementById("bootOverlay");
const bootMessageEl = document.getElementById("bootMessage");
const bootStationTimeEl = document.getElementById("bootStationTime");
const bootSkipButtonEl = document.getElementById("bootSkipButton");
const broadcastCopyEl = document.getElementById("broadcastCopy");
const broadcastTimeEl = document.getElementById("broadcastTime");
const musicPlayerTypeEl = document.getElementById("musicPlayerType");
const musicPlayerTitleEl = document.getElementById("musicPlayerTitle");
const musicPlayerDescriptionEl = document.getElementById("musicPlayerDescription");
const winampTracklistEl = document.getElementById("winampTracklist");
const winampClockEl = document.getElementById("winampClock");
const winampLedPlayEl = document.querySelector(".winamp-led-play");
const playlistAudioEl = document.getElementById("playlistAudio");
const winampCoverEl = document.getElementById("winampCover");
const winampSeekEl = document.getElementById("winampSeek");
const winampElapsedEl = document.getElementById("winampElapsed");
const winampDurationEl = document.getElementById("winampDuration");
const winampVolumeEl = document.getElementById("winampVolume");
const transportButtons = [...document.querySelectorAll("[data-player-action]")];
const eqSliders = [...document.querySelectorAll("[data-eq-band]")];
const eqActionButtons = [...document.querySelectorAll("[data-eq-action]")];
const spectrumBars = [...document.querySelectorAll(".winamp-spectrum span")];

const SUPABASE_URL = "https://lgmfxylcqscjtndjpirf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbWZ4eWxjcXNjanRuZGpwaXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDIyOTIsImV4cCI6MjA5MTI3ODI5Mn0.F54kPiI0AR0vwkfT4okAyD1BxNafqVfljlzdUjjohg0";
const PLAYLIST_ENDPOINT =
  `${SUPABASE_URL}/rest/v1/rapcade_playlist_public?select=position,title,artist,format_label,duration_seconds,duration_label,audio_url,cover_url&order=position.asc`;
const LEADERBOARD_ENDPOINT =
  `${SUPABASE_URL}/rest/v1/cash_rain_leaderboard_public?select=rank,player_name,score,played_at&order=rank.asc`;
const LEADERBOARD_SUBMIT_ENDPOINT = `${SUPABASE_URL}/rest/v1/cash_rain_scores`;

const GRAVITY = 0.34;
const MOVE_SPEED = 2.88;
const JUMP_FORCE = -8.56;
const FRICTION = 0.8;
const MAX_FALL = 8;
const FIXED_STEP = 16.6667;
const ROUND_DURATION_MS = 60_000;
const GROUND_Y = 236;
const PLAYER_GROUND_Y = 252;
const PLAYER_RENDER_HEIGHT = 39;
const PLAYER_PADDING = 8;
const BEST_SCORE_STORAGE_KEY = "rapcade-best-score";
const BG_SOURCE_Y = 88;
const BG_SOURCE_HEIGHT = 544;
const COIN_FRAMES = 4;
const LEADERBOARD_LIMIT = 5;

const SUPABASE_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`
};

const ATMOSPHERE_PROFILES = {
  sunrise: {
    label: "SUNRISE DRIVE",
    radioCopy: "Sun-up signal for early studio runners.",
    bootCopy: "Booting the skyline for the sunrise shift.",
    skyTint: "rgba(255, 190, 124, 0.14)",
    rainTrailColor: "rgba(255, 227, 173, 0.26)",
    stars: false
  },
  day: {
    label: "DAY SHIFT",
    radioCopy: "Daylight hustle on the Rapcade frequency.",
    bootCopy: "Powering the day-shift deck and city speakers.",
    skyTint: "rgba(113, 190, 255, 0.12)",
    rainTrailColor: "rgba(193, 233, 255, 0.18)",
    stars: false
  },
  sunset: {
    label: "SUNSET STATIC",
    radioCopy: "Golden-hour traffic and late-session dreams.",
    bootCopy: "Spinning up the sunset mix for the city block.",
    skyTint: "rgba(255, 133, 102, 0.14)",
    rainTrailColor: "rgba(255, 191, 143, 0.24)",
    stars: true
  },
  night: {
    label: "NEON NIGHT",
    radioCopy: "Neon after-dark mix for studio runners.",
    bootCopy: "Charging the neon night deck and warming the tubes.",
    skyTint: "rgba(152, 72, 255, 0.14)",
    rainTrailColor: "rgba(129, 217, 255, 0.2)",
    stars: true
  },
  midnight: {
    label: "MIDNIGHT SIGNAL",
    radioCopy: "After-hours static for money runners and night owls.",
    bootCopy: "Booting the skyline for the graveyard shift.",
    skyTint: "rgba(72, 48, 145, 0.22)",
    rainTrailColor: "rgba(112, 192, 255, 0.18)",
    stars: true
  }
};

const keys = {
  left: false,
  right: false
};

let jumpQueued = false;
let statusUntil = 0;
let lastFrameTime = 0;
let accumulator = 0;
let audioContext = null;
let mediaSourceNode = null;
let analyserNode = null;
let masterGainNode = null;
let sfxGainNode = null;
let spectrumData = null;
let spectrumFrame = 0;
let eqFilters = [];
let currentTrackIndex = 0;
let isSeeking = false;
let localPlayerReady = false;
let audioUnlocked = false;
let eqEnabled = true;
let eqAutoMode = false;
let currentEqPresetIndex = 0;
let playlistTracks = [];
let leaderboardEntries = [];
let leaderboardOnline = true;
let pendingLeaderboardScore = null;
let leaderboardSubmitted = false;
let currentAtmosphere = null;
let atmosphereTimer = 0;
let requestedAutoplay = false;
let bootTimer = 0;

const player = {
  x: canvas.width / 2 - 10,
  y: PLAYER_GROUND_Y - 34,
  w: 20,
  h: 34,
  vx: 0,
  vy: 0,
  facing: 1,
  onGround: true
};

const game = {
  mode: "ready",
  score: 0,
  best: 0,
  remainingMs: ROUND_DURATION_MS,
  elapsedMs: 0,
  spawnCooldownMs: 520,
  drops: [],
  nextDropId: 1
};

const EQ_FREQUENCIES = [70, 180, 320, 600, 1000, 3000, 6000, 12000, 14000, 16000];
const EQ_PRESETS = [
  { name: "Flat", values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Street Bass", values: [6, 5, 3, 1, 0, -1, -2, -3, -3, -4] },
  { name: "Vocal Lift", values: [-2, -1, 0, 1, 2, 4, 3, 2, 1, 0] },
  { name: "Night Drive", values: [3, 2, 1, 0, 1, 2, 3, 2, 1, 0] }
];

const albumAssetBase =
  "assets/imported-album/unpacked/NASTYNASH - QUIEN DIJO QUE NO SE PUEDE [ALBUM]";
const albumCover = `${albumAssetBase}/QDQNSP COVER.png`;

const localFallbackTracks = [
  {
    position: 1,
    title: "QUIEN DIJO",
    artist: "IAM NASTY NASH",
    src: `${albumAssetBase}/1- NASTYNASH - QUIEN DIJO.wav`,
    cover: albumCover,
    format: "WAV • Album Cut",
    durationLabel: "3:33"
  },
  {
    position: 2,
    title: "OVERTHINKING",
    artist: "IAM NASTY NASH",
    src: `${albumAssetBase}/2- NASTYNASH - OVERTHINKING.wav`,
    cover: albumCover,
    format: "WAV • Album Cut",
    durationLabel: "1:46"
  },
  {
    position: 3,
    title: "VIEWS FT FRANK ROSSO",
    artist: "IAM NASTY NASH",
    src: `${albumAssetBase}/3- NASTYNASH - VIEWS FT FRANK ROSSO.wav`,
    cover: albumCover,
    format: "WAV • Album Cut",
    durationLabel: "2:58"
  },
  {
    position: 4,
    title: "LIMON",
    artist: "IAM NASTY NASH",
    src: `${albumAssetBase}/4- NASTYNASH - LIMON.wav`,
    cover: albumCover,
    format: "WAV • Album Cut",
    durationLabel: "2:47"
  },
  {
    position: 5,
    title: "I WONDER",
    artist: "IAM NASTY NASH",
    src: `${albumAssetBase}/5- NASTYNASH - I WONDER.wav`,
    cover: albumCover,
    format: "WAV • Album Cut",
    durationLabel: "3:12"
  },
  {
    position: 6,
    title: "LA CULPA",
    artist: "IAM NASTY NASH",
    src: `${albumAssetBase}/6- NASTYNASH - LA CULPA.wav`,
    cover: albumCover,
    format: "WAV • Album Cut",
    durationLabel: "2:44"
  },
  {
    position: 7,
    title: "MILLONARIO",
    artist: "IAM NASTY NASH",
    src: `${albumAssetBase}/7- NASTYNASH - MILLONARIO.wav`,
    cover: albumCover,
    format: "WAV • Album Cut",
    durationLabel: "1:52"
  },
  {
    position: 8,
    title: "I HAD TO",
    artist: "IAM NASTY NASH",
    src: `${albumAssetBase}/8- NASTYNASH - I HAD TO.wav`,
    cover: albumCover,
    format: "WAV • Album Cut",
    durationLabel: "3:33"
  },
  {
    position: 9,
    title: "QUIEN DIJO KE NO SE PUEDE [TRAP REMIX]",
    artist: "IAM NASTY NASH",
    src: "assets/audio/quien-dijo-trap-remix.mp3",
    cover: "assets/covers/quien-dijo-trap-remix-cover.png",
    format: "MP3 • 64 kbps • 44.1 kHz • stereo",
    durationLabel: "4:00"
  },
  {
    position: 10,
    title: "PA LOKO [REMIX]",
    artist: "IAM NASTY NASH",
    src: "assets/audio/pa-loko-remix.wav",
    cover: "assets/covers/pa-loko-cover.png",
    format: "WAV • 16-bit • 48 kHz • stereo",
    durationLabel: "2:18"
  }
];

const localTrackFallbacks = new Map(
  localFallbackTracks.map((track) => [track.position, track])
);

function createImageAsset(src) {
  const image = new Image();
  image.decoding = "async";

  const asset = {
    src,
    image,
    loaded: false,
    error: false
  };

  image.addEventListener("load", () => {
    asset.loaded = true;
  });

  image.addEventListener("error", () => {
    asset.error = true;
  });

  image.src = src;
  return asset;
}

const visualAssets = {
  background: createImageAsset("assets/game/city-background.png"),
  idle: createImageAsset("assets/nash-standing-v4-clean.png"),
  runStrip: createImageAsset("assets/game/run-strip.png"),
  jumpStrip: createImageAsset("assets/nash-jump-v3-strip.png"),
  bill: createImageAsset("assets/game/money-stack-cropped.png"),
  handcuffs: createImageAsset("assets/game/handcuffs-cropped.png"),
  coinStrip: createImageAsset("assets/game/coin-strip.png")
};

const spriteAssets = {
  idle: {
    mode: "single",
    assetKey: "idle",
    logicalWidth: 52,
    logicalHeight: 124
  },
  run: {
    mode: "sheet",
    assetKey: "runStrip",
    logicalWidth: 96,
    logicalHeight: 128,
    frames: 5,
    frameDuration: 90
  },
  jump: {
    mode: "sheet",
    assetKey: "jumpStrip",
    logicalWidth: 104,
    logicalHeight: 132,
    frames: 3,
    frameDuration: 120
  }
};

const coinSound = new Audio("assets/audio/coin-collected.wav");
coinSound.preload = "auto";

const DROP_CONFIG = {
  bill: { weight: 0.74, points: 1, width: 24, height: 16, baseSpeed: 1.2 },
  coin: { weight: 0.18, points: 2, width: 22, height: 22, baseSpeed: 1.45 },
  handcuffs: { weight: 0.08, points: 0, width: 24, height: 24, baseSpeed: 1.7 }
};

if (playlistAudioEl) {
  playlistAudioEl.crossOrigin = "anonymous";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "--:--";
  }

  const wholeSeconds = Math.floor(totalSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = String(wholeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatClockTime(date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function clearTextSelection() {
  const selection = window.getSelection?.();
  if (selection && selection.rangeCount > 0) {
    selection.removeAllRanges();
  }
}

function blockTouchDefault(event) {
  event.preventDefault();
  clearTextSelection();
}

let lastResetActivationAt = 0;

function triggerResetButton(event) {
  event?.preventDefault();
  clearTextSelection();

  const now = performance.now();
  if (now - lastResetActivationAt < 250) {
    return;
  }

  lastResetActivationAt = now;
  resetRound();
}

function getAtmosphereKey(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 11) {
    return "sunrise";
  }

  if (hour >= 11 && hour < 17) {
    return "day";
  }

  if (hour >= 17 && hour < 21) {
    return "sunset";
  }

  if (hour >= 21 || hour < 1) {
    return "night";
  }

  return "midnight";
}

function applyAtmosphere(date = new Date()) {
  const key = getAtmosphereKey(date);
  currentAtmosphere = {
    key,
    ...ATMOSPHERE_PROFILES[key]
  };

  document.body.dataset.atmosphere = key;

  if (bootMessageEl) {
    bootMessageEl.textContent = currentAtmosphere.bootCopy;
  }

  const clockLabel = formatClockTime(date);

  if (bootStationTimeEl) {
    bootStationTimeEl.textContent = clockLabel;
  }

  if (broadcastCopyEl) {
    broadcastCopyEl.textContent = currentAtmosphere.radioCopy;
  }

  if (broadcastTimeEl) {
    broadcastTimeEl.textContent = clockLabel;
  }
}

function startAtmosphereClock() {
  applyAtmosphere();

  if (atmosphereTimer) {
    window.clearInterval(atmosphereTimer);
  }

  atmosphereTimer = window.setInterval(() => {
    applyAtmosphere();
  }, 60_000);
}

function sanitizePlayerName(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9 ._-]/g, "")
    .trim()
    .slice(0, 12);
}

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function loadBestScore() {
  try {
    return Number(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function persistBestScore() {
  try {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(game.best));
  } catch {
    // Ignore storage failures.
  }
}

function showStatus(message, duration = 1800) {
  statusUntil = performance.now() + duration;
  statusLineEl.textContent = message;
}

function getDefaultStatus() {
  if (game.mode === "live") {
    return "Bills are 1, coins are 2, handcuffs bust the run.";
  }

  if (game.mode === "busted") {
    return "Handcuffs end the run. Hit reset to start all over.";
  }

  if (game.mode === "timeup") {
    return `Time. You banked ${game.score} point${game.score === 1 ? "" : "s"}. Hit reset to run it back.`;
  }

  return "Move or jump to start the one-minute money rain.";
}

function applyPersistentStatus() {
  if (performance.now() > statusUntil) {
    statusLineEl.textContent = getDefaultStatus();
  }
}

function updateHud() {
  if (scoreValueEl) {
    scoreValueEl.textContent = String(game.score);
  }

  if (timeValueEl) {
    timeValueEl.textContent = formatTime(game.remainingMs / 1000);
  }

  if (bestValueEl) {
    bestValueEl.textContent = String(game.best);
  }
}

function resetPlayer() {
  player.x = canvas.width / 2 - player.w / 2;
  player.y = PLAYER_GROUND_Y - player.h;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
}

function resetRound({ keepBest = true } = {}) {
  if (!keepBest) {
    game.best = 0;
    persistBestScore();
  }

  game.mode = "ready";
  game.score = 0;
  game.remainingMs = ROUND_DURATION_MS;
  game.elapsedMs = 0;
  game.spawnCooldownMs = 520;
  game.drops = [];
  game.nextDropId = 1;
  resetPlayer();
  updateHud();
  updateLeaderboardFormState();
  showStatus(getDefaultStatus(), 1400);
}

function startRound() {
  if (game.mode !== "ready") {
    return;
  }

  game.mode = "live";
  game.remainingMs = ROUND_DURATION_MS;
  game.elapsedMs = 0;
  game.spawnCooldownMs = 300;
  game.drops = [];
  pendingLeaderboardScore = null;
  leaderboardSubmitted = false;
  updateLeaderboardFormState();
  playUiSound("start");
  showStatus("Cash is falling. Stay clean and stack points.", 1400);
}

function finishRound(mode, message) {
  game.mode = mode;
  game.drops = [];

  if (game.score > game.best) {
    game.best = game.score;
    persistBestScore();
  }

  pendingLeaderboardScore = game.score;
  leaderboardSubmitted = false;
  updateHud();
  updateLeaderboardFormState();
  showStatus(message, 2400);

  if (mode === "busted") {
    playUiSound("bust");
  } else if (qualifiesForLeaderboard(game.score)) {
    showStatus(`Top five pace. Bank ${game.score} and tag the wall.`, 2400);
  }
}

function getDifficultyMultiplier() {
  return 1 + Math.min(1.7, game.elapsedMs / 18000);
}

function getSpawnIntervalMs() {
  return Math.max(145, 520 - game.elapsedMs * 0.0045);
}

function pickDropKind() {
  const roll = Math.random();

  if (roll < DROP_CONFIG.bill.weight) {
    return "bill";
  }

  if (roll < DROP_CONFIG.bill.weight + DROP_CONFIG.coin.weight) {
    return "coin";
  }

  return "handcuffs";
}

function spawnDrop() {
  const kind = pickDropKind();
  const config = DROP_CONFIG[kind];
  const width = config.width;
  const height = config.height;
  const margin = 20;
  const x = margin + Math.random() * (canvas.width - margin * 2);
  const wobble = (Math.random() - 0.5) * (kind === "bill" ? 0.75 : 0.35);
  const speed = config.baseSpeed * getDifficultyMultiplier() + Math.random() * 0.6;

  game.drops.push({
    id: game.nextDropId,
    kind,
    x,
    y: -height,
    w: width,
    h: height,
    vy: speed,
    drift: wobble,
    phase: Math.random() * Math.PI * 2,
    points: config.points
  });

  game.nextDropId += 1;
}

function playPickupSound() {
  try {
    const oneShot = coinSound.cloneNode();
    oneShot.volume = 0.5;
    oneShot.play().catch(() => {});
  } catch {
    // Ignore audio failures.
  }
}

function updateDrops() {
  for (let index = game.drops.length - 1; index >= 0; index -= 1) {
    const drop = game.drops[index];
    drop.y += drop.vy;
    drop.x += drop.drift + Math.sin((game.elapsedMs / 180) + drop.phase) * 0.08;

    const dropRect = {
      x: drop.x - drop.w / 2,
      y: drop.y - drop.h / 2,
      w: drop.w,
      h: drop.h
    };

    if (rectsIntersect(player, dropRect)) {
      game.drops.splice(index, 1);

      if (drop.kind === "handcuffs") {
        finishRound("busted", "Handcuffs. Reset and try the money rain again.");
        return;
      }

      game.score += drop.points;
      if (drop.kind === "coin") {
        playPickupSound();
        showStatus("+2 coin. Keep stacking.", 500);
      } else {
        playUiSound("bill");
        showStatus("+1 bill.", 380);
      }
      updateHud();
      continue;
    }

    if (drop.y - drop.h / 2 > canvas.height + 16) {
      game.drops.splice(index, 1);
    }
  }
}

function updateRound() {
  if (game.mode !== "live") {
    return;
  }

  game.elapsedMs += FIXED_STEP;
  game.remainingMs = Math.max(0, ROUND_DURATION_MS - game.elapsedMs);
  game.spawnCooldownMs -= FIXED_STEP;

  while (game.spawnCooldownMs <= 0) {
    spawnDrop();
    game.spawnCooldownMs += getSpawnIntervalMs();
  }

  updateDrops();
  updateHud();

  if (game.remainingMs <= 0) {
    finishRound(
      "timeup",
      `Time. You banked ${game.score} point${game.score === 1 ? "" : "s"}. Hit reset to run it back.`
    );
  }
}

function getPlayerAnimation() {
  if (!player.onGround) {
    return "jump";
  }

  if (Math.abs(player.vx) > 0.25) {
    return "run";
  }

  return "idle";
}

function getJumpFrameIndex() {
  const asset = spriteAssets.jump;

  if (!asset) {
    return 0;
  }

  if (player.vy < -1.4) {
    return 0;
  }

  if (player.vy < 1.2) {
    return 1;
  }

  return Math.min(asset.frames - 1, 2);
}

function updatePlayer() {
  const movementTarget =
    (keys.right ? MOVE_SPEED : 0) - (keys.left ? MOVE_SPEED : 0);
  player.vx += (movementTarget - player.vx) * 0.35;

  if (!keys.left && !keys.right) {
    player.vx *= FRICTION;
  }

  if (Math.abs(player.vx) < 0.05) {
    player.vx = 0;
  }

  if (player.vx !== 0) {
    player.facing = player.vx > 0 ? 1 : -1;
  }

  if (jumpQueued && player.onGround) {
    if (game.mode === "ready") {
      startRound();
    }
    player.vy = JUMP_FORCE;
    player.onGround = false;
    playUiSound("jump");
    showStatus("Go get it.", 550);
  }
  jumpQueued = false;

  player.x = clamp(
    player.x + player.vx,
    PLAYER_PADDING,
    canvas.width - player.w - PLAYER_PADDING
  );

  player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
  player.y += player.vy;

  if (player.y + player.h >= PLAYER_GROUND_Y) {
    player.y = PLAYER_GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }
}

function ensureAudioGraph() {
  if (localPlayerReady || !playlistAudioEl) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  audioContext = new AudioContextClass();
  mediaSourceNode = audioContext.createMediaElementSource(playlistAudioEl);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 256;
  spectrumData = new Uint8Array(analyserNode.frequencyBinCount);
  masterGainNode = audioContext.createGain();
  masterGainNode.gain.value = (Number(winampVolumeEl?.value) || 88) / 100;
  sfxGainNode = audioContext.createGain();
  sfxGainNode.gain.value = 0.12;

  eqFilters = EQ_FREQUENCIES.map((frequency, index) => {
    const filter = audioContext.createBiquadFilter();
    filter.frequency.value = frequency;
    filter.Q.value = 1.05;
    filter.gain.value = 0;
    filter.type =
      index === 0
        ? "lowshelf"
        : index === EQ_FREQUENCIES.length - 1
          ? "highshelf"
          : "peaking";
    return filter;
  });

  mediaSourceNode.connect(eqFilters[0]);
  for (let index = 0; index < eqFilters.length - 1; index += 1) {
    eqFilters[index].connect(eqFilters[index + 1]);
  }
  eqFilters[eqFilters.length - 1].connect(analyserNode);
  analyserNode.connect(masterGainNode);
  masterGainNode.connect(audioContext.destination);
  sfxGainNode.connect(audioContext.destination);

  updateEqFilters();
  startSpectrumLoop();
  localPlayerReady = true;
}

async function resumeAudioContext() {
  ensureAudioGraph();

  if (audioContext && audioContext.state === "suspended") {
    await audioContext.resume();
  }

  audioUnlocked = Boolean(audioContext && audioContext.state === "running");
}

function playToneSequence(notes, volume = 0.1) {
  ensureAudioGraph();

  if (!audioContext || audioContext.state !== "running" || !sfxGainNode) {
    return;
  }

  let cursor = audioContext.currentTime;

  notes.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = note.type || "square";
    oscillator.frequency.setValueAtTime(note.frequency, cursor);
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.linearRampToValueAtTime(volume, cursor + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + note.duration);

    oscillator.connect(gain);
    gain.connect(sfxGainNode);
    oscillator.start(cursor);
    oscillator.stop(cursor + note.duration + 0.02);

    cursor += note.duration + (note.gap ?? 0.015);
  });
}

function playUiSound(kind) {
  switch (kind) {
    case "hover":
      playToneSequence([{ frequency: 740, duration: 0.04, type: "square" }], 0.035);
      break;
    case "click":
      playToneSequence(
        [
          { frequency: 620, duration: 0.05, type: "square" },
          { frequency: 820, duration: 0.06, type: "square" }
        ],
        0.05
      );
      break;
    case "boot":
      playToneSequence(
        [
          { frequency: 392, duration: 0.08, type: "triangle" },
          { frequency: 523, duration: 0.08, type: "triangle" },
          { frequency: 784, duration: 0.12, type: "triangle" }
        ],
        0.06
      );
      break;
    case "start":
      playToneSequence(
        [
          { frequency: 330, duration: 0.07, type: "square" },
          { frequency: 440, duration: 0.07, type: "square" },
          { frequency: 660, duration: 0.12, type: "square" }
        ],
        0.07
      );
      break;
    case "jump":
      playToneSequence([{ frequency: 720, duration: 0.08, type: "triangle" }], 0.05);
      break;
    case "bill":
      playToneSequence([{ frequency: 510, duration: 0.04, type: "square" }], 0.04);
      break;
    case "bust":
      playToneSequence(
        [
          { frequency: 260, duration: 0.08, type: "sawtooth" },
          { frequency: 180, duration: 0.14, type: "sawtooth" }
        ],
        0.06
      );
      break;
    case "submit":
      playToneSequence(
        [
          { frequency: 523, duration: 0.06, type: "triangle" },
          { frequency: 659, duration: 0.06, type: "triangle" },
          { frequency: 880, duration: 0.12, type: "triangle" }
        ],
        0.06
      );
      break;
    default:
      break;
  }
}

function bindArcadeSound(target, { hover = true, click = true } = {}) {
  if (!target || target.dataset.arcadeSoundBound === "true") {
    return;
  }

  target.dataset.arcadeSoundBound = "true";

  if (hover) {
    target.addEventListener("pointerenter", () => {
      playUiSound("hover");
    });
  }

  if (click) {
    target.addEventListener("click", () => {
      playUiSound("click");
    });
  }
}

function bindStaticUiSounds() {
  [
    ...jumpButtons,
    ...touchButtons,
    ...transportButtons,
    ...eqActionButtons,
    resetButton,
    leaderboardSubmitEl,
    bootSkipButtonEl,
    ...document.querySelectorAll(".menu-button")
  ].forEach((element) => bindArcadeSound(element));
}

async function unlockArcadeAudio() {
  if (audioUnlocked) {
    return;
  }

  try {
    await resumeAudioContext();
  } catch {
    // Ignore audio unlock failures.
  }
}

function updateSpectrumBars() {
  if (!spectrumBars.length) {
    return;
  }

  if (!analyserNode || !spectrumData || !playlistAudioEl || playlistAudioEl.paused) {
    spectrumBars.forEach((bar) => {
      bar.style.transform = "scaleY(0.12)";
      bar.style.opacity = "0.4";
    });
    return;
  }

  analyserNode.getByteFrequencyData(spectrumData);
  spectrumBars.forEach((bar, index) => {
    const start = Math.floor(index * spectrumData.length / spectrumBars.length);
    const end = Math.max(
      start + 1,
      Math.floor((index + 1) * spectrumData.length / spectrumBars.length)
    );
    let total = 0;

    for (let cursor = start; cursor < end; cursor += 1) {
      total += spectrumData[cursor];
    }

    const average = total / (end - start) / 255;
    const scale = 0.12 + average * 0.88;
    bar.style.transform = `scaleY(${scale.toFixed(3)})`;
    bar.style.opacity = String(0.35 + average * 0.65);
  });
}

function startSpectrumLoop() {
  if (spectrumFrame) {
    return;
  }

  const render = () => {
    updateSpectrumBars();
    spectrumFrame = requestAnimationFrame(render);
  };

  render();
}

function setTransportState() {
  const hasAudio = Boolean(playlistAudioEl);
  const isPlaying = hasAudio && !playlistAudioEl.paused;
  const isStopped =
    !hasAudio ||
    (playlistAudioEl.paused && (playlistAudioEl.currentTime || 0) < 0.05);

  transportButtons.forEach((button) => {
    const { playerAction } = button.dataset;
    button.classList.toggle(
      "is-active",
      (isPlaying && playerAction === "play") ||
      (!isPlaying && !isStopped && playerAction === "pause")
    );
  });

  if (winampLedPlayEl) {
    winampLedPlayEl.textContent = isPlaying ? "PLAY" : isStopped ? "STOP" : "PAUSE";
  }

  if (musicPlayerTypeEl) {
    musicPlayerTypeEl.textContent = "";
  }
}

function updatePlayerProgress() {
  if (!playlistAudioEl) {
    return;
  }

  const currentTime = playlistAudioEl.currentTime || 0;
  const duration = playlistAudioEl.duration;

  if (winampElapsedEl) {
    winampElapsedEl.textContent = formatTime(currentTime);
  }

  if (winampClockEl) {
    winampClockEl.textContent = formatTime(currentTime);
  }

  if (winampDurationEl) {
    winampDurationEl.textContent = formatTime(duration);
  }

  if (winampSeekEl && !isSeeking) {
    winampSeekEl.max =
      Number.isFinite(duration) && duration > 0 ? String(duration) : "100";
    winampSeekEl.value =
      Number.isFinite(duration) && duration > 0 ? String(currentTime) : "0";
  }

  if (Number.isFinite(duration) && playlistTracks[currentTrackIndex]) {
    playlistTracks[currentTrackIndex].durationLabel = formatTime(duration);
  }
}

function updateEqFilters() {
  eqSliders.forEach((slider, index) => {
    if (eqFilters[index]) {
      eqFilters[index].gain.value = eqEnabled ? Number(slider.value) : 0;
    }
  });
}

function syncEqActionButtons() {
  eqActionButtons.forEach((button) => {
    const { eqAction } = button.dataset;
    const isActive =
      (eqAction === "toggle" && eqEnabled) ||
      (eqAction === "auto" && eqAutoMode) ||
      (eqAction === "presets" && !eqAutoMode && currentEqPresetIndex !== 0);

    button.classList.toggle("is-active", isActive);
  });
}

function setEqSliderValues(values) {
  eqSliders.forEach((slider, index) => {
    slider.value = String(values[index] ?? 0);
  });
  updateEqFilters();
}

function applyEqPreset(index, { preserveAuto = false } = {}) {
  currentEqPresetIndex =
    ((index % EQ_PRESETS.length) + EQ_PRESETS.length) % EQ_PRESETS.length;
  eqEnabled = true;

  if (!preserveAuto) {
    eqAutoMode = false;
  }

  setEqSliderValues(EQ_PRESETS[currentEqPresetIndex].values);
  syncEqActionButtons();
}

function applyAutoEqForTrack() {
  const presetIndex = 1 + (currentTrackIndex % (EQ_PRESETS.length - 1));
  currentEqPresetIndex = presetIndex;
  eqEnabled = true;
  setEqSliderValues(EQ_PRESETS[presetIndex].values);
  syncEqActionButtons();
}

function handleEqAction(action) {
  switch (action) {
    case "toggle":
      eqEnabled = !eqEnabled;
      updateEqFilters();
      syncEqActionButtons();
      break;
    case "auto":
      eqAutoMode = !eqAutoMode;
      if (eqAutoMode) {
        applyAutoEqForTrack();
      } else {
        syncEqActionButtons();
      }
      break;
    case "presets":
      applyEqPreset(currentEqPresetIndex === 0 ? 1 : currentEqPresetIndex + 1);
      showStatus(`${EQ_PRESETS[currentEqPresetIndex].name} EQ.`, 900);
      break;
    case "reset":
      eqAutoMode = false;
      applyEqPreset(0);
      showStatus("EQ reset to flat.", 900);
      break;
    default:
      break;
  }
}

function enrichTrack(row) {
  const fallback = localTrackFallbacks.get(row.position);

  return {
    position: row.position,
    title: row.title,
    artist: row.artist || fallback?.artist || "IAM NASTY NASH",
    src: row.audio_url,
    remoteSrc: row.audio_url,
    fallbackSrc: fallback?.src || null,
    cover: row.cover_url || fallback?.cover || albumCover,
    fallbackCover: fallback?.cover || albumCover,
    format: row.format_label || fallback?.format || "Remote Deck",
    durationLabel:
      row.duration_label ||
      formatTime(row.duration_seconds) ||
      fallback?.durationLabel ||
      "--:--",
    usingFallback: false
  };
}

async function fetchPlaylistTracksFromSupabase() {
  const response = await fetch(PLAYLIST_ENDPOINT, {
    headers: SUPABASE_HEADERS,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase playlist request failed with ${response.status}`);
  }

  const rows = await response.json();
  return rows.map(enrichTrack);
}

function renderTracklist() {
  if (!winampTracklistEl) {
    return;
  }

  winampTracklistEl.innerHTML = "";

  playlistTracks.forEach((track, index) => {
    const item = document.createElement("li");
    item.className = index === currentTrackIndex ? "is-active" : "";
    item.tabIndex = 0;
    item.dataset.index = String(index);

    const name = document.createElement("span");
    name.className = "winamp-track-name";
    name.textContent = track.title;

    const length = document.createElement("span");
    length.className = "winamp-track-length";
    length.textContent = track.durationLabel || "--:--";

    item.append(name, length);
    item.addEventListener("click", () => loadTrack(index, { autoplay: true }));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        loadTrack(index, { autoplay: true });
      }
    });
    bindArcadeSound(item);

    winampTracklistEl.append(item);
  });

  renderBoomboxRack();
}

async function playCurrentTrack() {
  if (!playlistAudioEl || !playlistTracks.length) {
    return;
  }

  await resumeAudioContext();
  requestedAutoplay = true;
  await playlistAudioEl.play();
  requestedAutoplay = false;
  setTransportState();
}

function pauseCurrentTrack() {
  if (!playlistAudioEl) {
    return;
  }

  requestedAutoplay = false;
  playlistAudioEl.pause();
  setTransportState();
}

function stopCurrentTrack() {
  if (!playlistAudioEl) {
    return;
  }

  requestedAutoplay = false;
  playlistAudioEl.pause();
  playlistAudioEl.currentTime = 0;
  updatePlayerProgress();
  setTransportState();
}

function seekCurrentTrack(deltaSeconds) {
  if (!playlistAudioEl) {
    return;
  }

  const duration = Number.isFinite(playlistAudioEl.duration)
    ? playlistAudioEl.duration
    : 0;
  const targetTime = clamp(
    playlistAudioEl.currentTime + deltaSeconds,
    0,
    duration || playlistAudioEl.currentTime + deltaSeconds
  );
  playlistAudioEl.currentTime = targetTime;
  updatePlayerProgress();
}

function updateTrackMeta(track) {
  if (musicPlayerTitleEl) {
    musicPlayerTitleEl.textContent = track.title;
  }

  if (musicPlayerDescriptionEl) {
    musicPlayerDescriptionEl.textContent = `${track.artist} • ${track.format}`;
  }

  if (winampCoverEl) {
    winampCoverEl.src = track.cover;
    winampCoverEl.alt = `${track.title} cover art`;
  }

  if (winampElapsedEl) {
    winampElapsedEl.textContent = "0:00";
  }

  if (winampClockEl) {
    winampClockEl.textContent = "0:00";
  }

  if (winampDurationEl) {
    winampDurationEl.textContent = track.durationLabel;
  }

  if (winampSeekEl) {
    winampSeekEl.value = "0";
    winampSeekEl.max = "100";
  }
}

function loadTrack(index, { autoplay = false, forceFallback = false } = {}) {
  if (!playlistAudioEl || !playlistTracks.length) {
    return;
  }

  currentTrackIndex = (index + playlistTracks.length) % playlistTracks.length;
  const track = playlistTracks[currentTrackIndex];
  requestedAutoplay = autoplay;
  track.usingFallback = forceFallback && Boolean(track.fallbackSrc);

  playlistAudioEl.pause();
  playlistAudioEl.src =
    track.usingFallback && track.fallbackSrc ? track.fallbackSrc : track.remoteSrc;
  playlistAudioEl.load();

  updateTrackMeta(track);
  renderTracklist();

  if (eqAutoMode) {
    applyAutoEqForTrack();
  }

  setTransportState();

  if (autoplay) {
    playCurrentTrack().catch(() => {});
  }
}

function handleTransportAction(action) {
  if (!playlistTracks.length) {
    return;
  }

  switch (action) {
    case "prev":
      loadTrack(currentTrackIndex - 1, { autoplay: true });
      break;
    case "next":
      loadTrack(currentTrackIndex + 1, { autoplay: true });
      break;
    case "backward":
      seekCurrentTrack(-5);
      break;
    case "forward":
      seekCurrentTrack(5);
      break;
    case "play":
      playCurrentTrack().catch(() => {});
      break;
    case "pause":
      pauseCurrentTrack();
      break;
    case "stop":
      stopCurrentTrack();
      break;
    default:
      break;
  }
}

async function initPlaylist() {
  if (musicPlayerTypeEl) {
    musicPlayerTypeEl.textContent = "";
  }
  if (musicPlayerTitleEl) {
    musicPlayerTitleEl.textContent = "Loading playlist";
  }
  if (musicPlayerDescriptionEl) {
    musicPlayerDescriptionEl.textContent = "Pulling tracks from the live Rapcade view.";
  }

  try {
    playlistTracks = await fetchPlaylistTracksFromSupabase();
  } catch (error) {
    playlistTracks = localFallbackTracks.map((track) => ({
      position: track.position,
      title: track.title,
      artist: track.artist,
      src: track.src,
      remoteSrc: track.src,
      fallbackSrc: null,
      cover: track.cover,
      fallbackCover: track.cover,
      format: track.format,
      durationLabel: track.durationLabel,
      usingFallback: false
    }));

    if (musicPlayerDescriptionEl) {
      musicPlayerDescriptionEl.textContent = "Playlist offline, so the local deck is loaded.";
    }
    console.error(error);
  }

  renderTracklist();
  loadTrack(0);
}

function qualifiesForLeaderboard(score) {
  if (!Number.isFinite(score) || score <= 0) {
    return false;
  }

  if (leaderboardEntries.length < LEADERBOARD_LIMIT) {
    return true;
  }

  return score >= leaderboardEntries[leaderboardEntries.length - 1].score;
}

function updateLeaderboardFormState() {
  const eligible = qualifiesForLeaderboard(pendingLeaderboardScore);

  if (leaderboardNameEl) {
    leaderboardNameEl.disabled = !eligible || !leaderboardOnline;
  }

  if (leaderboardSubmitEl) {
    leaderboardSubmitEl.disabled = !eligible || !leaderboardOnline || leaderboardSubmitted;
  }

  if (!leaderboardNoteEl) {
    return;
  }

  if (!leaderboardOnline) {
    leaderboardNoteEl.textContent = "Leaderboard offline right now. Your run still counts locally.";
    return;
  }

  if (leaderboardSubmitted) {
    leaderboardNoteEl.textContent = "Your name is on the wall. Run it back and go higher.";
    return;
  }

  if (game.mode === "live") {
    leaderboardNoteEl.textContent = "Catch bills, dodge cuffs, and chase the top five.";
    return;
  }

  if (pendingLeaderboardScore == null) {
    leaderboardNoteEl.textContent = "Finish a run, drop your tag, and crack the top five.";
    return;
  }

  if (eligible) {
    leaderboardNoteEl.textContent = `You made the wall with ${pendingLeaderboardScore} points. Drop your tag.`;
    return;
  }

  if (leaderboardEntries.length === LEADERBOARD_LIMIT) {
    const gap = Math.max(
      1,
      leaderboardEntries[leaderboardEntries.length - 1].score - pendingLeaderboardScore + 1
    );
    leaderboardNoteEl.textContent = `Need ${gap} more point${gap === 1 ? "" : "s"} to crack the top five.`;
    return;
  }
}

function renderLeaderboard() {
  if (!leaderboardListEl) {
    return;
  }

  leaderboardListEl.innerHTML = "";

  for (let index = 0; index < LEADERBOARD_LIMIT; index += 1) {
    const entry = leaderboardEntries[index];
    const item = document.createElement("li");

    if (!entry) {
      item.className = "is-empty";
    }

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = `#${index + 1}`;

    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = entry?.player_name || "OPEN SLOT";

    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = entry ? `${entry.score} PTS` : "--";

    item.append(rank, name, score);
    leaderboardListEl.append(item);
  }

  updateLeaderboardFormState();
}

async function fetchLeaderboard() {
  try {
    const response = await fetch(LEADERBOARD_ENDPOINT, {
      headers: SUPABASE_HEADERS,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Leaderboard request failed with ${response.status}`);
    }

    leaderboardEntries = await response.json();
    leaderboardOnline = true;
  } catch (error) {
    leaderboardEntries = [];
    leaderboardOnline = false;
    console.error(error);
  }

  renderLeaderboard();
}

async function submitLeaderboardScore(name) {
  const cleanName = sanitizePlayerName(name);
  const score = pendingLeaderboardScore;

  if (!cleanName) {
    if (leaderboardNoteEl) {
      leaderboardNoteEl.textContent = "Drop a name first, then send it to the wall.";
    }
    return;
  }

  if (!qualifiesForLeaderboard(score) || !leaderboardOnline) {
    updateLeaderboardFormState();
    return;
  }

  const response = await fetch(LEADERBOARD_SUBMIT_ENDPOINT, {
    method: "POST",
    headers: {
      ...SUPABASE_HEADERS,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      player_name: cleanName,
      score
    })
  });

  if (!response.ok) {
    throw new Error(`Leaderboard submit failed with ${response.status}`);
  }

  leaderboardSubmitted = true;
  playUiSound("submit");
  showStatus(`${cleanName} hit the wall with ${score} points.`, 2200);
  pendingLeaderboardScore = null;
  if (leaderboardNameEl) {
    leaderboardNameEl.value = "";
  }
  await fetchLeaderboard();
}

function dismissBootOverlay() {
  if (!bootOverlayEl?.classList.contains("is-hidden")) {
    bootOverlayEl?.classList.add("is-hidden");
    document.body.classList.remove("is-booting");
    playUiSound("boot");
  }
}

function startBootSequence() {
  if (!bootOverlayEl) {
    return;
  }

  document.body.classList.add("is-booting");
  bootOverlayEl.classList.remove("is-hidden");
  window.clearTimeout(bootTimer);
  bootTimer = window.setTimeout(() => {
    dismissBootOverlay();
  }, 2600);
}

function drawContainedAsset(asset, x, y, width, height) {
  if (!asset?.loaded) {
    return;
  }

  const scale = Math.min(width / asset.image.width, height / asset.image.height);
  const drawWidth = asset.image.width * scale;
  const drawHeight = asset.image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + height - drawHeight;

  ctx.drawImage(asset.image, drawX, drawY, drawWidth, drawHeight);
}

function drawBackground() {
  if (visualAssets.background.loaded) {
    ctx.drawImage(
      visualAssets.background.image,
      0,
      BG_SOURCE_Y,
      visualAssets.background.image.width,
      BG_SOURCE_HEIGHT,
      0,
      0,
      canvas.width,
      canvas.height
    );
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#241348");
    gradient.addColorStop(0.6, "#11162a");
    gradient.addColorStop(1, "#05070d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.fillStyle = "rgba(5, 8, 18, 0.26)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (currentAtmosphere?.skyTint) {
    ctx.fillStyle = currentAtmosphere.skyTint;
    ctx.fillRect(0, 0, canvas.width, GROUND_Y);
  }

  if (currentAtmosphere?.stars) {
    for (let index = 0; index < 28; index += 1) {
      const x = ((index * 37) + game.elapsedMs * 0.08) % (canvas.width + 40) - 20;
      const y = (index * 29 + game.elapsedMs * 0.18) % (GROUND_Y - 10);
      const length = 6 + (index % 4) * 3;

      ctx.fillStyle =
        index % 5 === 0
          ? "rgba(255, 223, 112, 0.32)"
          : currentAtmosphere.rainTrailColor;
      ctx.fillRect(x, y, 1, length);
    }
  } else {
    for (let index = 0; index < 12; index += 1) {
      const x = ((index * 41) + game.elapsedMs * 0.06) % (canvas.width + 50) - 25;
      const y = 24 + ((index * 21) % (GROUND_Y - 60));

      ctx.fillStyle = currentAtmosphere?.rainTrailColor || "rgba(193, 233, 255, 0.18)";
      ctx.fillRect(x, y, 1, 5);
    }
  }

  ctx.fillStyle = "rgba(5, 7, 15, 0.78)";
  ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
  ctx.fillStyle = "#6970cf";
  ctx.fillRect(0, GROUND_Y - 4, canvas.width, 4);
  ctx.fillStyle = "#171c2d";
  ctx.fillRect(0, GROUND_Y, canvas.width, 8);
  ctx.fillStyle = "#f2d45f";
  for (let x = 14; x < canvas.width - 14; x += 36) {
    ctx.fillRect(x, GROUND_Y + 20, 18, 4);
  }
}

function drawDrop(drop) {
  const x = drop.x - drop.w / 2;
  const y = drop.y - drop.h / 2;

  if (drop.kind === "coin" && visualAssets.coinStrip.loaded) {
    const frameWidth = visualAssets.coinStrip.image.width / COIN_FRAMES;
    const frameIndex = Math.floor(performance.now() / 95) % COIN_FRAMES;

    ctx.drawImage(
      visualAssets.coinStrip.image,
      frameIndex * frameWidth,
      0,
      frameWidth,
      visualAssets.coinStrip.image.height,
      x,
      y,
      drop.w,
      drop.h
    );
    return;
  }

  if (drop.kind === "bill") {
    drawContainedAsset(visualAssets.bill, x, y, drop.w, drop.h);
    return;
  }

  drawContainedAsset(visualAssets.handcuffs, x, y, drop.w, drop.h);
}

function drawDrops() {
  game.drops.forEach(drawDrop);
}

function drawPlayer() {
  const animation = getPlayerAnimation();
  const sprite = spriteAssets[animation];
  const asset = visualAssets[sprite.assetKey];
  const boxHeight = PLAYER_RENDER_HEIGHT;
  const boxWidth = (sprite.logicalWidth * boxHeight) / sprite.logicalHeight;
  const boxX = player.x + player.w / 2 - boxWidth / 2;
  const boxY = player.y + player.h - boxHeight;

  ctx.save();
  if (player.facing === -1) {
    ctx.translate(boxX + boxWidth, 0);
    ctx.scale(-1, 1);
  }

  const drawX = player.facing === -1 ? 0 : boxX;

  if (sprite.mode === "single") {
    drawContainedAsset(asset, drawX, boxY, boxWidth, boxHeight);
  } else if (asset?.loaded) {
    const frameWidth = asset.image.width / sprite.frames;
    const frameHeight = asset.image.height;
    const frameIndex =
      animation === "jump"
        ? getJumpFrameIndex()
        : Math.floor(performance.now() / sprite.frameDuration) % sprite.frames;

    ctx.drawImage(
      asset.image,
      frameIndex * frameWidth,
      0,
      frameWidth,
      frameHeight,
      drawX,
      boxY,
      boxWidth,
      boxHeight
    );
  }

  ctx.restore();

  if (!asset?.loaded) {
    ctx.fillStyle = "rgba(255, 220, 160, 0.7)";
    ctx.fillRect(boxX + boxWidth / 2 - 7, boxY + 8, 14, 24);
  }
}

function drawReadyOverlay() {
  if (game.mode === "live") {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(4, 6, 14, 0.42)";
  ctx.fillRect(10, 12, 188, 34);
  ctx.strokeStyle = game.mode === "ready" ? "#40f6ff" : "#ffb347";
  ctx.strokeRect(10.5, 12.5, 187, 33);
  ctx.fillStyle = "#f7f3ff";
  ctx.font = "8px Monaco";
  ctx.textAlign = "left";
  ctx.fillText(game.mode === "ready" ? "PRESS MOVE OR JUMP TO START" : "RESET TO RUN IT BACK", 18, 25);
  ctx.fillStyle = "#d5ff51";
  ctx.fillText(game.mode === "ready" ? "1:00 ON THE CLOCK" : `${game.score} PTS BANKED`, 18, 37);
  ctx.restore();
}

function draw() {
  drawBackground();
  drawDrops();
  drawPlayer();
  drawReadyOverlay();
}

function update() {
  updatePlayer();
  updateRound();
  applyPersistentStatus();
}

function frame(time) {
  if (!lastFrameTime) {
    lastFrameTime = time;
  }

  accumulator += Math.min(32, time - lastFrameTime);
  lastFrameTime = time;

  while (accumulator >= FIXED_STEP) {
    update();
    accumulator -= FIXED_STEP;
  }

  draw();
  requestAnimationFrame(frame);
}

function beginRunOnInput() {
  if (game.mode === "ready") {
    startRound();
  }
}

function handleKeyChange(event, isDown) {
  const { key } = event;

  if (["ArrowLeft", "a", "A"].includes(key)) {
    keys.left = isDown;
    if (isDown) {
      beginRunOnInput();
    }
  }

  if (["ArrowRight", "d", "D"].includes(key)) {
    keys.right = isDown;
    if (isDown) {
      beginRunOnInput();
    }
  }

  if (isDown && ["ArrowUp", "w", "W", " "].includes(key)) {
    beginRunOnInput();
    jumpQueued = true;
    event.preventDefault();
  }

  if (isDown && ["r", "R"].includes(key)) {
    resetRound();
  }
}

window.addEventListener("pointerdown", () => {
  unlockArcadeAudio();
}, { passive: true });

window.addEventListener("keydown", (event) => {
  unlockArcadeAudio();
  handleKeyChange(event, true);
});
window.addEventListener("keyup", (event) => handleKeyChange(event, false));

jumpButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector(button.dataset.jump);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

resetButton.addEventListener("click", triggerResetButton);

["contextmenu", "selectstart", "dragstart"].forEach((eventName) => {
  resetButton?.addEventListener(eventName, (event) => {
    event.preventDefault();
  });
});

["touchstart", "touchmove", "touchcancel"].forEach((eventName) => {
  resetButton?.addEventListener(eventName, blockTouchDefault, { passive: false });
});

resetButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  clearTextSelection();
  if (resetButton.setPointerCapture && event.pointerId !== undefined) {
    try {
      resetButton.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures on browsers that reject it.
    }
  }
});

resetButton?.addEventListener("pointerup", triggerResetButton);

bootSkipButtonEl?.addEventListener("click", () => {
  window.clearTimeout(bootTimer);
  dismissBootOverlay();
});

transportButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleTransportAction(button.dataset.playerAction);
  });
});

eqSliders.forEach((slider) => {
  slider.addEventListener("input", () => {
    eqEnabled = true;
    eqAutoMode = false;
    currentEqPresetIndex = 0;
    ensureAudioGraph();
    updateEqFilters();
    syncEqActionButtons();
  });
});

eqActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleEqAction(button.dataset.eqAction);
  });
});

winampVolumeEl?.addEventListener("input", () => {
  const volume = Number(winampVolumeEl.value) / 100;

  if (masterGainNode) {
    masterGainNode.gain.value = volume;
  } else if (playlistAudioEl) {
    playlistAudioEl.volume = volume;
  }
});

winampSeekEl?.addEventListener("pointerdown", () => {
  isSeeking = true;
});

winampSeekEl?.addEventListener("pointerup", () => {
  isSeeking = false;
});

winampSeekEl?.addEventListener("input", () => {
  if (winampElapsedEl) {
    winampElapsedEl.textContent = formatTime(Number(winampSeekEl.value));
  }
});

winampSeekEl?.addEventListener("change", () => {
  if (!playlistAudioEl) {
    return;
  }

  playlistAudioEl.currentTime = Number(winampSeekEl.value);
  isSeeking = false;
  updatePlayerProgress();
});

playlistAudioEl?.addEventListener("loadedmetadata", () => {
  if (playlistTracks[currentTrackIndex]) {
    playlistTracks[currentTrackIndex].durationLabel = formatTime(playlistAudioEl.duration);
  }

  updatePlayerProgress();
  renderTracklist();
  updateTrackMeta(playlistTracks[currentTrackIndex]);
});

playlistAudioEl?.addEventListener("timeupdate", updatePlayerProgress);
playlistAudioEl?.addEventListener("play", setTransportState);
playlistAudioEl?.addEventListener("pause", setTransportState);
playlistAudioEl?.addEventListener("ended", () => {
  loadTrack(currentTrackIndex + 1, { autoplay: true });
});

playlistAudioEl?.addEventListener("error", () => {
  const track = playlistTracks[currentTrackIndex];

  if (!track) {
    return;
  }

  if (!track.usingFallback && track.fallbackSrc) {
    loadTrack(currentTrackIndex, {
      autoplay: requestedAutoplay || !playlistAudioEl.paused,
      forceFallback: true
    });

    if (musicPlayerDescriptionEl) {
      musicPlayerDescriptionEl.textContent = `${track.artist} • ${track.format} • local fallback`;
    }

    showStatus(`${track.title} switched to local fallback.`, 1500);
    return;
  }

  if (musicPlayerDescriptionEl) {
    musicPlayerDescriptionEl.textContent = "Track failed to load on this browser.";
  }
});

leaderboardNameEl?.addEventListener("input", () => {
  const clean = sanitizePlayerName(leaderboardNameEl.value);
  if (leaderboardNameEl.value !== clean) {
    leaderboardNameEl.value = clean;
  }
});

leaderboardFormEl?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await submitLeaderboardScore(leaderboardNameEl?.value || "");
  } catch (error) {
    console.error(error);
    showStatus("Score upload missed. Try again in a second.", 1800);
    if (leaderboardNoteEl) {
      leaderboardNoteEl.textContent = "Score upload missed. Try again.";
    }
  }
});

touchButtons.forEach((button) => {
  const action = button.dataset.touch;

  const release = () => {
    clearTextSelection();

    if (action === "left") {
      keys.left = false;
    }

    if (action === "right") {
      keys.right = false;
    }
  };

  ["contextmenu", "selectstart", "dragstart"].forEach((eventName) => {
    button.addEventListener(eventName, (event) => {
      event.preventDefault();
    });
  });

  ["touchstart", "touchmove", "touchend", "touchcancel"].forEach((eventName) => {
    button.addEventListener(eventName, blockTouchDefault, { passive: false });
  });

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    clearTextSelection();
    if (button.setPointerCapture && event.pointerId !== undefined) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture failures on browsers that reject it.
      }
    }
    beginRunOnInput();

    if (action === "left") {
      keys.left = true;
    }

    if (action === "right") {
      keys.right = true;
    }

    if (action === "jump") {
      jumpQueued = true;
    }
  });

  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

game.best = loadBestScore();
updateHud();
syncEqActionButtons();
bindStaticUiSounds();
startAtmosphereClock();
resetRound();
requestAnimationFrame(frame);
startBootSequence();
fetchLeaderboard();
initPlaylist();

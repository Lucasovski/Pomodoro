(() => {
  "use strict";

  /* ---------- Constantes e estado ---------- */
  const LS_SETTINGS = "pomodoro.settings.v1";
  const LS_SESSION = "pomodoro.session.v1";
  const LS_STATS = "pomodoro.stats.v1";

  const DEFAULT_SETTINGS = {
    focus: 25,
    short: 5,
    long: 15,
    interval: 4,
    autostart: false,
    sound: true,
  };

  const MODE_LABELS = { focus: "Foco", short: "Pausa curta", long: "Pausa longa" };

  const $ = (id) => document.getElementById(id);

  const els = {
    app: $("app"),
    timeDisplay: $("time-display"),
    ringProgress: $("ring-progress"),
    btnStart: $("btn-start"),
    btnReset: $("btn-reset"),
    modeBtns: Array.from(document.querySelectorAll(".mode-btn")),
    cycleCount: $("cycle-count"),
    statPomodoros: $("stat-pomodoros"),
    statMinutes: $("stat-minutes"),
    statBreaks: $("stat-breaks"),
    btnSettings: $("btn-settings"),
    settingsPanel: $("settings-panel"),
    settingsOverlay: $("settings-overlay"),
    settingsForm: $("settings-form"),
    btnCloseSettings: $("btn-close-settings"),
    btnDefaults: $("btn-defaults"),
    inpFocus: $("inp-focus"),
    inpShort: $("inp-short"),
    inpLong: $("inp-long"),
    inpInterval: $("inp-interval"),
    inpAutostart: $("inp-autostart"),
    inpSound: $("inp-sound"),
    toast: $("toast"),
  };

  let settings = loadJSON(LS_SETTINGS, DEFAULT_SETTINGS);
  // Sessão do ciclo atual (persistida para sobreviver a recarregamentos)
  let session = loadJSON(LS_SESSION, { mode: "focus", completedFocus: 0 });
  // Estatísticas do dia
  let stats = loadJSON(LS_STATS, newStatsForToday());

  let totalSeconds = durationFor(session.mode) * 60;
  let remainingSeconds = totalSeconds;
  let running = false;
  let intervalId = null;
  let tickDueAt = null; // timestamp do próximo tick (evita drift)

  /* ---------- Utilidades ---------- */
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredCloneSafe(fallback);
      const parsed = JSON.parse(raw);
      if (typeof fallback === "object" && fallback !== null && !Array.isArray(fallback)) {
        return Object.assign(structuredCloneSafe(fallback), parsed);
      }
      return parsed;
    } catch {
      return structuredCloneSafe(fallback);
    }
  }

  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* armazenamento indisponível */ }
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function newStatsForToday() {
    return { date: todayKey(), pomodoros: 0, focusMinutes: 0, breaks: 0 };
  }

  // Garante que as estatísticas são de hoje; se não, reseta.
  function ensureStatsDate() {
    if (stats.date !== todayKey()) {
      stats = newStatsForToday();
      saveJSON(LS_STATS, stats);
    }
  }

  function clampInt(value, min, max) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function durationFor(mode) {
    return settings[mode] || DEFAULT_SETTINGS[mode];
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  /* ---------- Anel de progresso ---------- */
  const RING_RADIUS = 100;
  const RING_CIRC = 2 * Math.PI * RING_RADIUS;
  els.ringProgress.style.strokeDasharray = String(RING_CIRC);

  function renderRing() {
    const fraction = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
    els.ringProgress.style.strokeDashoffset = String(RING_CIRC * (1 - fraction));
  }

  /* ---------- Renderização ---------- */
  function render() {
    els.app.dataset.mode = session.mode;
    els.timeDisplay.textContent = formatTime(remainingSeconds);
    document.title = `${formatTime(remainingSeconds)} — ${MODE_LABELS[session.mode]} | Pomodoro Foco`;
    renderRing();

    els.btnStart.textContent = running ? "Pausar" : (remainingSeconds < totalSeconds ? "Continuar" : "Iniciar");
    els.btnReset.disabled = !running && remainingSeconds === totalSeconds;

    els.cycleCount.textContent = `${session.completedFocus}/${settings.interval}`;

    els.statPomodoros.textContent = String(stats.pomodoros);
    const mins = stats.focusMinutes;
    els.statMinutes.textContent = mins >= 60
      ? `${Math.floor(mins / 60)}h ${mins % 60}min`
      : `${mins} min`;
    els.statBreaks.textContent = String(stats.breaks);

    els.modeBtns.forEach((btn) => {
      const active = btn.dataset.mode === session.mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
  }

  /* ---------- Timer ---------- */
  function start() {
    if (running) return;
    running = true;
    tickDueAt = Date.now() + 1000;
    intervalId = setInterval(tick, 250);
    render();
  }

  function pause() {
    if (!running) return;
    running = false;
    clearInterval(intervalId);
    intervalId = null;
    render();
  }

  function reset() {
    pause();
    totalSeconds = durationFor(session.mode) * 60;
    remainingSeconds = totalSeconds;
    saveSession();
    render();
  }

  function tick() {
    const now = Date.now();
    while (running && now >= tickDueAt) {
      tickDueAt += 1000;
      remainingSeconds -= 1;
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        complete();
        return;
      }
    }
    render();
  }

  function switchMode(mode, autoStart = false) {
    pause();
    session.mode = mode;
    totalSeconds = durationFor(mode) * 60;
    remainingSeconds = totalSeconds;
    saveSession();
    render();
    if (autoStart) start();
  }

  function complete() {
    pause();
    playChime();

    const finished = session.mode;
    ensureStatsDate();

    if (finished === "focus") {
      stats.pomodoros += 1;
      stats.focusMinutes += durationFor("focus");
      session.completedFocus += 1;
      const nextMode = session.completedFocus >= settings.interval ? "long" : "short";
      if (nextMode === "long") session.completedFocus = 0;
      showToast(`🍅 Pomodoro concluído! Hora da ${nextMode === "long" ? "pausa longa" : "pausa curta"}.`);
      saveStats();
      switchMode(nextMode, settings.autostart);
    } else {
      stats.breaks += 1;
      saveStats();
      showToast("Pausa encerrada. De volta ao foco! 💪");
      switchMode("focus", settings.autostart);
    }
  }

  /* ---------- Som (Web Audio, sem arquivos externos) ---------- */
  let audioCtx = null;
  function playChime() {
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [880, 1108.73, 1318.51].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.6);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.7);
      });
    } catch { /* áudio indisponível */ }
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 4000);
  }

  /* ---------- Persistência ---------- */
  function saveSession() { saveJSON(LS_SESSION, session); }
  function saveStats() { saveJSON(LS_STATS, stats); }
  function saveSettings() { saveJSON(LS_SETTINGS, settings); }

  /* ---------- Configurações (painel) ---------- */
  function openSettings() {
    els.inpFocus.value = settings.focus;
    els.inpShort.value = settings.short;
    els.inpLong.value = settings.long;
    els.inpInterval.value = settings.interval;
    els.inpAutostart.checked = settings.autostart;
    els.inpSound.checked = settings.sound;
    els.settingsPanel.classList.remove("hidden");
    els.settingsOverlay.classList.remove("hidden");
  }

  function closeSettings() {
    els.settingsPanel.classList.add("hidden");
    els.settingsOverlay.classList.add("hidden");
  }

  function applySettings(newSettings) {
    settings = newSettings;
    saveSettings();
    // Ajusta o timer atual se ele ainda não foi iniciado
    if (!running && remainingSeconds === totalSeconds) {
      totalSeconds = durationFor(session.mode) * 60;
      remainingSeconds = totalSeconds;
    }
    render();
  }

  /* ---------- Eventos ---------- */
  els.btnStart.addEventListener("click", () => (running ? pause() : start()));
  els.btnReset.addEventListener("click", reset);

  els.modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.mode === session.mode && !running && remainingSeconds === totalSeconds) return;
      const label = running || remainingSeconds < totalSeconds ? "Trocar para" : "";
      if (label && !confirm(`${label} ${MODE_LABELS[btn.dataset.mode]}? O tempo atual será perdido.`)) return;
      switchMode(btn.dataset.mode);
    });
  });

  els.btnSettings.addEventListener("click", openSettings);
  els.btnCloseSettings.addEventListener("click", closeSettings);
  els.settingsOverlay.addEventListener("click", closeSettings);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettings();
    if (e.code === "Space" && e.target === document.body) {
      e.preventDefault();
      running ? pause() : start();
    }
  });

  els.settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    applySettings({
      focus: clampInt(els.inpFocus.value, 1, 180),
      short: clampInt(els.inpShort.value, 1, 60),
      long: clampInt(els.inpLong.value, 1, 120),
      interval: clampInt(els.inpInterval.value, 2, 10),
      autostart: els.inpAutostart.checked,
      sound: els.inpSound.checked,
    });
    closeSettings();
    showToast("Configurações salvas ✅");
  });

  els.btnDefaults.addEventListener("click", () => {
    applySettings(structuredCloneSafe(DEFAULT_SETTINGS));
    openSettings(); // atualiza os campos exibidos
    showToast("Durações restauradas para os padrões");
  });

  // Se a aba voltar ao foco depois de um tempo em segundo plano, sincroniza o relógio
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && running) tick();
  });

  /* ---------- Inicialização ---------- */
  ensureStatsDate();
  if (![ "focus", "short", "long" ].includes(session.mode)) session.mode = "focus";
  session.completedFocus = clampInt(session.completedFocus, 0, settings.interval);
  totalSeconds = durationFor(session.mode) * 60;
  remainingSeconds = totalSeconds;
  render();
})();

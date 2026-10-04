const WTDRAFT_CODE_VERSION = 'v44';

function parseCSV(text) {
    const clean = String(text ?? "").replace(/^\uFEFF/, "").trim();
    if (!clean) return [];

    const firstLine = clean.split(/\r?\n/, 1)[0] || "";
    const delimiter = (firstLine.split(";").length > firstLine.split(",").length) ? ";" : ",";

    const rows = [];
    let row = [], field = "", quoted = false;

    for (let i = 0; i < clean.length; i++) {
        const ch = clean[i], next = clean[i + 1];

        if (ch === '"' && quoted && next === '"') {
            field += '"'; i++; continue;
        }
        if (ch === '"') {
            quoted = !quoted; continue;
        }
        if (ch === delimiter && !quoted) {
            row.push(field.trim()); field = ""; continue;
        }
        if ((ch === "\n" || ch === "\r") && !quoted) {
            if (ch === "\r" && next === "\n") i++;
            row.push(field.trim()); field = "";
            if (row.some(v => v !== "")) rows.push(row);
            row = []; continue;
        }
        field += ch;
    }

    row.push(field.trim());
    if (row.some(v => v !== "")) rows.push(row);

    const headers = rows.shift() || [];
    return rows.map(values => Object.fromEntries(
        headers.map((header, i) => [
            header.replace(/^\uFEFF/, "").trim(),
            (values[i] || "").trim()
        ])
    ));
}

document.addEventListener("DOMContentLoaded", () => {

    // MUZYKA MENU
    // Natywna redukcja głośności muzyki menu — suwak użytkownika działa dodatkowo.
    const MENU_MUSIC_NATIVE_VOLUME = 0.1;
    // Startuje po pierwszej reakcji użytkownika na stronę.
    // Działa we wszystkich trybach poza interaktywnym „Rozegraj mecz”.
    const gameMusic = {
        excluded: false,
        started: false,
        audio: null,
        candidates: Array.from({ length: 5 }, (_, i) => `data/sound/menu/${i + 2}.mp3`),
        specialTrack: "data/sound/menu/1.mp3",
        specialUnlocked: false,

        async start() {
            if (this.excluded || this.started) return;
            this.started = true;

            const candidates = this.specialUnlocked ? [this.specialTrack] : [...this.candidates];
            while (candidates.length) {
                const index = Math.floor(Math.random() * candidates.length);
                const path = candidates.splice(index, 1)[0];
                const audio = new Audio(path);
                audio.loop = true;
                audio.volume = gameMusic.volume;

                try {
                    await audio.play();
                    this.audio = audio;
                    return;
                } catch (error) {
                    audio.pause();
                }
            }

            this.started = false;
        },

        async playSpecial() {
            if (this.excluded) return;
            this.stop();
            this.specialUnlocked = true;

            const audio = new Audio(this.specialTrack);
            audio.loop = true;
            audio.volume = this.volume;

            try {
                await audio.play();
                this.audio = audio;
                this.started = true;
            } catch (error) {
                audio.pause();
                this.started = false;
            }
        },

        stop() {
            if (this.audio) {
                this.audio.pause();
                this.audio.currentTime = 0;
                this.audio = null;
            }
            this.started = false;
        },

        setExcluded(value) {
            this.excluded = Boolean(value);
            if (this.excluded) this.stop();
            else if (this.started === false) this.start();
        }
    };

    const audioSettings = {
        musicEnabled: false,
        musicVolume: Math.min(1, Math.max(0, Number(localStorage.getItem("widzewMusicVolume") ?? "0.35"))),
        effectsEnabled: false,
        effectsVolume: Math.min(1, Math.max(0, Number(localStorage.getItem("widzewEffectsVolume") ?? "0.7")))
    };

    gameMusic.setVolume = value => {
        this;
        const volume = Math.min(1, Math.max(0, Number(value) || 0));
        gameMusic.volume = volume * MENU_MUSIC_NATIVE_VOLUME;
        if (gameMusic.audio) gameMusic.audio.volume = gameMusic.volume;
        localStorage.setItem("widzewMusicVolume", String(volume));
    };

    const originalStart = gameMusic.start.bind(gameMusic);
    gameMusic.start = async () => {
        if (!audioSettings.musicEnabled) return;
        gameMusic.setVolume(audioSettings.musicVolume);
        return originalStart();
    };

    const originalSetExcluded = gameMusic.setExcluded.bind(gameMusic);
    gameMusic.setExcluded = value => originalSetExcluded(value);

    gameMusic.volume = audioSettings.musicVolume * MENU_MUSIC_NATIVE_VOLUME;

    // EASTER EGG: kod 1910 działa wyłącznie na ekranie głównym.
    const easterEggSequence = ["1", "9", "1", "0"];
    let easterEggProgress = [];
    const easterEggModal = document.getElementById("musicEasterEggModal");
    const closeEasterEggModal = document.getElementById("closeMusicEasterEgg");

    const closeEasterEgg = () => easterEggModal?.classList.add("hidden");
    closeEasterEggModal?.addEventListener("click", closeEasterEgg);
    easterEggModal?.addEventListener("click", event => {
        if (event.target === easterEggModal) closeEasterEgg();
    });

    document.addEventListener("keydown", event => {
        const startScreen = document.querySelector(".start-screen");
        if (!startScreen || startScreen.classList.contains("hidden")) {
            easterEggProgress = [];
            return;
        }
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (!["1", "9", "0"].includes(event.key)) return;

        easterEggProgress.push(event.key);
        if (easterEggProgress.length > easterEggSequence.length) {
            easterEggProgress.shift();
        }

        if (easterEggProgress.join("") === easterEggSequence.join("")) {
            easterEggProgress = [];
            gameMusic.playSpecial();
            easterEggModal?.classList.remove("hidden");
        }
    });

    // MOBILE EASTER EGG: 4 kliknięcia logo WTM otwierają pole wpisania kodu.
    const wtmLogo = document.querySelector(".wtm-start-logo");
    const mobileCodeModal = document.getElementById("musicEasterEggCodeModal");
    const mobileCodeInput = document.getElementById("musicEasterEggCodeInput");
    const mobileCodeConfirm = document.getElementById("musicEasterEggCodeConfirm");
    const mobileCodeClose = document.getElementById("closeMusicEasterEggCode");
    let wtmTapCount = 0;
    let wtmLastTap = 0;

    const isMobileDevice = () => window.matchMedia("(pointer: coarse)").matches && window.innerWidth <= 900;

    const openMobileCodeModal = () => {
        if (!isMobileDevice()) return;
        mobileCodeInput.value = "";
        mobileCodeModal?.classList.remove("hidden");
        setTimeout(() => mobileCodeInput?.focus(), 50);
    };

    const closeMobileCodeModal = () => mobileCodeModal?.classList.add("hidden");

    const submitMobileCode = () => {
        if (mobileCodeInput.value.trim() !== "1910") {
            mobileCodeInput.value = "";
            return;
        }
        closeMobileCodeModal();
        gameMusic.playSpecial();
        easterEggModal?.classList.remove("hidden");
    };

    wtmLogo?.addEventListener("click", () => {
        if (!isMobileDevice()) return;
        const now = Date.now();
        if (now - wtmLastTap > 1400) wtmTapCount = 0;
        wtmLastTap = now;
        wtmTapCount++;
        if (wtmTapCount === 4) {
            wtmTapCount = 0;
            openMobileCodeModal();
        }
    });

    mobileCodeConfirm?.addEventListener("click", submitMobileCode);
    mobileCodeInput?.addEventListener("keydown", event => {
        if (event.key === "Enter") submitMobileCode();
    });
    mobileCodeClose?.addEventListener("click", closeMobileCodeModal);
    mobileCodeModal?.addEventListener("click", event => {
        if (event.target === mobileCodeModal) closeMobileCodeModal();
    });

    window.__widzewAudioSettings = audioSettings;
    window.__widzewGameMusic = gameMusic;
    window.setGameMusicExcluded = value => gameMusic.setExcluded(value);

    // PANEL OPCJI DŹWIĘKU
    const settingsStyle = document.createElement("style");
    settingsStyle.textContent = `
        #gameSettings {
            position: fixed;
            top: 18px;
            left: 18px;
            z-index: 100001;
            font-family: Arial, Helvetica, sans-serif;
        }
        #gameSettingsButton {
            width: 42px;
            height: 42px;
            border: 1px solid #444;
            border-radius: 50%;
            background: rgba(15,15,15,.94);
            color: #fff;
            font-size: 21px;
            cursor: pointer;
            box-shadow: 0 5px 18px rgba(0,0,0,.35);
            display: grid;
            place-items: center;
            transition: transform .15s ease, border-color .15s ease;
        }
        #gameSettings:hover #gameSettingsButton,
        #gameSettings.open #gameSettingsButton {
            transform: rotate(35deg);
            border-color: #e30613;
        }
        #gameSettingsPanel {
            position: absolute;
            top: 50px;
            left: 0;
            width: 310px;
            padding: 20px;
            border: 1px solid #3d3d3d;
            border-radius: 14px;
            background: rgba(18,18,18,.98);
            box-shadow: 0 18px 50px rgba(0,0,0,.6);
            opacity: 0;
            visibility: hidden;
            transform: translateY(-6px);
            transition: opacity .15s ease, transform .15s ease, visibility .15s;
        }
        #gameSettings:hover #gameSettingsPanel,
        #gameSettings.open #gameSettingsPanel {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        #gameSettingsPanel h2 {
            margin: 0 0 18px;
            font-size: 21px;
            color: #fff;
        }
        .game-setting-row {
            padding: 13px 0;
            border-top: 1px solid #292929;
        }
        .game-setting-row:first-of-type { border-top: 0; }
        .game-setting-label {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: center;
            color: #eee;
            font-size: 14px;
            font-weight: 700;
        }
        .game-setting-range {
            width: 100%;
            margin-top: 10px;
            accent-color: #e30613;
            cursor: pointer;
            touch-action: pan-x;
            -webkit-tap-highlight-color: transparent;
        }
        .game-setting-toggle {
            width: 46px;
            height: 24px;
            border: 0;
            border-radius: 20px;
            background: #555;
            position: relative;
            cursor: pointer;
            flex: 0 0 auto;
        }
        .game-setting-toggle::after {
            content: "";
            position: absolute;
            width: 18px;
            height: 18px;
            top: 3px;
            left: 3px;
            border-radius: 50%;
            background: #fff;
            transition: transform .15s ease;
        }
        .game-setting-toggle.active {
            background: #e30613;
        }
        .game-setting-toggle.active::after {
            transform: translateX(22px);
        }
        .game-setting-value {
            color: #999;
            font-size: 12px;
            min-width: 42px;
            text-align: right;
        }
        @media (max-width: 600px) {
            #gameSettings { top: 10px; left: 10px; }
            #gameSettingsPanel { width: min(310px, calc(100vw - 28px)); }
        }
    `;
    document.head.appendChild(settingsStyle);

    const settings = document.createElement("div");
    settings.id = "gameSettings";
    settings.innerHTML = `
        <button id="gameSettingsButton" type="button" aria-label="Opcje dźwięku" title="Opcje dźwięku">⚙</button>
        <div id="gameSettingsPanel">
            <h2>Opcje</h2>
            <div class="game-setting-row">
                <div class="game-setting-label">
                    <span>Motyw muzyczny</span>
                    <button id="musicToggle" class="game-setting-toggle" type="button" aria-label="Włącz lub wyłącz motyw muzyczny"></button>
                </div>
            </div>
            <div class="game-setting-row">
                <div class="game-setting-label">
                    <span>Głośność menu</span>
                    <span id="musicVolumeValue" class="game-setting-value"></span>
                </div>
                <input id="musicVolume" class="game-setting-range" type="range" min="0" max="100" step="1">
            </div>
            <div class="game-setting-row">
                <div class="game-setting-label">
                    <span>Efekty dźwiękowe</span>
                    <button id="effectsToggle" class="game-setting-toggle" type="button" aria-label="Włącz lub wyłącz efekty dźwiękowe"></button>
                </div>
            </div>
            <div class="game-setting-row">
                <div class="game-setting-label">
                    <span>Głośność efektów</span>
                    <span id="effectsVolumeValue" class="game-setting-value"></span>
                </div>
                <input id="effectsVolume" class="game-setting-range" type="range" min="0" max="100" step="1">
            </div>
        </div>
    `;
    document.body.appendChild(settings);

    const musicToggle = document.getElementById("musicToggle");
    const effectsToggle = document.getElementById("effectsToggle");
    const musicVolume = document.getElementById("musicVolume");
    const effectsVolume = document.getElementById("effectsVolume");
    const musicVolumeValue = document.getElementById("musicVolumeValue");
    const effectsVolumeValue = document.getElementById("effectsVolumeValue");

    const refreshAudioSettingsUI = () => {
        musicToggle.classList.toggle("active", audioSettings.musicEnabled);
        effectsToggle.classList.toggle("active", audioSettings.effectsEnabled);
        musicVolume.value = Math.round(audioSettings.musicVolume * 100);
        effectsVolume.value = Math.round(audioSettings.effectsVolume * 100);
        musicVolumeValue.textContent = musicVolume.value + "%";
        effectsVolumeValue.textContent = effectsVolume.value + "%";
    };

    const toggleMusic = () => {
        audioSettings.musicEnabled = !audioSettings.musicEnabled;
        localStorage.setItem("widzewMusicEnabled", String(audioSettings.musicEnabled));
        if (audioSettings.musicEnabled) gameMusic.start();
        else gameMusic.stop();
        refreshAudioSettingsUI();
    };

    const toggleEffects = () => {
        audioSettings.effectsEnabled = !audioSettings.effectsEnabled;
        localStorage.setItem("widzewEffectsEnabled", String(audioSettings.effectsEnabled));
        if (window.__widzewCrowdAudio) window.__widzewCrowdAudio.setEnabled();
        if (window.__widzewCrowdIntroAudio) window.__widzewCrowdIntroAudio.applyVolume();
        if (window.__widzewCrowdGoalAudio) window.__widzewCrowdGoalAudio.applyVolume();
        if (window.__widzewCrowdGoalFollowAudio) window.__widzewCrowdGoalFollowAudio.applyVolume();
        if (window.__widzewCrowdFinalAudio) window.__widzewCrowdFinalAudio.applyVolume();
        if (window.__widzewCrowdActionAudio) window.__widzewCrowdActionAudio.applyVolume();
        refreshAudioSettingsUI();
    };

    // Na telefonach część przeglądarek potrafi pominąć/zmienić obsługę
    // zwykłego clicka przy panelu ustawień. Obsługujemy więc także touchend
    // i blokujemy następujący po nim syntetyczny click, aby nie przełączyć
    // ustawienia dwa razy.
    let suppressMusicClick = false;
    let suppressEffectsClick = false;

    musicToggle.addEventListener("click", event => {
        event.stopPropagation();
        if (suppressMusicClick) {
            suppressMusicClick = false;
            return;
        }
        toggleMusic();
    });

    effectsToggle.addEventListener("click", event => {
        event.stopPropagation();
        if (suppressEffectsClick) {
            suppressEffectsClick = false;
            return;
        }
        toggleEffects();
    });

    musicToggle.addEventListener("touchend", event => {
        event.preventDefault();
        event.stopPropagation();
        suppressMusicClick = true;
        toggleMusic();
    }, {passive:false});

    effectsToggle.addEventListener("touchend", event => {
        event.preventDefault();
        event.stopPropagation();
        suppressEffectsClick = true;
        toggleEffects();
    }, {passive:false});

    const applyMusicVolumeFromSlider = event => {
        const value = Math.min(1, Math.max(0, Number(event.target.value) / 100));
        audioSettings.musicVolume = value;
        gameMusic.setVolume(value);
        refreshAudioSettingsUI();
    };

    const applyEffectsVolumeFromSlider = event => {
        const value = Math.min(1, Math.max(0, Number(event.target.value) / 100));
        audioSettings.effectsVolume = value;
        localStorage.setItem("widzewEffectsVolume", String(value));
        if (window.__widzewCrowdAudio) window.__widzewCrowdAudio.setVolume();
        if (window.__widzewCrowdIntroAudio) window.__widzewCrowdIntroAudio.applyVolume();
        if (window.__widzewCrowdGoalAudio) window.__widzewCrowdGoalAudio.applyVolume();
        if (window.__widzewCrowdGoalFollowAudio) window.__widzewCrowdGoalFollowAudio.applyVolume();
        if (window.__widzewCrowdFinalAudio) window.__widzewCrowdFinalAudio.applyVolume();
        if (window.__widzewCrowdActionAudio) window.__widzewCrowdActionAudio.applyVolume();
        refreshAudioSettingsUI();
    };

    // input działa płynnie na komputerze i większości telefonów, a change
    // zapewnia zastosowanie wartości także w przeglądarkach mobilnych,
    // które aktualizują suwak dopiero po puszczeniu palca.
    musicVolume.addEventListener("input", applyMusicVolumeFromSlider);
    musicVolume.addEventListener("change", applyMusicVolumeFromSlider);
    effectsVolume.addEventListener("input", applyEffectsVolumeFromSlider);
    effectsVolume.addEventListener("change", applyEffectsVolumeFromSlider);

    const settingsButton = document.getElementById("gameSettingsButton");
    settingsButton.addEventListener("click", event => {
        event.stopPropagation();
        settings.classList.toggle("open");
    });
    document.addEventListener("click", event => {
        if (!settings.contains(event.target)) settings.classList.remove("open");
    });
    refreshAudioSettingsUI();

    const startMusicAfterFirstInteraction = () => {
        if (!gameMusic.excluded) gameMusic.start();
        document.removeEventListener("pointerdown", startMusicAfterFirstInteraction, true);
        document.removeEventListener("keydown", startMusicAfterFirstInteraction, true);
        document.removeEventListener("touchstart", startMusicAfterFirstInteraction, true);
    };
    document.addEventListener("pointerdown", startMusicAfterFirstInteraction, true);
    document.addEventListener("keydown", startMusicAfterFirstInteraction, true);
    document.addEventListener("touchstart", startMusicAfterFirstInteraction, true);



function positionColorClass(position, role) {
    const r = String(role || "");
    const p = String(position || "").toUpperCase().replace(/\s/g, "");

    // Dla zawodników z ławki kolor wynika z ich rzeczywistej pozycji,
    // a nie tylko z ogólnej kategorii miejsca na ławce.
    if (r.startsWith("bench-")) {
        if (p === "BR") return "position-gk";
        if (p === "LO/PO" || p === "LOPO") return "position-fullback";
        if (p === "ŚO" || p === "SO") return "position-cb";
        if (p.includes("ŚPD") || p.includes("ŚP") || p.includes("OP")) return "position-mid";
        if (p.includes("LS") || p.includes("LP") || p.includes("PS") || p.includes("PP")) return "position-wing";
        if (p === "N") return "position-n";
    }

    if (r === "br") return "position-gk";
    if (r === "loPo") return "position-fullback";
    if (r === "so") return "position-cb";
    if (r === "pomoc") return "position-mid";
    if (r === "skrzydlowi") return "position-wing";
    if (r === "napastnicy") return "position-n";

    if (p === "BR") return "position-gk";
    if (p === "LO/PO" || p === "LOPO") return "position-fullback";
    if (p === "ŚO" || p === "SO") return "position-cb";
    if (p.includes("ŚPD") || p.includes("ŚP") || p.includes("OP")) return "position-mid";
    if (p.includes("LS") || p.includes("LP") || p.includes("PS") || p.includes("PP")) return "position-wing";
    if (p === "N") return "position-n";
    return "";
}

function calculateTotalSquadValue(players) {
    return players.reduce((sum, player) => {
        const value = parseFloat(
            String((player.row && player.row["Wartość"]) || player["Wartość"] || "0")
                .replace(/\s/g, "")
                .replace(",", ".")
        );
        return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
}

function formatSquadValue(value) {
    return new Intl.NumberFormat("pl-PL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value / 1000) + " mln €";
}

    const startScreen = document.querySelector(".start-screen");
    const modeScreen = document.getElementById("modeScreen");
    const coachScreen = document.getElementById("coachScreen");
    const playerScreen = document.getElementById("playerScreen");
    const playerNameScreen = document.getElementById("playerNameScreen");
    const difficultyScreen = document.getElementById("difficultyScreen");
    const draftScreen = document.getElementById("draftScreen");
    const seasonScreen = document.getElementById("seasonScreen");
    const seasonChoiceScreen = document.getElementById("seasonChoiceScreen");

    let trainerRows = [];
    let selectedTrainer = null;
    let selectedFormation = null;
    let selectedFormationRow = null;
    let formationRows = [];
    let selectedDifficulty = null;
    let playerName = "";
    let playerDatabase = {
        br: [],
        loPo: [],
        so: [],
        pomoc: [],
        skrzydlowi: [],
        napastnicy: []
    };

    function showScreen(screen) {

        [startScreen, modeScreen, coachScreen, playerScreen, difficultyScreen, draftScreen, seasonChoiceScreen, seasonScreen]
            .forEach(s => {
                if (s) s.classList.add("hidden");
            });

        if (screen) screen.classList.remove("hidden");
        window.scrollTo(0, 0);
    }
    window.__showScreen = showScreen;

    
    async function getCSV(path) {
        const response = await fetch(`${path}?v=${Date.now()}`, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`${path}: HTTP ${response.status}`);
        }

        return parseCSV(await response.text());
    }

    // LICZNIK URUCHOMIEŃ GRY
    // Każde załadowanie strony = jedno uruchomienie.
    // Używamy prostego licznika zdarzeń bez filtrowania powtórnych wejść.
    async function registerGameLaunch() {
        const counter = document.getElementById("gameLaunchCounter");
        if (!counter || window.__gameLaunchRegistered) return;
        window.__gameLaunchRegistered = true;

        try {
            const response = await fetch(
                "https://countapi.mileshilliard.com/api/v1/hit/widzew-1910-draft-launch",
                { cache: "no-store" }
            );
            if (!response.ok) throw new Error("HTTP " + response.status);

            const data = await response.json();
            const value = Number(data?.value);
            if (!Number.isFinite(value)) throw new Error("Nieprawidłowa wartość licznika");

            counter.textContent = "Uruchomienia gry: " + value.toLocaleString("pl-PL");
        } catch (error) {
            console.warn("Nie udało się zaktualizować licznika uruchomień:", error);
            counter.textContent = "";
        }
    }

    registerGameLaunch();

    // START
    document.getElementById("startGame").addEventListener("click", () => {
        showScreen(modeScreen);
    });

    // MODE: TRAINER
    document.getElementById("coachMode").addEventListener("click", () => {
        showScreen(coachScreen);
        loadTrainerDatabase();
    });

    // MODE: PLAYER
    document.getElementById("playerMode").addEventListener("click", () => {
        showPlayerNameScreen();
    });

    function showPlayerNameScreen() {
        showScreen(playerScreen);

        const content = playerScreen.querySelector(".player-content");
        content.innerHTML = `
            <h2>JAK MAMY CIĘ NAZWAĆ?</h2>
            <p class="screen-intro">
                Wpisz swoje imię i nazwisko albo nazwę, pod którą chcesz poprowadzić Widzew.
            </p>

            <div class="player-name-form">
                <input id="playerNameInput" class="player-name-input" type="text"
                       maxlength="30" autocomplete="off"
                       placeholder="Imię, nazwisko lub nazwa gracza">
                <button id="playerNameConfirm" class="next-button" type="button">POTWIERDŹ</button>
            </div>

            <div id="playerNameMessage" class="player-name-message hidden"></div>
            <button id="playerNameContinue" class="next-button hidden" type="button">DALEJ</button>
        `;

        const input = document.getElementById("playerNameInput");
        const confirm = document.getElementById("playerNameConfirm");
        const message = document.getElementById("playerNameMessage");
        const continueButton = document.getElementById("playerNameContinue");

        const confirmName = () => {
            const value = input.value.trim();
            if (!value) {
                input.focus();
                message.textContent = "Najpierw wpisz swoją nazwę.";
                message.classList.remove("hidden");
                message.classList.add("error");
                return;
            }

            playerName = value;
            // Tryb GRACZ nie korzysta z siły trenera.
            window.__widzewGameMode = "player";
            window.__widzewCoachStrength = 0;
            input.disabled = true;
            confirm.classList.add("hidden");
            message.classList.remove("hidden", "error");
            message.innerHTML =
                "Mówią, że trzeba lata doświadczeń i kurs UEFA PRO, aby prowadzić zespół w PKO Ekstraklasie. Tobie wystarczyło tylko szczęście...";
            continueButton.classList.remove("hidden");
        };

        confirm.addEventListener("click", confirmName);
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") confirmName();
        });

        continueButton.addEventListener("click", () => {
            loadFormationDatabase();
        });

        setTimeout(() => input.focus(), 0);
    }

    // HOW TO PLAY
    const modal = document.getElementById("howToPlayModal");
    document.getElementById("howToPlay").addEventListener("click", () => {
        modal.classList.remove("hidden");
    });

    // CHANGE LOG
    const changeLogModal = document.getElementById("changeLogModal");
    document.getElementById("changeLog")?.addEventListener("click", () => {
        changeLogModal?.classList.remove("hidden");
    });
    document.getElementById("closeChangeLog")?.addEventListener("click", () => {
        changeLogModal?.classList.add("hidden");
    });
    document.getElementById("closeModal").addEventListener("click", () => {
        modal.classList.add("hidden");
    });
    document.getElementById("modalOk").addEventListener("click", () => {
        modal.classList.add("hidden");
    });

    // SUPPORT THE CREATOR
    const supportModal = document.getElementById("supportCreatorModal");
    document.getElementById("supportCreator").addEventListener("click", () => {
        supportModal.classList.remove("hidden");
    });
    document.getElementById("closeSupportModal").addEventListener("click", () => {
        supportModal.classList.add("hidden");
        if (window.__playerScorePending) {
            window.__playerScorePending = false;
            setTimeout(() => showPlayerSeasonScore(), 100);
        }
    });

    // Pokazuj dokładnie to samo okno również po zakończeniu sezonu.
    window.showSupportCreatorModal = () => {
        supportModal.classList.remove("hidden");
    };

    function calculatePlayerSeasonScore() {
        const selectedPlayers = Array.isArray(draft?.selected) ? draft.selected : [];
        const playerRatingBase = selectedPlayers.reduce((sum, player) => {
            return sum + Number(effectiveOverall(player) || 0);
        }, 0);
        const playerRating = playerRatingBase * (draft?.difficulty === "hard" ? 2 : 1);

        const teamScores = getTeamScores();
        const teamOverall = roundScore(teamScores.overall);

        const goalsFor = seasonGameState.widzewResults.reduce((sum, match) => sum + Number(match.gf || 0), 0);
        const goalsAgainst = seasonGameState.widzewResults.reduce((sum, match) => sum + Number(match.ga || 0), 0);
        const points = seasonGameState.widzewResults.reduce((sum, match) => {
            const gf = Number(match.gf || 0);
            const ga = Number(match.ga || 0);
            return sum + (gf > ga ? 3 : gf === ga ? 1 : 0);
        }, 0);
        const wins = seasonGameState.widzewResults.filter(match =>
            Number(match.gf || 0) > Number(match.ga || 0)
        ).length;

        const finalRound = seasonGameState.widzewFixtures.length
            ? Math.max(...seasonGameState.widzewFixtures.map(f => Number(f.kolejka) || 0))
            : 34;
        const standings = buildStandings(finalRound);
        const widzewRow = standings.find(row => row.name === "Widzew Łódź");
        const tablePosition = widzewRow ? standings.indexOf(widzewRow) + 1 : 18;

        const placePoints = {
            1: 100, 2: 75, 3: 50, 4: 25, 5: 20, 6: 18, 7: 15, 8: 12,
            9: 10, 10: 7, 11: 5, 12: 4, 13: 3, 14: 2, 15: 1,
            16: -25, 17: -50, 18: -100
        };

        const playedMatchCount = Number(seasonGameState.playedMatchCount || 0);
        const simulatedMatchCount = Number(seasonGameState.simulatedMatchCount || 0);
        const matchBonus = playedMatchCount * 5 + simulatedMatchCount * 1;

        const components = {
            playerRating,
            teamOverall,
            goalsForPoints: goalsFor * 5,
            goalsAgainstPoints: goalsAgainst * -5,
            pointsPoints: points * 10,
            winsPoints: wins * 3,
            matchBonus,
            tablePosition: placePoints[tablePosition] ?? 0
        };

        return {
            playerName: draft.playerName || playerName,
            formation: selectedFormation || draft.formation?.["Formacje"] || "",
            ...components,
            total: Math.round(
                components.playerRating +
                components.teamOverall +
                components.goalsForPoints +
                components.goalsAgainstPoints +
                components.pointsPoints +
                components.winsPoints +
                components.matchBonus +
                components.tablePosition
            ),
            goalsFor,
            goalsAgainst,
            points,
            wins,
            playedMatchCount,
            simulatedMatchCount,
            matchBonus,
            goalsForPoints: components.goalsForPoints,
            goalsAgainstPoints: components.goalsAgainstPoints,
            pointsPoints: components.pointsPoints,
            winsPoints: components.winsPoints,
            tablePosition,
            tablePositionPoints: components.tablePosition
        };
    }

    function showPlayerSeasonScore() {
        if (window.__widzewGameMode !== "player") return;

        const modal = document.getElementById("playerScoreModal");
        const content = document.getElementById("playerScoreContent");
        if (!modal || !content) return;

        const score = calculatePlayerSeasonScore();
        const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
            "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
        }[c]));

        const placeBonus = score.tablePositionPoints > 0 ? "+" + score.tablePositionPoints : String(score.tablePositionPoints);

        content.innerHTML =
            "<h2>Wynik sezonu</h2>" +
            "<p class='player-score-name'><strong>" + safe(score.playerName) + "</strong></p>" +
            "<p class='player-score-formation'>Formacja: <strong>" + safe(score.formation) + "</strong></p>" +
            "<div class='player-score-total'><span>TWÓJ WYNIK</span><strong>" + score.total + " PKT</strong></div>" +
            "<div class='player-score-breakdown'>" +
                "<div><span>Ocena zawodników</span><strong>+" + score.playerRating + "</strong></div>" +
                "<div><span>Ocena końcowa zespołu</span><strong>+" + score.teamOverall + "</strong></div>" +
                "<div><span>Miejsce w tabeli (" + score.tablePosition + ".)</span><strong>" + placeBonus + "</strong></div>" +
                "<div><span>Zdobyte punkty (+10 za każdy zdobyty punkt) (" + score.points + ")</span><strong>+" + score.pointsPoints + "</strong></div>" +
                "<div><span>Zwycięstwa (+3 za każde zwycięstwo) (" + score.wins + ")</span><strong>+" + score.winsPoints + "</strong></div>" +
                "<div><span>Premia za rozegrane spotkania (+5 za każde rozegrane spotkanie)</span><strong>+" + score.matchBonus + "</strong></div>" +
                "<div><span>Zdobyte gole (+5 za każdą strzeloną bramkę) (" + score.goalsFor + ")</span><strong>+" + score.goalsForPoints + "</strong></div>" +
                "<div><span>Stracone gole (-5 za każdą straconą bramkę) (" + score.goalsAgainst + ")</span><strong>" + score.goalsAgainstPoints + "</strong></div>" +
            "</div>";
        modal.classList.remove("hidden");
    }

    document.getElementById("closePlayerScoreModal")?.addEventListener("click", () => {
        document.getElementById("playerScoreModal")?.classList.add("hidden");
        window.__playerScorePending = false;
    });

    // TRAINER DATABASE
    async function loadTrainerDatabase() {
        const status = document.getElementById("coachStatus");
        const grid = document.getElementById("coachGrid");

        status.textContent = "Wczytywanie bazy trenerów...";
        status.classList.remove("error");

        try {
            trainerRows = await getCSV("data/trener.csv");

            if (!trainerRows.length) {
                throw new Error("Pusta baza trenerów.");
            }

            status.textContent =
                ``;

            renderCoaches();
        } catch (error) {
            status.textContent =
                "Nie udało się wczytać bazy trenerów.";
            status.classList.add("error");
            grid.innerHTML = "";
            console.error(error);
        }
    }

    function getUniqueCoaches() {
        const map = new Map();

        trainerRows.forEach(row => {
            const key = `${row["Imię"]}|${row["Nazwisko"]}`;

            if (!map.has(key)) {
                map.set(key, {
                    first: row["Imię"],
                    last: row["Nazwisko"],
                    seasons: []
                });
            }

            map.get(key).seasons.push(row);
        });

        return [...map.values()];
    }

    function renderCoaches() {
        const grid = document.getElementById("coachGrid");
        const coaches = getUniqueCoaches();

        grid.innerHTML = coaches.map((coach, i) => `
            <button class="coach-card" data-index="${i}">
                <span class="coach-first">${coach.first}</span>
                <span class="coach-last">${coach.last}</span>
            </button>
        `).join("");

        grid.querySelectorAll(".coach-card").forEach(card => {
            card.addEventListener("click", () => {
                const coach = coaches[Number(card.dataset.index)];

                // Multiple seasons = random season.
                const season =
                    coach.seasons[Math.floor(Math.random() * coach.seasons.length)];

                const coachStrength = Number(String(season["Siła"] ?? "0").replace(",", "."));
                selectedTrainer = {
                    first: coach.first,
                    last: coach.last,
                    season: season["Sezon"],
                    formation: season["Taktyka"],
                    faceId: season["id"],
                    strength: Number.isFinite(coachStrength) ? coachStrength : 0,
                    startRound: Math.max(1, Number(season["KolejkaStartowa"]) || 1)
                };
                // Udostępniamy wybranego trenera kodowi sezonu znajdującemu się
                // poza zakresem DOMContentLoaded.
                window.__widzewSelectedTrainer = selectedTrainer;
                window.__widzewTrainerStartRound = selectedTrainer.startRound;
                // Tryb TRENER przekazuje do meczu siłę z dokładnie wybranego rekordu sezonu.
                window.__widzewGameMode = "coach";
                window.__widzewCoachStrength = selectedTrainer.strength;

                showSelectedTrainer();

            });
        });
    }


    function showSelectedTrainer() {
        const content = coachScreen.querySelector(".coach-content");

        content.innerHTML = `
            <h2>WYBRANY TRENER</h2>
            <div class="trainer-summary">
                <div class="trainer-name">
                    <span>${selectedTrainer.first}</span>
                    <span>${selectedTrainer.last}</span>
                </div>
                <img class="trainer-face" src="data/faces/trener/${encodeURIComponent(selectedTrainer.faceId)}.png?v=1" alt="" aria-hidden="true">
                <div class="trainer-details">
                    <div>
                        <span>SEZON</span>
                        <strong>${selectedTrainer.season}</strong>
                    </div>
                    <div>
                        <span>FORMACJA</span>
                        <strong>${selectedTrainer.formation}</strong>
                    </div>
                </div>
            </div>
            <div class="trainer-actions">
                <button id="trainerBack" class="next-button trainer-back">WRÓĆ</button>
                <button id="trainerContinue" class="next-button">DALEJ</button>
            </div>
        `;

        document.getElementById("trainerBack").addEventListener("click", () => {
            selectedTrainer = null;
            window.__widzewSelectedTrainer = null;
            window.__widzewCoachStrength = 0;

            const content = coachScreen.querySelector(".coach-content");
            content.innerHTML = `
                <h2>Wybierz trenera</h2>
                <p class="screen-intro">Wybierz jednego z dotychczasowych szkoleniowców, którzy prowadzili Widzew od wejścia do PKO Ekstraklasy.</p>
                <div id="coachStatus" class="coach-status"></div>
                <div id="coachGrid" class="coach-grid"></div>
            `;

            showScreen(coachScreen);
            loadTrainerDatabase();
        });

        document.getElementById("trainerContinue").addEventListener("click", () => {
            showTrainerWelcome();
        });
    }

    // POWITANIE WTM PO WYBORZE TRENERA
    const wtmWelcomeModal = document.getElementById("wtmWelcomeModal");
    const wtmWelcomeImage = document.getElementById("wtmWelcomeImage");
    const wtmWelcomeClose = document.getElementById("wtmWelcomeClose");
    let wtmWelcomeTimer = null;

    // EASTER EGG SOPIĆ — kod jest wpisywany na grafice WTM, ale film pojawia się dopiero po X.
    const sopicEasterEggModal = document.getElementById("sopicEasterEggModal");
    const sopicEasterEggVideo = document.getElementById("sopicEasterEggVideo");
    const closeSopicEasterEgg = document.getElementById("closeSopicEasterEgg");
    const sopicUnderstandModal = document.getElementById("sopicUnderstandModal");
    const sopicUnderstandTitle = sopicUnderstandModal?.querySelector("h2");
    const sopicUnderstandParagraphs = sopicUnderstandModal?.querySelectorAll("p");
    let sopicCodeBuffer = "";
    let sopicCodeListener = null;
    let sopicCodeReady = false;
    let sopicEggTriggered = false;
    let sopicUnderstandQuestion = 1;

    const isSopicTrainer = () => {
        const trainerId = Number(window.__widzewSelectedTrainer?.faceId);
        return trainerId === 6 || trainerId === 7;
    };

    const setSopicUnderstandQuestion = question => {
        sopicUnderstandQuestion = question;

        if (sopicUnderstandTitle) {
            if (question === 1) {
                sopicUnderstandTitle.textContent = "Brawo, odkryłeś nową znajdźkę! 🎉";
            } else if (question === 2) {
                sopicUnderstandTitle.textContent = "Rzucono na Ciebie znowu zaklęcie „You must understand”.";
            } else {
                sopicUnderstandTitle.textContent = "Przestań się zgrywać i w końcu understand! 😐";
            }
        }

        if (sopicUnderstandParagraphs?.length >= 2) {
            if (question === 1) {
                sopicUnderstandParagraphs[0].innerHTML = "Rzucono na Ciebie zaklęcie <strong>„You must understand”</strong>.";
                sopicUnderstandParagraphs[1].innerHTML = "<strong>Czy Ty już understand?</strong>";
            } else if (question === 2) {
                sopicUnderstandParagraphs[0].innerHTML = "";
                sopicUnderstandParagraphs[1].innerHTML = "<strong>Czy Ty już understand?</strong>";
            } else {
                sopicUnderstandParagraphs[0].innerHTML = "";
                sopicUnderstandParagraphs[1].innerHTML = "<strong>Czy Ty już understand?</strong>";
            }
        }
    };

    const triggerSopicEasterEgg = () => {
        if (sopicEggTriggered || !isSopicTrainer()) return;
        sopicEggTriggered = true;
        sopicEasterEggModal?.classList.remove("hidden");
        if (sopicEasterEggVideo) {
            sopicEasterEggVideo.currentTime = 0;
            sopicEasterEggVideo.play().catch(() => {});
        }
    };

    const closeSopicVideo = () => {
        if (sopicEasterEggVideo) {
            sopicEasterEggVideo.pause();
            sopicEasterEggVideo.currentTime = 0;
        }
        sopicEasterEggModal?.classList.add("hidden");
        setSopicUnderstandQuestion(sopicUnderstandQuestion);
        sopicUnderstandModal?.classList.remove("hidden");
    };

    const playSopicVideoAgain = () => {
        sopicUnderstandModal?.classList.add("hidden");
        sopicEasterEggModal?.classList.remove("hidden");
        if (sopicEasterEggVideo) {
            sopicEasterEggVideo.currentTime = 0;
            sopicEasterEggVideo.play().catch(() => {});
        }
    };

    const activateSopicBonus = value => {
        if (!isSopicTrainer()) return;
        window.__sopicBonus = {
            value: Number(value) || 0,
            remainingMatches: 3
        };
    };

    const finishSopicUnderstand = () => {
        sopicUnderstandModal?.classList.add("hidden");
        disarmSopicEasterEgg();
        const selectedTrainer = window.__widzewSelectedTrainer;
        showDifficultyScreen(
            `Wybrany trener: <strong>${selectedTrainer.first} ${selectedTrainer.last}</strong><br>
             Sezon: ${selectedTrainer.season} · Formacja: ${selectedTrainer.formation}`
        );
    };

    const armSopicEasterEgg = () => {
        sopicCodeBuffer = "";
        sopicCodeReady = false;
        sopicEggTriggered = false;
        sopicUnderstandQuestion = 1;
        sopicCodeListener?.();

        const onKeyDown = event => {
            if (!isSopicTrainer() || sopicEggTriggered) return;
            if (event.ctrlKey || event.altKey || event.metaKey) return;
            if (!/^[a-zA-Z]$/.test(event.key)) return;

            sopicCodeBuffer = (sopicCodeBuffer + event.key.toLowerCase()).slice(-5);

            if (sopicCodeBuffer === "sopic") {
                sopicCodeBuffer = "";
                sopicCodeReady = true;
            }
        };

        document.addEventListener("keydown", onKeyDown);
        sopicCodeListener = () => document.removeEventListener("keydown", onKeyDown);
    };

    const disarmSopicEasterEgg = () => {
        sopicCodeBuffer = "";
        sopicCodeReady = false;
        sopicCodeListener?.();
        sopicCodeListener = null;
    };

    closeSopicEasterEgg?.addEventListener("click", closeSopicVideo);

    document.getElementById("closeSopicUnderstand")?.addEventListener("click", finishSopicUnderstand);

    document.getElementById("sopicUnderstandYes")?.addEventListener("click", () => {
        if (sopicUnderstandQuestion === 1) {
            // Pierwsze TAK — dokładnie ustalony komunikat, a następnie wybór trudności.
            sopicUnderstandTitle.textContent = "BRAWO! Ty już understand!";
            sopicUnderstandParagraphs[0].innerHTML = "Zaklęcie zadziałało! Maszyna Sopicia ruszyła! Bonus: +1 do ogólnej siły drużyny na 3 najbliższe mecze Widzewa.";
            sopicUnderstandParagraphs[1].innerHTML = "";
            document.querySelector(".sopic-understand-actions")?.classList.add("hidden");
            activateSopicBonus(1);
            return;
        }

        if (sopicUnderstandQuestion === 2) {
            // Drugie TAK — ustalony komunikat. Bonus +2 zostanie podpięty do silnika później.
            sopicUnderstandTitle.textContent = "BRAWO! W końcu zaczynasz understand!";
            sopicUnderstandParagraphs[0].innerHTML = "Wiedziałem, że w końcu zrozumiesz! Maszyna Sopicia ruszyła! Bonus: +2 do ogólnej siły drużyny na 3 najbliższe mecze Widzewa.";
            sopicUnderstandParagraphs[1].innerHTML = "";
            document.querySelector(".sopic-understand-actions")?.classList.add("hidden");
            activateSopicBonus(2);
            return;
        }

        // Trzecie TAK — ustalony komunikat. Bonus +3 zostanie podpięty do silnika później.
        sopicUnderstandTitle.textContent = "BRAWO! Przestałeś się zgrywać. Ty już understand!";
        sopicUnderstandParagraphs[0].innerHTML = "Željko może być z Ciebie dumny! Bonus: +3 do ogólnej siły drużyny na 3 najbliższe mecze Widzewa.";
        sopicUnderstandParagraphs[1].innerHTML = "";
        document.querySelector(".sopic-understand-actions")?.classList.add("hidden");
        activateSopicBonus(3);
    });

    document.getElementById("sopicUnderstandNo")?.addEventListener("click", () => {
        if (sopicUnderstandQuestion === 1) {
            sopicUnderstandQuestion = 2;
            playSopicVideoAgain();
            return;
        }

        if (sopicUnderstandQuestion === 2) {
            // Drugie NIE — ponownie odtwarzamy film, a dopiero po nim pokazujemy pytanie nr 3.
            sopicUnderstandQuestion = 3;
            playSopicVideoAgain();
            return;
        }

        // Trzecie NIE — koniec zabawy i powrót do menu.
        // Ukrywamy przyciski TAK/NIE od razu, żeby po komunikacie nie były już widoczne.
        document.querySelector(".sopic-understand-actions")?.classList.add("hidden");
        sopicUnderstandTitle.textContent = "TY NADAL NIE UNDERSTAND?! 😡";
        sopicUnderstandParagraphs[0].innerHTML = "<strong>Koniec tego.</strong>";
        sopicUnderstandParagraphs[1].innerHTML = "";
        setTimeout(() => {
            sopicUnderstandModal?.classList.add("hidden");
            window.location.reload();
        }, 1400);
    });

    function showTrainerWelcome() {
        wtmWelcomeImage.src = `data/wtm/in/${encodeURIComponent(selectedTrainer.faceId)}.PNG?v=2`;
        wtmWelcomeClose.classList.add("hidden");
        wtmWelcomeModal.classList.remove("hidden");

        // Uzbrajamy ukryty kod dokładnie w momencie pokazania grafiki WTM.
        if (isSopicTrainer()) armSopicEasterEgg();
        else disarmSopicEasterEgg();

        clearTimeout(wtmWelcomeTimer);
        wtmWelcomeTimer = setTimeout(() => {
            wtmWelcomeClose.classList.remove("hidden");
        }, 5000);
    }

    wtmWelcomeClose.addEventListener("click", () => {
        clearTimeout(wtmWelcomeTimer);
        const openSopicEgg = isSopicTrainer() && sopicCodeReady;

        wtmWelcomeModal.classList.add("hidden");

        if (openSopicEgg) {
            disarmSopicEasterEgg();
            triggerSopicEasterEgg();
            return;
        }

        disarmSopicEasterEgg();
        showDifficultyScreen(
            `Wybrany trener: <strong>${selectedTrainer.first} ${selectedTrainer.last}</strong><br>
             Sezon: ${selectedTrainer.season} · Formacja: ${selectedTrainer.formation}`
        );
    });

    const sopicEasterEggStyle = document.createElement("style");
    sopicEasterEggStyle.textContent = `
        #sopicEasterEggModal .sopic-easter-egg-card {
            width: min(900px, calc(100vw - 30px));
        }
        #sopicEasterEggVideo {
            display: block;
            width: 100%;
            max-height: 70vh;
            margin-top: 14px;
            border-radius: 10px;
            background: #000;
        }
        #sopicUnderstandModal .sopic-understand-card {
            width: min(650px, calc(100vw - 30px));
            text-align: center;
            padding: 30px;
        }
        #sopicUnderstandModal .close {
            position: absolute;
            top: 12px;
            right: 12px;
        }
        .sopic-understand-actions {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-top: 24px;
        }
    `;
    document.head.appendChild(sopicEasterEggStyle);

    // FORMATIONS DATABASE
    async function loadFormationDatabase() {
        const content = playerScreen.querySelector(".player-content");

        content.innerHTML = `
            <h2>WYBIERZ FORMACJĘ</h2>
            <p class="screen-intro">
                Wybierz jedną z pięciu losowo wylosowanych formacji.
            </p>
            <div id="formationStatus" class="formation-status">
                Wczytywanie bazy formacji...
            </div>
            <div id="formationGrid" class="formation-grid"></div>
        `;

        try {
            const rows = await getCSV("data/formacje.csv");
            formationRows = rows;

            if (rows.length < 5) {
                throw new Error(`Znaleziono tylko ${rows.length} formacji.`);
            }

            const selected = [...rows]
                .sort(() => Math.random() - 0.5)
                .slice(0, 5);

            const status = document.getElementById("formationStatus");
            const grid = document.getElementById("formationGrid");

            status.textContent =
                "Wybierz formację, w której chcesz zbudować swój skład.";

            grid.innerHTML = selected.map((formation, i) => `
                <button class="formation-card" data-index="${i}">
                    <span class="formation-name">${formation["Formacje"]}</span>
                </button>
            `).join("");

            grid.querySelectorAll(".formation-card").forEach(card => {
                card.addEventListener("click", () => {
                    selectedFormationRow = selected[Number(card.dataset.index)];
                    selectedFormation = selectedFormationRow["Formacje"];

                    grid.querySelectorAll(".formation-card").forEach(c =>
                        c.classList.remove("selected")
                    );
                    card.classList.add("selected");

                    status.textContent =
                        `Wybrano formację: ${selectedFormation}`;

                    let button = document.getElementById("formationContinue");

                    if (!button) {
                        button = document.createElement("button");
                        button.id = "formationContinue";
                        button.className = "next-button formation-continue";
                        button.textContent = "DALEJ";
                        content.appendChild(button);

                        button.addEventListener("click", () => {
                            showPlayerWelcome();
                        });
                    }
                });
            });
        } catch (error) {
            const status = document.getElementById("formationStatus");
            status.textContent =
                "Nie udało się wczytać bazy formacji. Sprawdź folder data.";
            status.classList.add("error");
            console.error(error);
        }
    }

    // POWITANIE NOWEGO TRENERA W TRYBIE GRACZ
    const playerWelcomeModal = document.getElementById("playerWelcomeModal");
    const playerWelcomeImage = document.getElementById("playerWelcomeImage");
    const playerWelcomeHeadline = document.getElementById("playerWelcomeHeadline");
    const playerWelcomeText = document.getElementById("playerWelcomeText");
    const playerWelcomeClose = document.getElementById("playerWelcomeClose");
    let playerWelcomeTimer = null;

    function showPlayerWelcome() {
        playerWelcomeHeadline.textContent =
            `OFICJALNE: ${playerName} nowym trenerem Widzewa Łódź!`;

        playerWelcomeImage.src = "data/wtm/in/gracz.png?v=1";

        playerWelcomeText.innerHTML =
            `W dzisiejszym dniu został ogłoszony szkoleniowiec czerwono-biało-czerwonych. Został nim <strong>${playerName}</strong>. Szkoleniowiec rozpocznie pracę w nadchodzącym sezonie 2022/23 PKO Ekstraklasy. Jego ulubiona formacja to: <strong>${selectedFormation}</strong>.`;

        playerWelcomeClose.classList.add("hidden");
        playerWelcomeModal.classList.remove("hidden");

        clearTimeout(playerWelcomeTimer);
        playerWelcomeTimer = setTimeout(() => {
            playerWelcomeClose.classList.remove("hidden");
        }, 5000);
    }

    playerWelcomeClose.addEventListener("click", () => {
        clearTimeout(playerWelcomeTimer);
        playerWelcomeModal.classList.add("hidden");
        showDifficultyScreen(
            `Wybrana formacja: <strong>${selectedFormation}</strong>`
        );
    });

    // DEDICATED DIFFICULTY SCREEN
    function showDifficultyScreen(context) {
        selectedDifficulty = null;

        const contextElement = document.getElementById("difficultyContext");
        const selection = document.getElementById("difficultySelection");
        const continueButton = document.getElementById("difficultyContinue");

        contextElement.innerHTML = context;
        selection.textContent = "Wybierz poziom trudności.";
        continueButton.disabled = true;

        document.querySelectorAll(".difficulty-card").forEach(card => {
            card.classList.remove("selected");
        });

        showScreen(difficultyScreen);
    }

    document.querySelectorAll(".difficulty-card").forEach(card => {
        card.addEventListener("click", () => {
            selectedDifficulty = card.dataset.difficulty;

            document.querySelectorAll(".difficulty-card").forEach(c =>
                c.classList.remove("selected")
            );
            card.classList.add("selected");

            document.getElementById("difficultySelection").textContent =
                selectedDifficulty === "easy"
                    ? "Wybrano tryb ŁATWY — oceny zawodników będą widoczne."
                    : "Wybrano tryb TRUDNY — oceny zawodników będą ukryte.";

            document.getElementById("difficultyContinue").disabled = false;
        });
    });

    async function loadPlayerDatabase() {
        const files = {
            br: "data/br.csv",
            loPo: "data/lo-po.csv",
            so: "data/so.csv",
            pomoc: "data/pomoc.csv",
            skrzydlowi: "data/skrzydlowi.csv",
            napastnicy: "data/napastnicy.csv"
        };

        const entries = Object.entries(files);
        const loaded = await Promise.all(entries.map(async ([key, path]) => {
            const rows = await getCSV(path);
            return [key, rows];
        }));

        playerDatabase = Object.fromEntries(loaded);
        return playerDatabase;
    }

    // =========================
    // WŁAŚCIWY DRAFT
    // =========================
    let draft = {
        mode: null,
        formation: null,
        difficulty: null,
        playerName: "",
        available: [],
        selected: [],
        stage: "starting",
        positionIndex: 0,
        positions: [],
        candidates: [],
        bench: [],
        benchIndex: 0,
        captainKey: null
    };

    const positionLabels = {
        br: "BR",
        loPo: "LO/PO",
        so: "ŚO",
        pomoc: "ŚPD/ŚP/OP",
        skrzydlowi: "LS/LP/PS/PP",
        napastnicy: "N"
    };


    // Indywidualny układ pozycji dla każdej z 12 formacji.
    // x/y są procentami szerokości/wysokości boiska; y rośnie w dół (nasza bramka jest na dole).
    const FORMATION_LAYOUTS = {
        "3-1-4-2": [["br",50,90],["so",27,74],["so",50,74],["so",73,74],["skrzydlowi",12,47],["pomoc",50,54],["pomoc",36,45],["pomoc",64,45],["skrzydlowi",88,47],["napastnicy",38,25],["napastnicy",62,25]],
        "3-4-1-2": [
            ["br",50,90],
            ["so",27,74],["so",50,74],["so",73,74],
            ["skrzydlowi",8,50],["pomoc",35,50],["pomoc",65,50],["skrzydlowi",92,50],
            ["pomoc",50,38],
            ["napastnicy",35,25],["napastnicy",65,25]
        ],
        "3-4-2-1": [
            ["br",50,90],
            ["so",27,74],["so",50,74],["so",73,74],
            ["skrzydlowi",8,50],["pomoc",35,50],["pomoc",65,50],["skrzydlowi",92,50],
            ["skrzydlowi",25,27],["skrzydlowi",75,27],["napastnicy",50,14]
        ],
        "3-4-3": [
            ["br",50,90],
            ["so",27,74],["so",50,74],["so",73,74],
            ["skrzydlowi",8,47],["pomoc",32,50],["pomoc",68,50],["pomoc",50,50],["skrzydlowi",92,47],
            ["skrzydlowi",14,27],["skrzydlowi",86,27],["napastnicy",50,15]
        ],
        "4-1-4-1": [
            ["br",50,90],
            ["loPo",9,74],["so",36,74],["so",64,74],["loPo",91,74],
            ["skrzydlowi",9,43],["pomoc",50,57],["pomoc",35,43],["pomoc",65,43],["skrzydlowi",91,43],
            ["napastnicy",50,15]
        ],
        "4-1-3-2": [["br",50,90],["loPo",10,72],["so",36,74],["so",64,74],["loPo",90,72],["pomoc",34,45],["pomoc",50,54],["pomoc",50,42],["pomoc",66,45],["napastnicy",37,25],["napastnicy",63,25]],
        "4-2-1-3": [["br",50,90],["loPo",10,72],["so",36,74],["so",64,74],["loPo",90,72],["pomoc",35,50],["pomoc",65,50],["pomoc",50,44],["skrzydlowi",22,25],["skrzydlowi",78,25],["napastnicy",50,17]],
        "4-3-3": [
            ["br",50,90],
            ["loPo",9,74],["so",36,74],["so",64,74],["loPo",91,74],
            ["pomoc",33,50],["pomoc",67,50],["pomoc",50,50],
            ["skrzydlowi",14,27],["skrzydlowi",86,27],["napastnicy",50,15]
        ],
        "4-4-1-1": [["br",50,90],["loPo",10,72],["so",36,74],["so",64,74],["loPo",90,72],["skrzydlowi",12,47],["pomoc",36,50],["pomoc",64,50],["pomoc",50,39],["skrzydlowi",88,47],["napastnicy",50,25]],
        "4-4-2": [
            ["br",50,90],
            ["loPo",9,74],["so",36,74],["so",64,74],["loPo",91,74],
            ["skrzydlowi",9,50],["pomoc",35,50],["pomoc",65,50],["skrzydlowi",91,50],
            ["napastnicy",35,25],["napastnicy",65,25]
        ],
        "5-4-1": [
            ["br",50,90],
            ["loPo",7,69],["so",29,74],["so",50,74],["so",71,74],["loPo",93,69],
            ["skrzydlowi",8,44],["pomoc",35,50],["pomoc",65,50],["skrzydlowi",92,44],
            ["napastnicy",50,15]
        ],
        "5-3-2": [["br",50,90],["loPo",12,69],["so",34,75],["so",50,77],["so",66,75],["loPo",88,69],["pomoc",37,50],["pomoc",50,50],["pomoc",63,50],["napastnicy",37,25],["napastnicy",63,25]]
    };

    function actualBenchPosition(p) {
        if (!String(p.role || "").startsWith("bench-")) return p.position || p.row?.["Pozycja"] || "";
        const key = p.key || playerKey(p.row);
        const hasPlayer = (arr) => Array.isArray(arr) && arr.some(row => playerKey(row) === key);
        if (p.role === "bench-br") return "BR";
        if (p.role === "bench-def") return hasPlayer(playerDatabase.loPo) ? "LO/PO" : (hasPlayer(playerDatabase.so) ? "ŚO" : "LO/PO");
        if (p.role === "bench-mid") return hasPlayer(playerDatabase.skrzydlowi) ? "LP/LS/PP/PS" : (hasPlayer(playerDatabase.pomoc) ? "ŚPD/ŚP/OP" : "LP/LS/PP/PS");
        if (p.role === "bench-n") return "N";
        return p.position || p.row?.["Pozycja"] || "";
    }

    function pitchCoordinates(formationName, role, occurrence) {
        const layout = FORMATION_LAYOUTS[String(formationName || "").trim()] || [];
        const matches = layout.filter(item => item[0] === role);
        const point = matches[occurrence - 1] || matches[0];
        return point ? { x: point[1], y: point[2] } : null;
    }

    function playerKey(row) {
        return `${row["Imię"]}|${row["Nazwisko"]}`.trim().toLowerCase();
    }

    function allPlayerRows() {
        return Object.values(playerDatabase).flat();
    }

    function createPositionSequence() {
        const f = draft.formation;
        const result = [];

        const add = (key, count) => {
            for (let i = 0; i < Number(String(count ?? "0").replace(",", ".")); i++) result.push(key);
        };

        add("br", f["BR"]);
        add("loPo", f["LO/PO"]);
        add("so", f["ŚO"]);
        add("pomoc", f["ŚPD/śP/OP"]);
        add("skrzydlowi", f["LS/LP/PS/PP"] || f["LS/SP/PS/PP"]);
        add("napastnicy", f["N"]);

        return result;
    }

    function uniqueAvailablePlayers(rows) {
        const map = new Map();
        rows.forEach(row => {
            const key = playerKey(row);
            if (!draft.available.includes(key)) return;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        return [...map.entries()];
    }

    function randomFiveForPosition(positionKey) {
        let rows;

        if (positionKey === "loPo") rows = playerDatabase.loPo;
        else if (positionKey === "so") rows = playerDatabase.so;
        else if (positionKey === "pomoc") rows = playerDatabase.pomoc;
        else if (positionKey === "skrzydlowi") rows = playerDatabase.skrzydlowi;
        else if (positionKey === "br") rows = playerDatabase.br;
        else rows = playerDatabase.napastnicy;

        const unique = uniqueAvailablePlayers(rows);
        const shuffled = unique.sort(() => Math.random() - 0.5).slice(0, 5);

        return shuffled.map(([key, records]) => {
            // Season is selected only after the player identity has been drawn.
            const record = records[Math.floor(Math.random() * records.length)];
            return { key, row: record, faceFolder: positionKey };
        });
    }

    function randomFiveForBench(type) {
        let rows = [];
        if (type === "def") rows = [...playerDatabase.loPo, ...playerDatabase.so];
        if (type === "mid") rows = [...playerDatabase.pomoc, ...playerDatabase.skrzydlowi];
        if (type === "br") rows = playerDatabase.br;
        if (type === "n") rows = playerDatabase.napastnicy;

        const unique = uniqueAvailablePlayers(rows);
        return unique.sort(() => Math.random() - 0.5).slice(0, 5).map(([key, records]) => {
            const record = records[Math.floor(Math.random() * records.length)];
            const faceFolder =
                playerDatabase.loPo.some(row => playerKey(row) === key) ? "loPo" :
                playerDatabase.so.some(row => playerKey(row) === key) ? "so" :
                playerDatabase.br.some(row => playerKey(row) === key) ? "br" :
                playerDatabase.pomoc.some(row => playerKey(row) === key) ? "pomoc" :
                playerDatabase.skrzydlowi.some(row => playerKey(row) === key) ? "skrzydlowi" :
                "napastnicy";
            return { key, row: record, faceFolder };
        });
    }

    function displayName(row) {
        return `<span>${row["Imię"]}</span><span>${row["Nazwisko"]}</span>`;
    }

    function formatPlayerValue(value) {
        const raw = String(value ?? "").trim();
        const numeric = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(numeric)) return raw ? `${raw} tys. €` : "";
        if (numeric >= 1000) {
            return `${new Intl.NumberFormat("pl-PL", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(numeric / 1000)} mln €`;
        }
        return `${new Intl.NumberFormat("pl-PL", {
            maximumFractionDigits: 0
        }).format(numeric)} tys. €`;
    }

function facePathForCandidate(card) {
        const folder = String(card?.faceFolder || "").trim();
        const id = String(card?.row?.["id"] ?? "").trim();
        if (!folder || !id) return "";
        return `data/faces/${folder}/${encodeURIComponent(id)}.png?v=45`;
    }

    function displayCandidate(card, index) {
        const row = card.row;
        const rating = row["Ogólna"];
        const value = row["Wartość"];
        const facePath = facePathForCandidate(card);

        return `
            <button class="candidate-card" data-index="${index}">
                <div class="candidate-number">${index + 1}</div>
                <div class="candidate-name">${displayName(row)}</div>
                ${facePath
                    ? `<img class="candidate-face" src="${facePath}" alt="" aria-hidden="true">`
                    : ""}
                <div class="candidate-season">${row["Sezon"]}</div>
                ${draft.difficulty === "easy"
                    ? `<div class="candidate-rating">${rating}</div>`
                    : ""}
                ${draft.difficulty === "easy" ? `<div class="candidate-value">${formatPlayerValue(value)}</div>` : ""}
            </button>
        `;
    }

    async function startDraft() {
        draft.mode = selectedTrainer ? "trainer" : "player";
        if (selectedTrainer) {
            draft.gameSeason = selectedTrainer.season || selectedTrainer.Sezon ||
                selectedTrainer.seasonName || selectedTrainer["Sezon"] || null;
        } else {
            draft.gameSeason = "22/23";
        }
        if (selectedTrainer && !formationRows.length) {
            formationRows = await getCSV("data/formacje.csv");
        }
        draft.formation = selectedTrainer
            ? (formationRows.find(row => row["Formacje"] === selectedTrainer.formation) || findFormationByName(selectedTrainer.formation))
            : (selectedFormationRow || findFormationByName(selectedFormation));

        if (!draft.formation) {
            throw new Error("Nie znaleziono wybranej formacji w bazie formacje.csv.");
        }
        draft.difficulty = selectedDifficulty;
        draft.playerName = playerName;
        draft.available = [...new Set(allPlayerRows().map(playerKey))];
        draft.selected = [];
        draft.positions = createPositionSequence();
        draft.positionIndex = 0;
        draft.stage = "starting";
        draft.bench = [];
        draft.benchIndex = 0;
        draft.captainKey = null;

        showScreen(draftScreen);
        renderDraftPosition();
    }

    function findFormationByName(name) {
        const wanted = String(name || "").trim();
        const found = formationRows.find(row => String(row["Formacje"] || "").trim() === wanted);
        if (found) return found;
        return null;
    }

    // Keep exact formation row selected by player, including its position counts.
    const originalLoadFormationDatabase = loadFormationDatabase;

    function renderDraftPosition() {
        const header = document.getElementById("draftHeader");
        const progress = document.getElementById("draftProgress");
        const position = document.getElementById("draftPosition");
        const instruction = document.getElementById("draftInstruction");
        const grid = document.getElementById("candidateGrid");
        const action = document.getElementById("draftAction");

        header.innerHTML = `<span><b class="brand-red">Widzew</b> <b class="brand-white">1910</b> <b class="brand-red">Draft</b></span>`;
        progress.textContent = `Jedenastka: ${draft.selected.length}/11`;

        const key = draft.positions[draft.positionIndex];
        const occurrence = draft.positions.slice(0, draft.positionIndex + 1)
            .filter(x => x === key).length;
        const total = draft.positions.filter(x => x === key).length;

        position.textContent = `WYBIERZ ${positionLabels[key]}${total > 1 ? ` · ${occurrence}/${total}` : ""}`;
        instruction.textContent = "Wybierz 1 z 5 wylosowanych zawodników.";
        action.innerHTML = "";

        draft.candidates = randomFiveForPosition(key);
        grid.innerHTML = draft.candidates.map(displayCandidate).join("");

        grid.querySelectorAll(".candidate-card").forEach(card => {
            card.addEventListener("click", () => selectStartingPlayer(Number(card.dataset.index)));
        });
    }

    function selectStartingPlayer(index) {
        const candidate = draft.candidates[index];
        if (!candidate) return;

        draft.selected.push({ ...candidate, role: draft.positions[draft.positionIndex] });
        draft.available = draft.available.filter(key => key !== candidate.key);
        draft.positionIndex++;

        if (draft.positionIndex >= draft.positions.length) {
            startBenchDraft();
        } else {
            renderDraftPosition();
        }
    }

    function startBenchDraft() {
        draft.stage = "bench";
        draft.bench = ["br", "def", "def", "def", "mid", "mid", "mid", "n", "n"];
        draft.benchIndex = 0;
        renderBenchPosition();
    }

    function renderBenchPosition() {
        const labels = { br: "BR", def: "OBROŃCA", mid: "POMOCNIK / SKRZYDŁOWY", n: "N" };
        const type = draft.bench[draft.benchIndex];
        const grid = document.getElementById("candidateGrid");
        const position = document.getElementById("draftPosition");
        const instruction = document.getElementById("draftInstruction");
        const progress = document.getElementById("draftProgress");
        const header = document.getElementById("draftHeader");
        const action = document.getElementById("draftAction");

        header.innerHTML = `<span><b class="brand-red">Widzew</b> <b class="brand-white">1910</b> <b class="brand-red">Draft</b></span>`;
        progress.textContent = `Ławka: ${draft.benchIndex}/9 · Cały skład: ${draft.selected.length}/20`;
        position.textContent = `WYBIERZ ${labels[type]}`;
        instruction.textContent = "Wybierz 1 z 5 wylosowanych zawodników.";
        action.innerHTML = "";

        draft.candidates = randomFiveForBench(type);
        grid.innerHTML = draft.candidates.map(displayCandidate).join("");
        grid.querySelectorAll(".candidate-card").forEach(card => {
            card.addEventListener("click", () => selectBenchPlayer(Number(card.dataset.index)));
        });
    }

    function selectBenchPlayer(index) {
        const candidate = draft.candidates[index];
        if (!candidate) return;

        draft.selected.push({ ...candidate, role: `bench-${draft.bench[draft.benchIndex]}` });
        draft.available = draft.available.filter(key => key !== candidate.key);
        draft.benchIndex++;

        if (draft.benchIndex >= draft.bench.length) {
            try {
                finishDraft();
            } catch (error) {
                console.error("Błąd ekranu końcowego:", error);
                const instruction = document.getElementById("draftInstruction");
                if (instruction) instruction.textContent = "Wystąpił błąd ekranu końcowego. Sprawdź konsolę przeglądarki.";
            }
        } else {
            renderBenchPosition();
        }
    }

    function roundScore(value) {
        return Math.round(Number(value) || 0);
    }

    function isCaptain(p) {
        return !!p && !!draft.captainKey && String(p.key || "") === String(draft.captainKey);
    }

    function effectivePlayerRow(p) {
        const row = { ...(p?.row || {}) };
        if (!isCaptain(p)) return row;

        // Kapitan dostaje +3 do każdej liczbowej statystyki.
        // Nie zmieniamy wartości bazowych w bazie zawodników.
        const statKeys = [
            "Gra nogami", "Podania", "Piąstkowanie", "Robinsonada",
            "Kreatywność", "Zaangażowanie", "Defensywa", "Szybkość",
            "Atak", "Strzał", "Ogólna"
        ];
        statKeys.forEach(key => {
            const value = Number(String(row[key] ?? "").replace(",", "."));
            if (Number.isFinite(value)) row[key] = String(value + 3);
        });
        return row;
    }

    function effectiveOverall(p) {
        return Number(effectivePlayerRow(p)["Ogólna"]) || 0;
    }

    function weightedGroupScore(players) {
        if (!players.length) return 0;
        let weightedSum = 0;
        let weightSum = 0;
        players.forEach(p => {
            const isBench = String(p.role).startsWith("bench-");
            const weight = isBench ? 0.25 : 0.75;
            weightedSum += effectiveOverall(p) * weight;
            weightSum += weight;
        });
        return weightSum ? weightedSum / weightSum : 0;
    }

    function getTeamScores() {
        const goalkeepers = draft.selected.filter(p => p.role === "br" || p.role === "bench-br");
        const defenders = draft.selected.filter(p => ["loPo", "so", "bench-def"].includes(p.role));
        const midfielders = draft.selected.filter(p => ["pomoc", "skrzydlowi", "bench-mid"].includes(p.role));
        const forwards = draft.selected.filter(p => ["napastnicy", "bench-n"].includes(p.role));

        const br = weightedGroupScore(goalkeepers);
        const defense = weightedGroupScore(defenders);
        const midfield = weightedGroupScore(midfielders);
        const attack = weightedGroupScore(forwards);
        const overall = (br + defense + midfield + attack) / 4;

        return { br, defense, midfield, attack, overall };
    }


    function getSwapPosition(p) {
        if (!p) return "";
        const role = String(p.role || "");

        // Dla zawodnika z jedenastki pozycję określa jego slot formacji.
        if (role === "br" || role === "loPo" || role === "so" ||
            role === "pomoc" || role === "skrzydlowi" || role === "napastnicy") {
            const rolePosition = {
                br: "BR",
                loPo: "LO/PO",
                so: "ŚO",
                pomoc: "ŚPD/ŚP/OP",
                skrzydlowi: "LP/LS/PP/PS",
                napastnicy: "N"
            };
            return rolePosition[role];
        }

        if (role.startsWith("bench-")) {
            return actualBenchPosition(p);
        }

        return String(p.position || p.row?.["Pozycja"] || "").trim();
    }

    function normalizeSwapPosition(pos) {
        return String(pos || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "");
    }

    function sameSwapPosition(a, b) {
        const pa = normalizeSwapPosition(getSwapPosition(a));
        const pb = normalizeSwapPosition(getSwapPosition(b));
        return pa !== "" && pa === pb;
    }

    function clearSwapSelection() {
        document.querySelectorAll(".swap-player.swap-selected, .swap-player.swap-target").forEach(el => {
            el.classList.remove("swap-selected", "swap-target");
        });
        finalSwapIndex = null;
    }

    let finalSwapIndex = null;

    function syncSeasonPlayerDatabaseFromDraft() {
        const db = window.widzewSeasonPlayerDB;
        if (!db || !Array.isArray(db.players)) return;

        db.players = draft.selected.map((p, order) => {
            const row = p?.row || {};
            const role = String(p?.role || "");
            const starter = !role.startsWith("bench-");
            const roleLabel = getSwapPosition(p);
            return {
                order,
                first: row["Imię"] || "",
                last: row["Nazwisko"] || "",
                slot: starter ? "starter" : "bench",
                role: roleLabel,
                position: String(row["Pozycja"] || roleLabel || "").trim(),
                season: row["Sezon"] || db.season || "",
                category: p?.faceFolder || "",
                stats: { ...row },
                found: true
            };
        });

        db.count = db.players.length;
        try {
            window.__widzewSeasonOverall = getTeamScores().overall;
        } catch (e) {
            console.warn("Nie udało się przeliczyć siły zespołu po zmianie składu:", e);
        }
    }

    function openSeasonSquadEditor() {
        // Zapamiętujemy dokładnie miejsce, z którego otwarto edytor.
        // Po powrocie nie wolno tworzyć nowego sezonu ani resetować wyników.
        window.__seasonSquadReturnRound = Number(seasonGameState?.currentRound || 1);
        window.__seasonSquadReturnResults = Array.isArray(seasonGameState?.widzewResults)
            ? seasonGameState.widzewResults
            : [];
        // Po rozpoczęciu sezonu korzystamy z tego samego składu, który został
        // wybrany w drafcie. Jeżeli jakaś ścieżka gry chwilowo wyczyściła
        // draft.selected, przywracamy zachowaną referencję do tego składu.
        const seasonSelected = Array.isArray(draft.selected) && draft.selected.length === 20
            ? draft.selected
            : window.__seasonDraftSelected;

        if (!Array.isArray(seasonSelected) || seasonSelected.length !== 20) {
            console.warn("[Widzew Draft] Nie można otworzyć edytora składu sezonowego: brak 20 zawodników.");
            return;
        }

        draft.selected = seasonSelected;
        window.__seasonDraftSelected = draft.selected;
        window.__seasonSquadEditMode = true;
        finalSwapIndex = null;
        finishDraft();
        showScreen(draftScreen);
    }

    function closeSeasonSquadEditor() {
        window.__seasonSquadEditMode = false;
        finalSwapIndex = null;

        // Wracamy do dokładnie tej kolejki, przed którą otwarto edytor.
        // Zachowujemy dotychczasowe wyniki i stan sezonu.
        if (seasonGameState) {
            const returnRound = Number(window.__seasonSquadReturnRound);
            if (Number.isFinite(returnRound) && returnRound > 0) {
                seasonGameState.currentRound = returnRound;
            }
            if (Array.isArray(window.__seasonSquadReturnResults)) {
                seasonGameState.widzewResults = window.__seasonSquadReturnResults;
            }
        }

        showScreen(seasonScreen);
        renderPlayableSeason();
    }

    function setupFinalSwapInteractions() {
        const grid = document.getElementById("candidateGrid");
        if (!grid) return;

        // Jedna obsługa kliknięć dla całego ekranu końcowego.
        if (grid.dataset.swapBound !== "1") {
            grid.dataset.swapBound = "1";

            grid.addEventListener("click", (event) => {
                const row = event.target.closest(".swap-player");
                if (!row || !grid.contains(row)) return;

                const starterAttr = row.getAttribute("data-starter-index");
                const benchAttr = row.getAttribute("data-bench-index");

                // 1. Kliknięcie zawodnika z jedenastki.
                if (starterAttr !== null) {
                    const idx = Number(starterAttr);
                    if (!Number.isInteger(idx) || !draft.selected[idx]) return;

                    // Drugie kliknięcie na innym zawodniku XI = wybór nowego źródła.
                    finalSwapIndex = idx;

                    grid.querySelectorAll(".swap-player").forEach(el => {
                        el.classList.remove("swap-selected", "swap-target");
                    });
                    row.classList.add("swap-selected");

                    // Podświetlamy tylko rezerwowych z tej samej pozycji.
                    grid.querySelectorAll("[data-bench-index]").forEach(el => {
                        const bi = Number(el.getAttribute("data-bench-index"));
                        if (Number.isInteger(bi) &&
                            draft.selected[bi] &&
                            sameSwapPosition(draft.selected[idx], draft.selected[bi])) {
                            el.classList.add("swap-target");
                        }
                    });
                    return;
                }

                // 2. Kliknięcie rezerwowego po wybraniu zawodnika z XI.
                if (benchAttr !== null && finalSwapIndex !== null) {
                    const benchIdx = Number(benchAttr);
                    const starterIdx = finalSwapIndex;

                    if (!Number.isInteger(benchIdx) ||
                        !Number.isInteger(starterIdx) ||
                        !draft.selected[benchIdx] ||
                        !draft.selected[starterIdx]) return;

                    const starter = draft.selected[starterIdx];
                    const bench = draft.selected[benchIdx];

                    if (!sameSwapPosition(starter, bench)) {
                        showSwapMessage("Możesz zamienić zawodnika tylko z zawodnikiem z tej samej pozycji.");
                        return;
                    }

                    // Prawdziwa zamiana miejsc w 20-osobowym składzie.
                    // XI zachowuje rolę formacji, ławka zachowuje swój slot ławki.
                    draft.selected[starterIdx] = {
                        ...bench,
                        role: starter.role
                    };
                    draft.selected[benchIdx] = {
                        ...starter,
                        role: bench.role
                    };

                    // To nadal jest ta sama, główna tablica draft.selected.
                    // Synchronizujemy jedynie istniejącą tymczasową bazę sezonową,
                    // z której korzysta silnik meczu, aby następne spotkanie
                    // od razu widziało nową jedenastkę.
                    syncSeasonPlayerDatabaseFromDraft();

                    finalSwapIndex = null;

                    // Ponownie renderujemy cały ekran, dzięki czemu
                    // boisko, listy i wszystkie oceny są aktualizowane.
                    finishDraft();
                }
            });
        }

        // Przy każdym renderze usuwamy stare podświetlenia.
        grid.querySelectorAll(".swap-player").forEach(el => {
            el.classList.remove("swap-selected", "swap-target");
        });
    }

    function showSwapMessage(message) {
        let box = document.getElementById("swapMessage");
        if (!box) {
            box = document.createElement("div");
            box.id = "swapMessage";
            box.className = "swap-message";
            document.body.appendChild(box);
        }
        box.textContent = message;
        box.classList.add("visible");
        clearTimeout(window.__swapMessageTimer);
        window.__swapMessageTimer = setTimeout(() => box.classList.remove("visible"), 2600);
    }

    function finishDraft() {
        const grid = document.getElementById("candidateGrid");
        const position = document.getElementById("draftPosition");
        const instruction = document.getElementById("draftInstruction");
        const progress = document.getElementById("draftProgress");
        const action = document.getElementById("draftAction");
        const scores = getTeamScores();

        // Bezpieczne wstawianie danych do HTML musi być zdefiniowane
        // przed pierwszym użyciem (inaczej ekran końcowy wywala się przy 20. wyborze).
        const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
            "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
        }[c]));

        position.textContent = "SKŁAD GOTOWY";
        instruction.textContent = "Twój 20-osobowy skład Widzewa.";
        const finalCoachName = selectedTrainer
            ? `${selectedTrainer.first} ${selectedTrainer.last}`
            : (draft.playerName || playerName);
        const finalSeason = selectedTrainer
            ? (selectedTrainer.season || selectedTrainer.Sezon || selectedTrainer.seasonName || draft.gameSeason || "")
            : "22/23";

        progress.innerHTML = `Cały skład: 20/20<br>
            <span class="final-coach-name">Trener: ${safe(finalCoachName)}</span><br>
            <span class="final-season">Sezon: ${safe(finalSeason)}</span>`;

        const starters = draft.selected.filter(p => !String(p.role).startsWith("bench-"));
        const bench = draft.selected.filter(p => String(p.role).startsWith("bench-"));

        const roleNames = {
            br: "BR", loPo: "LO/PO", so: "ŚO", pomoc: "ŚPD/ŚP/OP",
            skrzydlowi: "LS/LP/PS/PP", napastnicy: "N"
        };

        const playerName = p => `${safe(p.row["Imię"])} ${safe(p.row["Nazwisko"])}`;

        const formationName = String(
            selectedFormation ||
            (selectedTrainer && selectedTrainer.formation) ||
            (typeof draft.formation === "string" ? draft.formation : "")
        ).trim();

        const pitchPlayer = (p, occurrence) => {
            const point = pitchCoordinates(formationName, p.role, occurrence);
            const positionStyle = point ? `left:${point.x}%; top:${point.y}%;` : "";
            return `
            <div class="pitch-player ${positionColorClass(p.position || p["Pozycja"], p.role)}" style="${positionStyle}" title="${playerName(p)}">
                <span class="pitch-shirt ${positionColorClass(p.position || p["Pozycja"], p.role)}">${safe(p.row["#"])}</span>
                <span class="pitch-name"><span class="pitch-first-name">${safe(p.row["Imię"])}</span><span class="pitch-last-name">${safe(p.row["Nazwisko"])}</span></span>
            </div>`;
        };

        const pitchPlayers = starters.map(p => {
            const occurrence = starters.slice(0, starters.indexOf(p) + 1).filter(x => x.role === p.role).length;
            return pitchPlayer(p, occurrence);
        }).join("");

        const playerFace = p => {
            const folder = String(p?.faceFolder || "").trim();
            const id = String(p?.row?.["id"] ?? "").trim();
            if (!folder || !id) return "";
            return `<img class="squad-player-face" src="data/faces/${folder}/${encodeURIComponent(id)}.png?v=46" alt="" aria-hidden="true">`;
        };

        const benchItem = (p, i, selectedIndex) => {
            const actualPos = actualBenchPosition(p);
            const colorClass = positionColorClass(actualPos, p.role);
            return `
            <div class="bench-player swap-player" data-bench-index="${selectedIndex}">
                <span class="bench-number">${i + 1}</span>
                <div class="bench-info">
                    <strong>${playerName(p)}</strong>
                    <small>${safe(actualPos)}</small>
                </div>
                ${playerFace(p)}
                <strong class="bench-rating ${colorClass}">${roundScore(effectiveOverall(p))}</strong>
            </div>`;
        };

        const starterItem = (p, i, selectedIndex) => `
            <div class="squad-list-player swap-player" data-starter-index="${selectedIndex}">
                <span class="squad-number">${i + 1}</span>
                <div class="squad-player-info">
                    <strong>${playerName(p)}</strong>
                    <small>${roleNames[p.role] || ""}</small>
                </div>
                ${playerFace(p)}
                <strong class="squad-rating ${positionColorClass(p.position || p["Pozycja"], p.role)}">${roundScore(effectiveOverall(p))}</strong>
            </div>`;

        const formation = safe(
            selectedFormation ||
            (selectedTrainer && selectedTrainer.formation) ||
            (typeof draft.formation === "string" ? draft.formation : "")
        );

        grid.innerHTML = `
            <div class="final-layout">
                <section class="final-pitch-panel">
                    <div class="swap-instruction-final">Kliknij zawodnika z jedenastki, a następnie zawodnika z ławki, aby dokonać zamiany na tej samej pozycji.</div>
                    <div class="final-panel-heading">
                        <div class="final-branding">
                            <img src="data/widzew-crest.png" alt="Herb Widzewa Łódź" class="final-crest">
                            <div class="final-team-rating">
                                <span>OCENA OGÓLNA</span>
                                <strong>${roundScore(scores.overall)}</strong>
                            </div>
                        </div>
                        <div class="final-formation">
                            <span>FORMACJA</span>
                            <strong>${formation}</strong>
                        </div>
                    </div>

                    <div class="football-pitch">
                        <div class="pitch-lines"></div>
                        <div class="pitch-penalty-area pitch-penalty-top"></div>
                        <div class="pitch-goal-area pitch-goal-top"></div>
                        <div class="pitch-penalty-area pitch-penalty-bottom"></div>
                        <div class="pitch-goal-area pitch-goal-bottom"></div>
                        <div class="pitch-center-circle"></div>
                        <div class="pitch-center-dot"></div>
                        ${pitchPlayers}
                    </div>
                </section>

                <section class="final-list-panel">
                    <div class="final-list-heading">
                        <span>SKŁAD</span>
                        <h3>Jedenastka</h3>
                    </div>
                    <div class="squad-list">
                        ${starters.map((p, i) => starterItem(p, i, draft.selected.indexOf(p))).join("")}
                    </div>

                    <div class="final-divider"></div>

                    <div class="final-list-heading bench-heading">
                        <span>REZERWOWI</span>
                        <h3>Ławka rezerwowych</h3>
                    </div>
                    <div class="bench-list">
                        ${bench.map((p, i) => benchItem(p, i, draft.selected.indexOf(p))).join("")}
                    </div>

                    <div class="captain-panel">
                        <div class="captain-heading">
                            <span>KAPITAN</span>
                            <strong>Wybierz kapitana</strong>
                        </div>
                        <div class="captain-list">
                            ${starters.map(p => `
                                <button type="button"
                                        class="captain-player${isCaptain(p) ? " is-captain" : ""}"
                                        data-captain-key="${safe(p.key)}">
                                    <span>${playerName(p)}</span>
                                    <b>${isCaptain(p) ? "⭐ KAPITAN" : "WYBIERZ"}</b>
                                </button>
                            `).join("")}
                        </div>
                        <div class="captain-bonus">Bonus kapitana: +3 do wszystkich statystyk, w tym Ogólnej.</div>
                    </div>

                </section>
            </div>

            <div class="final-score-breakdown compact-stats">
                <div><span>BR</span><strong>${roundScore(scores.br)}</strong></div>
                <div><span>OBRONA</span><strong>${roundScore(scores.defense)}</strong></div>
                <div><span>POMOC</span><strong>${roundScore(scores.midfield)}</strong></div>
                <div><span>ATAK</span><strong>${roundScore(scores.attack)}</strong></div>
            </div>
        `;
        const seasonButtonLabel = finalSeason ? `ROZEGRAJ SEZON ${safe(finalSeason)}` : "ROZEGRAJ SEZON";
        const seasonSquadEditMode = Boolean(window.__seasonSquadEditMode);
        action.innerHTML = seasonSquadEditMode
            ? `
                <div class="draft-finished">EDYCJA SKŁADU SEZONOWEGO</div>
                <div class="season-launch">
                    <button id="closeSeasonSquadButton" class="season-launch-button" type="button">← POWRÓT DO SEZONU</button>
                    <p>Zmiany dotyczą tylko jedenastki i ławki rezerwowych. Twój 20-osobowy skład pozostaje bez zmian.</p>
                </div>`
            : `
                <div class="draft-finished">DRAFT ZAKOŃCZONY</div>
                <div class="season-launch">
                    <button id="playSeasonButton" class="season-launch-button" type="button">${seasonButtonLabel}</button>
                    <p>Jeśli jesteś gotowy z wyborem swojego składu to pora podbić PKO Ekstraklasę.</p>
                </div>`;

        if (seasonSquadEditMode) {
            document.getElementById("closeSeasonSquadButton")?.addEventListener("click", closeSeasonSquadEditor);
        } else {
            document.getElementById("playSeasonButton")?.addEventListener("click", () => {
                openSeasonScreen(finalSeason);
            });
        }
        if (!window.finalSquadAlertShown) {
            window.finalSquadAlertShown = true;
            alert('W teorii powinni grać najlepsi, jednak każdy trener ma swoich ulubieńców. Możesz na tym etapie rozgrywki wymienić zawodników ze swojej jedenastki. Pamiętaj, że bycie w podstawowej jedenastce wpływa na zaangażowanie i rozwój zawodnika.');
        }
        grid.querySelectorAll(".captain-player").forEach(button => {
            button.addEventListener("click", () => {
                const key = button.getAttribute("data-captain-key");
                const player = draft.selected.find(p => String(p.key || "") === String(key));
                if (!player) return;
                draft.captainKey = player.key;
                finishDraft();
            });
        });

        setupFinalSwapInteractions();
        updateFinalSeasonLabel();
    }

    document.getElementById("difficultyContinue").addEventListener("click", async () => {
        const button = document.getElementById("difficultyContinue");
        if (!selectedDifficulty) return;

        button.disabled = true;
        button.textContent = "WCZYTYWANIE...";

        try {
            await loadPlayerDatabase();
            selectedDifficulty = selectedDifficulty === "easy" ? "easy" : "hard";
            await startDraft();
        } catch (error) {
            console.error("Błąd uruchamiania draftu:", error);
            button.disabled = false;
            button.textContent = "ROZPOCZNIJ DRAFT";
            const selection = document.getElementById("difficultySelection");
            selection.textContent = "Nie udało się uruchomić draftu. Sprawdź folder data i konsolę przeglądarki.";
            selection.classList.add("error");
        }
    });


});

function openSeasonScreen(season) {
    // Zachowujemy dokładnie ten sam 20-osobowy skład wybrany w drafcie,
    // aby można było wrócić do niego przed każdym kolejnym meczem sezonu.
    if (Array.isArray(draft.selected) && draft.selected.length === 20) {
        window.__seasonDraftSelected = draft.selected;
    }

    const seasonValue = season || ((draft.mode === "player" || draft.mode === "gracz") ? "22/23" : draft.gameSeason || "");
    window.__seasonValue = seasonValue;

    const intro = document.getElementById("seasonChoiceIntro");
    if (intro) intro.textContent = `Sezon ${seasonValue} · wybierz sposób rozegrania rozgrywek.`;

    // W trybie TRENER oba warianty sezonu mają dodatkowe wyjaśnienie
    // dotyczące pełnego scenariusza. Tryb GRACZ pozostaje bez zmian.
    const playDescription = document.querySelector("#playWholeSeason span");
    const simulateDescription = document.querySelector("#simulateWholeSeason span");
    const isCoachMode = window.__widzewGameMode === "coach";

    if (playDescription) {
        playDescription.innerHTML = isCoachMode
            ? "<strong>Rozegraj pełny tryb scenariusza.</strong> Samodzielnie rozgrywaj mecze Widzewa i podejmuj decyzje podczas spotkań"
            : "Samodzielnie rozgrywaj kolejne mecze Widzewa i podejmuj decyzje podczas spotkań.";
    }

    if (simulateDescription) {
        simulateDescription.innerHTML = isCoachMode
            ? "<strong>Tryb całkowicie bez trybu scenariusza.</strong> Automatycznie zasymuluj wszystkie mecze Widzewa i przejdź od razu do końcowej tabeli."
            : "Automatycznie zasymuluj wszystkie mecze Widzewa i przejdź od razu do końcowej tabeli.";
    }

    if (window.__showScreen) window.__showScreen(document.getElementById("seasonChoiceScreen"));
}

function updateFinalSeasonLabel() {
    const root = document.getElementById("candidateGrid");
    if (!root) return;
    let season = (draft.mode === "player" || draft.mode === "gracz") ? "22/23" : (draft.gameSeason || "");
    if (!season) return;
    let el = root.querySelector(".final-season");
    if (!el) {
        const coach = Array.from(root.querySelectorAll("*")).find(x =>
            x.children.length === 0 && /Trener\s*:/.test((x.textContent || "").trim())
        );
        if (coach) {
            el=document.createElement("div");
            el.className="final-season";
            coach.insertAdjacentElement("afterend",el);
        }
    }
    if (el) el.textContent="Sezon: "+season;
}



/* ========================= SEZON ========================= */
const seasonGameState = {
    season: "",
    mode: "",
    currentRound: 1,
    fixtures: [],
    widzewFixtures: [],
    teams: [],
    results: [],
    widzewResults: [],
    playedMatchCount: 0,
    simulatedMatchCount: 0,
    // Wyniki innych drużyn, które nie są jeszcze wpisane do CSV.
    // Są losowane tylko raz na dany mecz podczas bieżącego sezonu.
    generatedResults: {},
    started: false
};

const logoFiles = {
    "Arka Gdynia":"arka_gdynia.png",
    "Bruk-Bet Termalica Nieciecza":"bruk-bet_termalica_nieciecza.png",
    "Cracovia":"cracovia.png",
    "Cracovia Kraków":"cracovia.png",
    "GKS Katowice":"gks_katowice.png",
    "Górnik Zabrze":"gornik_zabrze.png",
    "Jagiellonia Białystok":"jagiellonia_bialystok.png",
    "Korona Kielce":"korona_kielce.png",
    "Lech Poznań":"lech_poznan.png",
    "Lechia Gdańsk":"lechia_gdansk.png",
    "Legia Warszawa":"legia_warszawa.png",
    "ŁKS Łódź":"lks-lodz.png",
    "Miedź Legnica":"miedz_legnica.png",
    "Motor Lublin":"motor_lublin.png",
    "Piast Gliwice":"piast_gliwice.png",
    "Pogoń Szczecin":"pogon_szczecin.png",
    "Puszcza Niepołomice":"puszcza_niepolomice.png",
    "Radomiak Radom":"radomiak_radom.png",
    "Raków Częstochowa":"rakow_czestochowa.png",
    "Ruch Chorzów":"ruch_chorzow.png",
    "Śląsk Wrocław":"slask_wroclaw.png",
    "Stal Mielec":"stal_mielec.png",
    "Warta Poznań":"warta_poznan.png",
    "Widzew Łódź":"widzew_lodz.png",
    "Wieczysta Kraków":"wieczysta_krakow.png",
    "Wisła Kraków":"wisla_krakow.png",
    "Wisła Płock":"wisla_plock.png",
    "Zagłębie Lubin":"zaglebie_lubin.png"
};

function seasonSafe(v) {
    return String(v ?? "").replace(/[&<>"']/g, ch => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
}
function seasonLogo(team) {
    const file = logoFiles[String(team).trim()];
    return file ? `<img class="season-team-logo" src="data/logos/${file}" alt="">` : `<span class="season-team-logo-fallback">●</span>`;
}
function seasonNum(v) {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
}
async function loadSeasonCSV(path) {
    const response = await fetch(`${path}?v=${Date.now()}`, {cache:"no-store"});
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();

    // Bazy drużyn są zapisane w Windows-1250, natomiast terminarze w UTF-8.
    // Najpierw próbujemy UTF-8; jeśli pojawią się znaki zastępcze, dekodujemy CP1250.
    let text = new TextDecoder("utf-8", {fatal:false}).decode(buffer);
    if (text.includes("\uFFFD")) {
        text = new TextDecoder("windows-1250").decode(buffer);
    }

    const rows = parseCSV(text);
    if (!rows.length) throw new Error(`${path}: pusty plik lub nieprawidłowy CSV`);
    return rows;
}
function seasonTeamName(name) {
    let n = String(name || "").trim();
    // Some historical fixture files mark a walkover as "vo <club>".
    // For standings/logo matching the actual club is still <club>.
    n = n.replace(/^vo\s+/i, "");
    return n === "Cracovia Kraków" ? "Cracovia" : n;
}
function seasonResultParts(result) {
    const m = String(result || "").trim().match(/^(\d+)\s*:\s*(\d+)$/);
    return m ? [Number(m[1]), Number(m[2])] : null;
}
function seasonOtherResult(fixture) {
    const real = seasonResultParts(fixture?.wynik);
    if (real) return String(real[0]) + ":" + String(real[1]);

    const generated = getNonWidzewResult(fixture);
    return Array.isArray(generated) ? String(generated[0]) + ":" + String(generated[1]) : "—";
}
function getSopicBonusOverall() {
    const bonus = window.__sopicBonus;
    if (!bonus || Number(bonus.remainingMatches) <= 0 || Number(bonus.value) <= 0) return 0;
    return Number(bonus.value);
}

function consumeSopicBonusMatch() {
    const bonus = window.__sopicBonus;
    if (!bonus || Number(bonus.remainingMatches) <= 0) return;

    bonus.remainingMatches = Number(bonus.remainingMatches) - 1;
    if (bonus.remainingMatches <= 0) {
        window.__sopicBonus = null;
    }
}

function generateProvisionalWidzewResult(opponent, home) {
    // Zawsze zwracamy [gole Widzewa, gole przeciwnika].
    // Widzew musi mieć normalną, niezależną od trybu gry szansę na zdobywanie bramek.
    const opponentRow = seasonGameState.teams.find(t =>
        seasonTeamName(t["drużyna"] || t["druzyna"] || t["Drużyna"]) === seasonTeamName(opponent)
    );
    const opp = opponentRow ? seasonNum(opponentRow["Ogólna"]) : 65;
    const raw = Number(window.__widzewSeasonOverall);
    const baseWidzew = Number.isFinite(raw) && raw > 0 ? raw : 65;
    const widzew = baseWidzew + getSopicBonusOverall();
    const diff = Math.max(-20, Math.min(20, widzew - opp));

    let pGoal = 0.58 + diff * 0.008 + (home ? 0.04 : -0.03);
    pGoal = Math.max(0.42, Math.min(0.78, pGoal));

    const drawWidzewGoals = () => {
        const r = Math.random();
        if (r >= pGoal) return 0;
        const q = Math.random();
        if (q < 0.50) return 1;
        if (q < 0.83) return 2;
        if (q < 0.96) return 3;
        if (q < 0.99) return 4;
        return 5;
    };

    let oGoal = 0.71 - diff * 0.008 + (home ? -0.03 : 0.04);
    oGoal = Math.max(0.45, Math.min(0.80, oGoal));
    const drawOpponentGoals = () => {
        if (Math.random() >= oGoal) return 0;
        const r = Math.random();
        if (r < 0.40) return 1;
        if (r < 0.70) return 2;
        if (r < 0.97) return 3;
        if (r < 0.99) return 4;
        return 5;
    };

    return [drawWidzewGoals(), drawOpponentGoals()];
}

/*
 * Generator brakujących wyników meczów innych drużyn.
 *
 * Dla każdego zespołu używamy rozkładu liczby goli wyliczonego przez autora
 * gry na podstawie kilku sezonów Ekstraklasy. Gospodarz i gość są losowani
 * niezależnie jednym Math.random() każdy.
 *
 * Ważne: ta funkcja NIE dotyka wyników Widzewa.
 */
const NON_WIDZEW_HOME_GOAL_CDF = [
    [0, 0.2273],
    [1, 0.5585],
    [2, 0.8095],
    [3, 0.9297],
    [4, 0.9755],
    [5, 0.9943],
    [6, 0.9984],
    [7, 0.9992],
    [8, 1.0000]
];

const NON_WIDZEW_AWAY_GOAL_CDF = [
    [0, 0.3058],
    [1, 0.6778],
    [2, 0.8945],
    [3, 0.9722],
    [4, 0.9943],
    [5, 0.9992],
    [6, 1.0000]
];

function drawNonWidzewGoals(cdf) {
    const r = Math.random();
    for (const [goals, limit] of cdf) {
        if (r < limit) return goals;
    }
    return cdf[cdf.length - 1][0];
}

function generateNonWidzewResult() {
    return [
        drawNonWidzewGoals(NON_WIDZEW_HOME_GOAL_CDF),
        drawNonWidzewGoals(NON_WIDZEW_AWAY_GOAL_CDF)
    ];
}


const WIDZEW_SCORER_WEIGHTS = [
    ["starter", "N", 33], ["starter", "MID", 12], ["starter", "WING", 9],
    ["starter", "DEF", 7], ["starter", "CB", 5],
    ["bench", "N", 18], ["bench", "MID", 6], ["bench", "WING", 5],
    ["bench", "DEF", 3], ["bench", "CB", 1], ["own", "OWN", 1]
];
function scorerCategory(p) {
    const pos = normalizeSwapPosition(getSwapPosition(p));
    if (pos === "N") return "N";
    if (pos === "ŚO") return "CB";
    if (pos === "LO/PO") return "DEF";
    if (pos === "ŚPD/ŚP/OP") return "MID";
    if (pos === "LP/LS/PP/PS") return "WING";
    return "N";
}
function chooseWeightedScorer() {
    const starters = draft.selected.filter(p => !String(p.role || "").startsWith("bench-"));
    const bench = draft.selected.filter(p => String(p.role || "").startsWith("bench-"));
    const starterPools = { N: [], MID: [], WING: [], DEF: [], CB: [] };
    const benchPools = { N: [], MID: [], WING: [], DEF: [], CB: [] };
    starters.forEach(p => { const c=scorerCategory(p); if(starterPools[c]) starterPools[c].push(p); });
    bench.forEach(p => { const c=scorerCategory(p); if(benchPools[c]) benchPools[c].push(p); });

    // Jeśli brakuje kategorii w podstawowej XI, jej 1/4 wagi trafia do każdej
    // dostępnej kategorii podstawowej XI – zgodnie z ustalonymi zasadami.
    const base = {N:33, MID:12, WING:9, DEF:7, CB:5};
    const starterWeights = {...base};
    const available = Object.keys(base).filter(c => starterPools[c].length);
    Object.keys(base).forEach(c => {
        if(!starterPools[c].length && available.length) {
            const bonus=base[c]/4;
            available.forEach(a => starterWeights[a]+=bonus);
        }
    });

    const candidates=[];
    available.forEach(c => candidates.push(["starter",c,starterWeights[c]]));
    const benchWeights={N:18,MID:6,WING:5,DEF:3,CB:1};
    Object.keys(benchWeights).forEach(c => {
        if(benchPools[c].length) candidates.push(["bench",c,benchWeights[c]]);
    });
    // Samobój pozostaje 1% puli.
    candidates.push(["own","OWN",1]);

    // Awaryjnie zawsze wybierz zawodnika z pola, jeśli draft jest nietypowy.
    const fallback = [...starters,...bench].filter(p => {
        const pos=normalizeSwapPosition(getSwapPosition(p));
        return pos !== "BR";
    });
    if(!candidates.length || !fallback.length) return {type:"opponent",name:"Przeciwnik"};

    const total=candidates.reduce((sum,x)=>sum+x[2],0);
    let roll=Math.random()*total;
    for(const [side,cat,weight] of candidates) {
        roll-=weight;
        if(roll<=0) {
            if(side==="own") return {type:"own",name:"Samobój"};
            const pool=side==="starter" ? starterPools[cat] : benchPools[cat];
            if(pool.length) {
                const player=pool[Math.floor(Math.random()*pool.length)];
                const first=player.row?.["Imię"] || player.row?.["Imie"] || "";
                const last=player.row?.["Nazwisko"] || "";
                const name=`${first} ${last}`.trim() || player.name || "Zawodnik Widzewa";
                return {type:"widzew",player,name};
            }
        }
    }
    const player=fallback[Math.floor(Math.random()*fallback.length)];
    const name=`${player.row?.["Imię"] || player.row?.["Imie"] || ""} ${player.row?.["Nazwisko"] || ""}`.trim() || "Zawodnik Widzewa";
    return {type:"widzew",player,name};
}
function makeMatchScorers(widzewGoals, opponentGoals) {
    const usedMinutes=new Set();
    const minute=()=>{
        let m=1+Math.floor(Math.random()*90);
        while(usedMinutes.has(m) && usedMinutes.size<90) m=1+Math.floor(Math.random()*90);
        usedMinutes.add(m); return m;
    };
    const scorers=[];
    for(let i=0;i<Number(widzewGoals||0);i++) {
        const s=chooseWeightedScorer();
        scorers.push({minute:minute(),type:s.type,name:s.name,player:s.player||null});
    }
    for(let i=0;i<Number(opponentGoals||0);i++) {
        scorers.push({minute:minute(),type:"opponent",name:"Przeciwnik",player:null});
    }
    return scorers.sort((a,b)=>a.minute-b.minute);
}
function updateTopScorersFromMatch(match) {
    if (!seasonGameState.scorers) seasonGameState.scorers={};
    (match.scorers||[]).forEach(s=>{
        if(s.type==="widzew" && s.player) {
            const key=playerKey(s.player.row);
            if(!seasonGameState.scorers[key]) seasonGameState.scorers[key]={name:s.name,goals:0};
            seasonGameState.scorers[key].goals++;
        }
    });
}
function renderTopScorers() {
    // Tymczasowa baza sezonowa jest źródłem prawdy dla panelu strzelców.
    if (typeof window.renderSeasonScorers === "function") {
        window.renderSeasonScorers();
        return;
    }
    const el=document.getElementById("topScorers");
    if(!el) return;
    const rows=Object.values(seasonGameState.scorers||{}).sort((a,b)=>b.goals-a.goals || a.name.localeCompare(b.name,"pl"));
    el.innerHTML=rows.length ? rows.map((r,i)=>`<div class="scorer-row"><span>${i+1}.</span><strong>${seasonSafe(r.name)}</strong><b>${r.goals}</b></div>`).join("") : `<div class="scorer-empty">Brak bramek Widzewa.</div>`;
}
function getWidzewFixtures() {
    return seasonGameState.fixtures
        .filter(f => seasonTeamName(f.gospodarz) === "Widzew Łódź" || seasonTeamName(f.gosc) === "Widzew Łódź")
        .sort((a,b) => Number(a.kolejka) - Number(b.kolejka));
}
function getWidzewFixture(round) {
    return seasonGameState.widzewFixtures.find(f => Number(f.kolejka) === Number(round));
}
function getNonWidzewGeneratedResultKey(fixture) {
    return [
        Number(fixture?.kolejka),
        seasonTeamName(fixture?.gospodarz),
        seasonTeamName(fixture?.gosc)
    ].join("|");
}

function getNonWidzewResult(fixture) {
    if (!fixture) return null;

    // Rzeczywisty wynik z terminarza zawsze ma pierwszeństwo.
    const real = seasonResultParts(fixture.wynik);
    if (real) return real;

    if (!seasonGameState.generatedResults) seasonGameState.generatedResults = {};
    const key = getNonWidzewGeneratedResultKey(fixture);

    // Brak ponownego losowania tego samego meczu podczas jednego sezonu.
    if (Array.isArray(seasonGameState.generatedResults[key])) {
        return seasonGameState.generatedResults[key];
    }

    const generated = generateNonWidzewResult();
    seasonGameState.generatedResults[key] = generated;
    return generated;
}

function completedNonWidzewFixtures(upToRound) {
    return seasonGameState.fixtures.filter(f => {
        const r=Number(f.kolejka);
        if (r > upToRound) return false;

        const isW = seasonTeamName(f.gospodarz)==="Widzew Łódź" || seasonTeamName(f.gosc)==="Widzew Łódź";
        return !isW && !!getNonWidzewResult(f);
    });
}
function seasonWidzewResultsByRound() {
    const map = {};
    seasonGameState.widzewResults.forEach(r => map[r.round] = r);
    return map;
}
function buildStandings(round) {
    const names = new Set(["Widzew Łódź"]);

    // Baza ocen dostarcza zespoły, ale terminarz jest źródłem prawdy dla
    // tego, kto rzeczywiście występuje w danym sezonie.
    seasonGameState.teams.forEach(t => {
        const n = seasonTeamName(t["drużyna"] || t["druzyna"] || t["Drużyna"]);
        if (n) names.add(n);
    });
    seasonGameState.fixtures.forEach(f => {
        const h = seasonTeamName(f.gospodarz), a = seasonTeamName(f.gosc);
        if (h) names.add(h);
        if (a) names.add(a);
    });

    const stats = {};
    [...names].forEach(name => stats[name] = {
        name, mp:0, w:0, d:0, l:0, gf:0, ga:0, pts:0
    });

    completedNonWidzewFixtures(round).forEach(f => {
        applyStandingResult(
            stats,
            seasonTeamName(f.gospodarz),
            seasonTeamName(f.gosc),
            getNonWidzewResult(f)
        );
    });

    seasonGameState.widzewResults.forEach(r => {
        if (Number(r.round) <= Number(round)) {
            const opponent = seasonTeamName(r.opponent);
            if (r.home) {
                applyStandingResult(stats, "Widzew Łódź", opponent, [r.gf, r.ga]);
            } else {
                applyStandingResult(stats, opponent, "Widzew Łódź", [r.ga, r.gf]);
            }
        }
    });

    return Object.values(stats)
        .filter(r => r.name)
        .sort((a,b) =>
            b.pts-a.pts ||
            ((b.gf-b.ga)-(a.gf-a.ga)) ||
            b.gf-a.gf ||
            a.name.localeCompare(b.name,"pl")
        );
}
function applyStandingResult(stats, home, away, score) {
    if (!score || !home || !away) return;
    if (!stats[home]) stats[home]={name:home,mp:0,w:0,d:0,l:0,gf:0,ga:0,pts:0};
    if (!stats[away]) stats[away]={name:away,mp:0,w:0,d:0,l:0,gf:0,ga:0,pts:0};

    const [hg,ag]=score;
    stats[home].mp++; stats[away].mp++;
    stats[home].gf+=hg; stats[home].ga+=ag;
    stats[away].gf+=ag; stats[away].ga+=hg;
    if (hg>ag) {
        stats[home].w++; stats[away].l++; stats[home].pts+=3;
    } else if (hg<ag) {
        stats[away].w++; stats[home].l++; stats[away].pts+=3;
    } else {
        stats[home].d++; stats[away].d++;
        stats[home].pts++; stats[away].pts++;
    }
}
function renderLeagueTable(round, final=false) {
    const el=document.getElementById("leagueTable");
    if(!el) return;
    const rows=buildStandings(round);
    el.innerHTML = rows.map((r,i)=>`
        <div class="league-row ${r.name==="Widzew Łódź" ? "is-widzew":""}">
            <span class="league-pos">${i+1}</span>
            <span class="league-team">${seasonLogo(r.name)}<b>${seasonSafe(r.name)}</b></span>
            <span>${r.mp}</span><span>${r.w}</span><span>${r.d}</span><span>${r.l}</span>
            <span>${r.gf}:${r.ga}</span><strong>${r.pts}</strong>
        </div>`).join("");
    document.getElementById("leagueTableTitle").textContent = final ? "TABELA KOŃCOWA" : "PKO EKSTRAKLASA";
    renderTopScorers();
}
function renderMatchScorers(scorers) {
    const list = Array.isArray(scorers) ? scorers : [];
    const isOwn = s => {
        const t = String(s?.type || "").toLowerCase();
        return t === "own" || t === "own-goal" || t === "samoboj" ||
            String(s?.name || "").toLocaleLowerCase("pl") === "samobój";
    };
    const normal = list.filter(s => !isOwn(s))
        .sort((a,b) => Number(a.minute || 0) - Number(b.minute || 0));
    const own = list.filter(isOwn)
        .sort((a,b) => Number(a.minute || 0) - Number(b.minute || 0));
    const row = s => {
        const type = String(s?.type || "").toLowerCase();
        const cls = type === "opponent" ? " scorer-opponent" : " scorer-widzew";
        return `<span class="${cls}">${Number(s.minute) || 1}' ${seasonSafe(s.name || (type === "opponent" ? "Przeciwnik" : "Samobój"))}</span>`;
    };
    return normal.map(row).join("") +
        (own.length ? `<span class="scorer-own-divider"></span>${own.map(row).join("")}` : "");
}

const COACH_DISMISSAL_RULES = {
    1:  { type: "finalTable", minPosition: 16, maxPosition: 18, image: "data/wtm/out/1.PNG" },
    2:  { type: "seasonPoints", round: 7, maxPoints: 7, image: "data/wtm/out/1.PNG" },
    3:  { type: "finalTable", minPosition: 16, maxPosition: 18, image: "data/wtm/out/2.PNG" },
    4:  { type: "seasonPoints", round: 22, maxPoints: 27, image: "data/wtm/out/2.PNG" },
    5:  { type: "coachPoints", matches: 3, maxPoints: 4, image: "data/wtm/out/3.PNG" },
    6:  { type: "finalTable", minPosition: 16, maxPosition: 18, image: "data/wtm/out/4.PNG" },
    7:  { type: "seasonPoints", round: 7, maxPoints: 7, image: "data/wtm/out/4.PNG" },
    8:  { type: "coachPoints", matches: 5, maxPoints: 6, image: "data/wtm/out/5.PNG" },
    9:  { type: "coachPoints", matches: 12, maxPoints: 11, image: "data/wtm/out/7.PNG" },
    10: { type: "finalTable", minPosition: 16, maxPosition: 18, image: "data/wtm/out/10.PNG" },
    11: { type: "seasonPoints", round: 7, maxPoints: 7, image: "data/wtm/out/10.PNG" },
    12: { type: "finalTable", minPosition: 16, maxPosition: 18, image: null }
};

// Podsumowanie kadencji w trybie TRENER.
// triggerRound = kolejka, po której komunikat ma się pojawić.
// matches = liczba meczów z kadencji brana do statystyk; null = wszystkie rozegrane przez gracza do tej kolejki.
const COACH_MILESTONE_RULES = {
    1:  { triggerRound: 34, targetMatches: 34, actual: { matches: 34, position: 12, wins: 11, draws: 8, losses: 15, goalsFor: 38, goalsAgainst: 47, points: 41 } },
    2:  { triggerRound: 7,  targetMatches: 7, actual: { matches: 7, position: 12, wins: 2, draws: 3, losses: 4, goalsFor: 8, goalsAgainst: 12, points: 7 } },
    3:  { triggerRound: 34, targetMatches: 27, actual: { matches: 27, position: 9, wins: 11, draws: 6, losses: 10, goalsFor: 37, goalsAgainst: 34, points: 39 } },
    4:  { triggerRound: 22, targetMatches: 22, actual: { matches: 22, position: 12, wins: 7, draws: 5, losses: 10, goalsFor: 26, goalsAgainst: 37, points: 26 } },
    5:  { triggerRound: 25, targetMatches: 3, actual: { matches: 3, position: 13, wins: 1, draws: 1, losses: 1, goalsFor: 2, goalsAgainst: 2, points: 4 } },
    6:  { triggerRound: 34, targetMatches: 9, actual: { matches: 9, position: 13, wins: 3, draws: 1, losses: 5, goalsFor: 10, goalsAgainst: 10, points: 10 } },
    7:  { triggerRound: 6,  targetMatches: 6, actual: { matches: 6, position: 12, wins: 2, draws: 1, losses: 3, goalsFor: 8, goalsAgainst: 7, points: 7 } },
    8:  { triggerRound: 11, targetMatches: 5, actual: { matches: 5, position: 11, wins: 2, draws: 0, losses: 3, goalsFor: 9, goalsAgainst: 8, points: 6 } },
    9:  { triggerRound: 23, targetMatches: 12, actual: { matches: 12, position: 17, wins: 3, draws: 2, losses: 7, goalsFor: 12, goalsAgainst: 18, points: 11 } },
    10: { triggerRound: 34, targetMatches: 11, actual: { matches: 11, position: 14, wins: 5, draws: 3, losses: 3, goalsFor: 12, goalsAgainst: 8, points: 18 } },
    11: { triggerRound: 7,  targetMatches: 7,  actual: { matches: 7, position: 13, wins: 1, draws: 4, losses: 2, goalsFor: 10, goalsAgainst: 10, points: 7 } },
    12: { triggerRound: 9,  targetMatches: 2, actual: { matches: 2, position: 12, wins: 0, draws: 2, losses: 0, goalsFor: 3, goalsAgainst: 3, points: 2 } }
};

// Grafiki kończące karierę trenera po kliknięciu „ZAKOŃCZ GRĘ".
// Docelowe pliki dla poszczególnych trenerów będziemy uzupełniać osobno.
// Na razie korzystamy z istniejących grafik zwolnienia jako bezpiecznego fallbacku.
const COACH_FAREWELL_IMAGES = {
    1: "data/wtm/out/1.PNG",
    2: "data/wtm/out/1.PNG",
    3: "data/wtm/out/2.PNG",
    4: "data/wtm/out/2.PNG",
    5: "data/wtm/out/3.PNG",
    6: "data/wtm/out/4.PNG",
    7: "data/wtm/out/4.PNG",
    8: "data/wtm/out/5.PNG",
    9: "data/wtm/out/7.PNG",
    10: "data/wtm/out/10.PNG",
    11: "data/wtm/out/10.PNG",
    12: "data/wtm/out/else.png"
};

// Warunki decyzji zarządu po podsumowaniu kadencji.
const COACH_DECISION_RULES = {
    1: [
        { when: s => s.position <= 13, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position === 14, message: "Osiągnąłeś ten sam wynik co prawdziwy trener. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position === 15, message: "Osiągnąłeś wynik gorszy niż prawdziwy trener, ale zarząd chce Ci dać kolejną szansę. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position >= 16, message: "Osiągnąłeś wynik znacznie gorszy niż prawdziwy trener. Doprowadziłeś do spadku, zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    2: [
        { when: s => s.points >= 8, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener. Możesz prowadzić zespół w kolejnych meczach lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.points <= 7 && s.derbyLost, message: "Zarząd jest niezadowolony z Twoich wyników, a do tego przegrałeś Derby Łodzi. Zostałeś zwolniony. Gra skończona.", canContinue: false },
        { when: s => s.points <= 7, message: "Zarząd jest niezadowolony z Twoich wyników, zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    3: [
        { when: s => s.position <= 8, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position === 9, message: "Osiągnąłeś ten sam wynik co prawdziwy trener. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position >= 10 && s.position <= 11, message: "Osiągnąłeś wynik gorszy niż prawdziwy trener, ale zarząd chce Ci dać kolejną szansę. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position >= 16, message: "Osiągnąłeś wynik znacznie gorszy niż prawdziwy trener. Doprowadziłeś do spadku, zostałeś zwolniony. Gra skończona.", canContinue: false },
        { when: s => s.position >= 12 && s.position <= 15, message: "Osiągnąłeś wynik znacznie gorszy niż prawdziwy trener. Zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    4: [
        { when: s => s.position <= 11, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position === 12, message: "Osiągnąłeś ten sam wynik co prawdziwy trener. Zarząd jest niezadowolony z Twoich wyników. Zostałeś zwolniony. Gra skończona", canContinue: false },
        { when: s => s.position >= 13, message: "Osiągnąłeś wynik gorszy niż prawdziwy trener. Zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    5: [
        { when: s => s.points >= 5, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener. Możesz prowadzić zespół w kolejnych meczach lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.points <= 4, message: "Zarząd jest niezadowolony z Twoich wyników, zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    6: [
        { when: s => s.position <= 12, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position === 13, message: "Osiągnąłeś ten sam wynik co prawdziwy trener. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position >= 14 && s.position <= 15, message: "Osiągnąłeś wynik gorszy niż prawdziwy trener, ale zarząd chce Ci dać kolejną szansę. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position >= 16, message: "Osiągnąłeś wynik znacznie gorszy niż prawdziwy trener. Doprowadziłeś do spadku, zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    7: [
        { when: s => s.points >= 8, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener. Możesz prowadzić zespół w kolejnych meczach lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.points <= 7, message: "Zarząd jest niezadowolony z Twoich wyników, zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    8: [
        { when: s => s.points >= 7, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener, ale \"afera grecka\" Cię pogrążyła. Zostałeś zwolniony. Gra skończona.", canContinue: false },
        { when: s => s.points === 6, message: "Osiągnąłeś ten sam wynik co prawdziwy trener, ale \"afera grecka\" Cię pogrążyła. Zostałeś zwolniony. Gra skończona.", canContinue: false },
        { when: s => s.points <= 5, message: "Osiągnąłeś wynik gorszy niż prawdziwy trener, a do tego \"afera grecka\" Cię pogrążyła. Zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    9: [
        { when: s => s.position <= 15, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position === 16, message: "Osiągnąłeś wynik nie co prawdziwy trener, ale nadal jesteś w strefie spadkowej. Zostałeś zwolniony. Gra skończona.", canContinue: false },
        { when: s => s.position === 17, message: "Osiągnąłeś wynik ten sam co prawdziwy trener. Zostałeś zwolniony. Gra skończona.", canContinue: false },
        { when: s => s.position >= 18, message: "Osiągnąłeś wynik gorszy niż prawdziwy trener. Doprowadziłeś do spadku, zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    10: [
        { when: s => s.position <= 13, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position === 14, message: "Osiągnąłeś ten sam wynik co prawdziwy trener. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position === 15, message: "Osiągnąłeś wynik gorszy niż prawdziwy trener, ale zarząd chce Ci dać kolejną szansę. Możesz prowadzić zespół w kolejnym sezonie lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.position >= 16, message: "Osiągnąłeś wynik znacznie gorszy niż prawdziwy trener. Doprowadziłeś do spadku, zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    11: [
        { when: s => s.points >= 8, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener. Możesz prowadzić zespół w kolejnych meczach lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.points === 7, message: "Osiągnąłeś ten sam wynik co prawdziwy trener. Zarząd jest niezadowolony z Twoich wyników, zostałeś zwolniony. Gra skończona.", canContinue: false },
        { when: s => s.points <= 6, message: "Osiągnąłeś wynik gorszy niż prawdziwy trener. Zostałeś zwolniony. Gra skończona.", canContinue: false }
    ],
    12: [
        { when: s => s.points >= 3, message: "Brawo osiągnąłeś lepszy wynik niż prawdziwy trener, ale Mateusz Stolarski dalej jest trenerem Widzewa. Możesz prowadzić zespół w kolejnych meczach lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.points === 2, message: "Osiągnąłeś wynik ten sam co prawdziwy trener, ale Mateusz Stolarski dalej jest trenerem Widzewa. Możesz prowadzić zespół w kolejnych meczach lub odejść i zakończyć grę.", canContinue: true },
        { when: s => s.points <= 1, message: "Osiągnąłeś wynik gorszy niż prawdziwy trener, ale Mateusz Stolarski dalej jest trenerem Widzewa. Możesz prowadzić zespół w kolejnych meczach lub odejść i zakończyć grę.", canContinue: true }
    ]
};
function coachResultsPoints(results) {
    return results.reduce((sum, match) => {
        const gf = Number(match.gf || 0);
        const ga = Number(match.ga || 0);
        return sum + (gf > ga ? 3 : gf === ga ? 1 : 0);
    }, 0);
}

function getCoachMilestoneStatus() {
    // Komunikat działa poza DOMContentLoaded, dlatego korzysta z globalnego
    // odnośnika do wybranego trenera zamiast z lokalnego selectedTrainer.
    const activeTrainer = window.__widzewSelectedTrainer;
    if (window.__widzewGameMode !== "coach" || !activeTrainer || window.__coachMilestoneShown) return null;

    const coachId = Number(activeTrainer.faceId);
    const rule = COACH_MILESTONE_RULES[coachId];
    if (!rule) return null;

    const triggerRound = Number(rule.triggerRound);
    const targetMatches = Number(rule.targetMatches);
    const startRound = Math.max(1, Number(activeTrainer.startRound) || 1);
    const currentRound = Number(seasonGameState.currentRound) || 0;

    // Najważniejszy warunek: liczymy WYŁĄCZNIE mecze rozegrane przez gracza
    // od momentu objęcia zespołu. Nie czekamy na obecność konkretnego numeru
    // kolejki w bazie wyników, bo wynik może być zapisany inną ścieżką
    // (symulacja albo interaktywny mecz).
    const results = (seasonGameState.widzewResults || [])
        .filter(match => Number(match.round) >= startRound)
        .sort((a, b) => Number(a.round) - Number(b.round));

    const playedMatches = results.length;

    // Nie pokazujemy komunikatu wcześniej niż po osiągnięciu wymaganej liczby
    // meczów i nie wcześniej niż po kolejce wskazanej w regule.
    if (playedMatches < targetMatches || currentRound < triggerRound) return null;

    // Bierzemy dokładnie tyle ostatnio rozegranych meczów, ile przewiduje
    // licznik dla danego trenera.
    const periodResults = results.slice(0, targetMatches);
    if (periodResults.length < targetMatches) return null;

    const points = coachResultsPoints(periodResults);
    const wins = periodResults.filter(match => Number(match.gf) > Number(match.ga)).length;
    const draws = periodResults.filter(match => Number(match.gf) === Number(match.ga)).length;
    const losses = periodResults.filter(match => Number(match.gf) < Number(match.ga)).length;
    const goalsFor = periodResults.reduce((sum, match) => sum + Number(match.gf || 0), 0);
    const goalsAgainst = periodResults.reduce((sum, match) => sum + Number(match.ga || 0), 0);
    const standings = buildStandings(triggerRound);
    const widzewRow = standings.find(row => row.name === "Widzew Łódź");
    if (!widzewRow) return null;

    return {
        coachId,
        matches: targetMatches,
        targetMatches,
        playedMatches,
        round: triggerRound,
        points,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        position: standings.indexOf(widzewRow) + 1,
        actual: rule.actual,
        periodResults
    };
}
function showCoachMilestone(status) {
    const activeTrainer = window.__widzewSelectedTrainer;
    if (!activeTrainer || !status) return false;

    const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

    const actual = status.actual || {};
    const actualPosition = actual.position ?? "—";
    const actualPoints = actual.points ?? "—";
    const actualWins = actual.wins ?? "—";
    const actualDraws = actual.draws ?? "—";
    const actualLosses = actual.losses ?? "—";
    const actualGoalsFor = actual.goalsFor ?? "—";
    const actualGoalsAgainst = actual.goalsAgainst ?? "—";
    const actualMatches = actual.matches ?? status.targetMatches;

    let milestoneModal = document.getElementById("coachMilestoneModal");
    if (!milestoneModal) {
        milestoneModal = document.createElement("div");
        milestoneModal.id = "coachMilestoneModal";
        milestoneModal.style.cssText =
            "position:fixed;inset:0;z-index:1000000;display:flex;align-items:center;justify-content:center;" +
            "background:rgba(0,0,0,.78);padding:20px;box-sizing:border-box;";
        milestoneModal.innerHTML =
            '<div style="position:relative;max-width:680px;width:100%;max-height:90vh;overflow:auto;background:#191919;color:#fff;border:2px solid #e30613;border-radius:14px;padding:28px;box-sizing:border-box;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.7);">' +
            '<button id="coachMilestoneClose" type="button" style="position:absolute;right:12px;top:10px;background:#333;color:#fff;border:0;border-radius:7px;font-size:26px;line-height:1;padding:4px 10px;cursor:pointer;">×</button>' +
            '<div id="coachMilestoneContent"></div>' +
            '</div>';
        document.body.appendChild(milestoneModal);
        milestoneModal.querySelector("#coachMilestoneClose").addEventListener("click", () => {
            milestoneModal.remove();
            showCoachDecision(status);
        });
    }

    const milestoneContent = milestoneModal.querySelector("#coachMilestoneContent");
    if (!milestoneContent) return false;

    milestoneContent.innerHTML =
        "<h2>📊 PODSUMOWANIE KADENCJI</h2>" +
        "<p><strong>" + safe(activeTrainer.first) + " " + safe(activeTrainer.last) +
        "</strong> – osiągnięto okres <strong>" + status.matches +
        " meczów</strong>, odpowiadający rzeczywistej liczbie spotkań tego trenera.</p>" +

        '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:20px 0;text-align:left;">' +
            '<div style="background:#242424;border-radius:10px;padding:16px;">' +
                '<h3 style="margin:0 0 12px;color:#e30613;">TY</h3>' +
                "<p style=\"margin:6px 0;\"><strong>Mecze:</strong> " + status.playedMatches + "</p>" +
                "<p style=\"margin:6px 0;\"><strong>Miejsce:</strong> " + status.position + ".</p>" +
                "<p style=\"margin:6px 0;\"><strong>Punkty:</strong> " + status.points + "</p>" +
                "<p style=\"margin:6px 0;\"><strong>W-Z-P:</strong> " + status.wins + "-" + status.draws + "-" + status.losses + "</p>" +
                "<p style=\"margin:6px 0;\"><strong>Bilans:</strong> " + status.goalsFor + ":" + status.goalsAgainst + "</p>" +
            "</div>" +
            '<div style="background:#242424;border-radius:10px;padding:16px;">' +
                '<h3 style="margin:0 0 12px;color:#fff;">RZECZYWISTOŚĆ</h3>' +
                "<p style=\"margin:6px 0;\"><strong>Mecze:</strong> " + actualMatches + "</p>" +
                "<p style=\"margin:6px 0;\"><strong>Miejsce:</strong> " + actualPosition + ".</p>" +
                "<p style=\"margin:6px 0;\"><strong>Punkty:</strong> " + actualPoints + "</p>" +
                "<p style=\"margin:6px 0;\"><strong>W-Z-P:</strong> " + actualWins + "-" + actualDraws + "-" + actualLosses + "</p>" +
                "<p style=\"margin:6px 0;\"><strong>Bilans:</strong> " + actualGoalsFor + ":" + actualGoalsAgainst + "</p>" +
            "</div>" +
        "</div>" +
        "<p>Twoje wyniki są porównane z rzeczywistymi osiągnięciami Widzewa <strong>w dokładnie tym samym okresie</strong>.</p>" +
        "<p style=\"color:#aaa;margin-top:10px;\">Podsumowanie po " + status.round + ". kolejce.</p>";

    milestoneModal.style.display = "flex";
    window.__coachMilestoneShown = true;
    return true;
}
function checkCoachMilestone() {
    const status = getCoachMilestoneStatus();
    if (!status) return false;
    return showCoachMilestone(status);
}
window.checkCoachMilestone = checkCoachMilestone;

function getCoachDecisionStatus(status) {
    if (!status) return null;

    const rules = COACH_DECISION_RULES[Number(status.coachId)];
    if (!rules) return null;

    const periodResults = status.periodResults || [];
    const derby = periodResults.find(match => {
        const opponent = String(match.opponent || "").toLowerCase().trim();
        return opponent === "łks łódź" || opponent === "lks łódź";
    });
    const derbyLost = Boolean(derby && Number(derby.gf) < Number(derby.ga));
    const decisionStatus = { ...status, derbyLost };
    const decision = rules.find(rule => rule.when(decisionStatus));
    return decision ? { ...decisionStatus, decision } : null;
}

function showCoachFarewell() {
    const activeTrainer = window.__widzewSelectedTrainer;
    if (!activeTrainer) return false;

    const coachId = Number(activeTrainer.faceId);
    const imagePath = COACH_FAREWELL_IMAGES[coachId];
    let overlay = document.getElementById("coachFarewellOverlay");

    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "coachFarewellOverlay";
    overlay.style.cssText =
        "position:fixed;inset:0;z-index:1000005;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;";

    if (imagePath) {
        const image = document.createElement("img");
        image.src = imagePath;
        image.alt = "Podziękowanie dla trenera";
        image.style.cssText =
            "width:100%;height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none;";
        overlay.appendChild(image);
    } else {
        const fallback = document.createElement("div");
        fallback.style.cssText =
            "width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:clamp(42px,8vw,110px);font-weight:900;background:#a90000;";
        fallback.textContent = "DZIĘKUJEMY!";
        overlay.appendChild(fallback);
    }

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.id = "coachFarewellClose";
    closeButton.setAttribute("aria-label", "Powrót do menu głównego");
    closeButton.title = "Powrót do menu głównego";
    closeButton.textContent = "×";
    closeButton.style.cssText =
        "position:absolute;top:18px;right:22px;width:48px;height:48px;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font-size:42px;line-height:42px;font-weight:300;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s ease,background .2s ease;z-index:2;";
    closeButton.addEventListener("mouseenter", () => {
        closeButton.style.background = "rgba(0,0,0,.8)";
    });
    closeButton.addEventListener("mouseleave", () => {
        closeButton.style.background = "rgba(0,0,0,.55)";
    });

    const returnToMainMenu = () => {
        clearTimeout(showCloseTimer);
        overlay.remove();

        // Pełny reset gry: zachowujemy ustawienia zapisane w localStorage,
        // ale cała sesja gry i wszystkie zmienne JS zostają wyzerowane.
        window.location.reload();
    };

    closeButton.addEventListener("click", returnToMainMenu);
    overlay.appendChild(closeButton);
    document.body.appendChild(overlay);

    const showCloseTimer = setTimeout(() => {
        closeButton.style.opacity = "1";
        closeButton.style.pointerEvents = "auto";
    }, 5000);

    window.__coachDismissed = true;
    return true;
}

function showCoachDecision(status) {
    const activeTrainer = window.__widzewSelectedTrainer;
    if (!activeTrainer || !status || window.__coachDecisionShown) return false;

    const decisionStatus = getCoachDecisionStatus(status);
    if (!decisionStatus) return false;

    const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

    const canContinue = Boolean(decisionStatus.decision.canContinue);
    let modal = document.getElementById("coachDecisionModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "coachDecisionModal";
        modal.style.cssText =
            "position:fixed;inset:0;z-index:1000001;display:flex;align-items:center;justify-content:center;" +
            "background:rgba(0,0,0,.82);padding:20px;box-sizing:border-box;";
        document.body.appendChild(modal);
    }

    modal.innerHTML =
        '<div style="position:relative;max-width:680px;width:100%;max-height:90vh;overflow:auto;background:#191919;color:#fff;border:2px solid #e30613;border-radius:14px;padding:30px;box-sizing:border-box;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.7);">' +
        (canContinue ? '<h2 style="margin:0 0 20px;">DECYZJA ZARZĄDU</h2>' : '<h2 style="margin:0 0 20px;color:#e30613;">ZWOLNIENIE</h2>') +
        '<p style="font-size:18px;line-height:1.55;margin:0 0 24px;">' + safe(decisionStatus.decision.message) + '</p>' +
        (canContinue
            ? '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">' +
              '<button id="coachDecisionContinue" class="season-main-button" type="button">KONTYNUUJ GRĘ</button>' +
              '<button id="coachDecisionEnd" class="season-main-button" type="button">ZAKOŃCZ GRĘ</button>' +
              '</div>'
            : '<button id="coachDecisionEnd" class="season-main-button" type="button">ZAKOŃCZ GRĘ</button>') +
        '</div>';

    if (canContinue) {
        modal.querySelector("#coachDecisionContinue")?.addEventListener("click", () => modal.remove());
        modal.querySelector("#coachDecisionEnd")?.addEventListener("click", () => {
            modal.remove();
            showCoachFarewell();
        });
    } else {
        window.__coachDismissed = true;
        modal.querySelector("#coachDecisionEnd")?.addEventListener("click", () => {
            modal.remove();
            showCoachFarewell();
        });
    }

    window.__coachDecisionShown = true;
    return true;
}

function getCoachDismissalStatus() {
    const activeTrainer = window.__widzewSelectedTrainer;
    if (window.__widzewGameMode !== "coach" || !activeTrainer || window.__coachDismissed) return null;

    const coachId = Number(activeTrainer.faceId);
    const rule = COACH_DISMISSAL_RULES[coachId];
    if (!rule) return null;

    if (rule.type === "finalTable") {
        const finalRound = seasonGameState.widzewFixtures.length
            ? Math.max(...seasonGameState.widzewFixtures.map(f => Number(f.kolejka) || 0))
            : 34;
        const standings = buildStandings(finalRound);
        const widzewRow = standings.find(row => row.name === "Widzew Łódź");
        if (!widzewRow) return null;

        const position = standings.indexOf(widzewRow) + 1;
        return position >= rule.minPosition && position <= rule.maxPosition
            ? { rule, coachId, position, points: widzewRow.pts }
            : null;
    }

    if (rule.type === "seasonPoints") {
        const results = seasonGameState.widzewResults.filter(
            match => Number(match.round) <= rule.round
        );
        if (results.length < rule.round) return null;

        const points = coachResultsPoints(results);
        return points <= rule.maxPoints
            ? { rule, coachId, points, round: rule.round }
            : null;
    }

    if (rule.type === "coachPoints") {
        const startRound = Math.max(1, Number(activeTrainer.startRound) || 1);
        const results = seasonGameState.widzewResults
            .filter(match => Number(match.round) >= startRound)
            .sort((a, b) => Number(a.round) - Number(b.round));

        if (results.length < rule.matches) return null;

        const firstMatches = results.slice(0, rule.matches);
        const points = coachResultsPoints(firstMatches);

        return points <= rule.maxPoints
            ? { rule, coachId, points, matches: rule.matches }
            : null;
    }

    return null;
}

function showCoachDismissal(status) {
    const activeTrainer = window.__widzewSelectedTrainer;
    const modal = document.getElementById("coachDismissalModal");
    const content = document.getElementById("coachDismissalContent");
    if (!modal || !content || !status) return;

    const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

    let reason = "";
    if (status.rule.type === "finalTable") {
        reason = "Widzew zakończył sezon na <strong>" + status.position + ". miejscu</strong>.";
    } else if (status.rule.type === "seasonPoints") {
        reason = "Po " + status.round + ". kolejce Widzew miał zaledwie <strong>" + status.points + " pkt</strong>.";
    } else {
        reason = "W pierwszych " + status.matches + " meczach swojej kadencji Widzew zdobył <strong>" + status.points + " pkt</strong>.";
    }

    content.innerHTML =
        (status.rule.image
            ? '<img class="coach-dismissal-image" src="' + status.rule.image + '" alt="">'
            : "") +
        "<h2>ZWOLNIENIE!</h2>" +
        "<p><strong>" + safe(activeTrainer.first) + " " + safe(activeTrainer.last) +
        "</strong> został zwolniony z funkcji pierwszego trenera Widzewa Łódź.</p>" +
        "<p>" + reason + "</p>" +
        "<p class=\"coach-dismissal-end\">KARIERA TRENERA ZAKOŃCZONA</p>";

    modal.classList.remove("hidden");
    window.__coachDismissed = true;
}

function checkCoachDismissal() {
    const status = getCoachDismissalStatus();
    if (!status) return false;

    showCoachDismissal(status);
    return true;
}

document.getElementById("closeCoachDismissalModal")?.addEventListener("click", () => {
    document.getElementById("coachDismissalModal")?.classList.add("hidden");
});

function renderRound(round) {
    const f=getWidzewFixture(round);
    const others=seasonGameState.fixtures.filter(x=>Number(x.kolejka)===Number(round) &&
        seasonTeamName(x.gospodarz)!=="Widzew Łódź" && seasonTeamName(x.gosc)!=="Widzew Łódź");
    document.getElementById("roundLabel").textContent=`KOLEJKA ${round}`;
    document.getElementById("roundTitle").textContent=`Sezon ${seasonGameState.season}`;
    const widzewPlayed=seasonGameState.widzewResults.find(x=>Number(x.round)===Number(round));
    const rows=[...others];
    if(f) rows.push(f);
    rows.sort((a,b)=>{
        const aw=seasonTeamName(a.gospodarz)==="Widzew Łódź" ? 1:0;
        const bw=seasonTeamName(b.gospodarz)==="Widzew Łódź" ? 1:0;
        return aw-bw;
    });
    const html=rows.map(x=>{
        const isW=seasonTeamName(x.gospodarz)==="Widzew Łódź" || seasonTeamName(x.gosc)==="Widzew Łódź";
        const result=isW ? (widzewPlayed ? (widzewPlayed.home ? `${widzewPlayed.gf}:${widzewPlayed.ga}` : `${widzewPlayed.ga}:${widzewPlayed.gf}`) : "—") : seasonOtherResult(x);
        const widzewResultClass = isW && widzewPlayed
            ? (Number(widzewPlayed.gf) > Number(widzewPlayed.ga)
                ? " widzew-win"
                : Number(widzewPlayed.gf) < Number(widzewPlayed.ga)
                    ? " widzew-loss"
                    : " widzew-draw")
            : "";
        return `<div class="round-match ${isW?"widzew-match":""}${widzewResultClass}">
            <div class="round-team home">${seasonLogo(seasonTeamName(x.gospodarz))}<span>${seasonSafe(seasonTeamName(x.gospodarz))}</span></div>
            <div class="round-score-wrap"><strong class="round-score">${result}</strong>${isW && widzewPlayed ? `<div class="match-scorers">${renderMatchScorers(widzewPlayed.scorers)}</div>` : ""}</div>
            <div class="round-team away"><span>${seasonSafe(seasonTeamName(x.gosc))}</span>${seasonLogo(seasonTeamName(x.gosc))}</div>
        </div>`;
    }).join("");
    document.getElementById("roundMatches").innerHTML=html;
    const actions=document.getElementById("roundActions");
    const lastRound = seasonGameState.widzewFixtures.length ? Number(seasonGameState.widzewFixtures[seasonGameState.widzewFixtures.length-1].kolejka) : 34;
    const squadButton = `<button id="seasonSquadButton" class="season-secondary-button">👥 SKŁAD</button>`;
    if(widzewPlayed) {
        if(round < lastRound) {
            actions.innerHTML = `<button id="nextRoundButton" class="season-main-button">NASTĘPNA KOLEJKA →</button>`;
        } else {
            actions.innerHTML = `<button id="seasonFinishButton" class="season-main-button">ZAKOŃCZ SEZON</button>`;
        }
    } else {
        actions.innerHTML = squadButton + `<button id="playMatchButton" class="season-main-button">ZAGRAJ MECZ</button>
                           <button id="simulateMatchButton" class="season-secondary-button">SYMULUJ MECZ</button>`;
        document.getElementById("seasonSquadButton")?.addEventListener("click", () => {
            openSeasonSquadEditor();
        });
    }
    document.getElementById("playMatchButton")?.addEventListener("click",()=>{
        // Do czasu wdrożenia właściwego ekranu meczu przycisk nie może pozostawiać
        // kolejki bez wyniku — wykonujemy tę samą symulację meczu.
        window.simulateCurrentWidzewMatch?.();
    });
    document.getElementById("simulateMatchButton")?.addEventListener("click",()=>{
        window.simulateCurrentWidzewMatch?.();
    });
    document.getElementById("nextRoundButton")?.addEventListener("click",()=>{
        seasonGameState.currentRound++;
        renderPlayableSeason();

        // Awaryjnie sprawdź komunikat także po przejściu do następnej kolejki.
        // Dzięki temu jego pojawienie się nie zależy od tego, która ścieżka
        // zapisała wynik poprzedniego meczu.
        if (window.__widzewGameMode === "coach") {
            checkCoachMilestone();
        }
    });
    document.getElementById("seasonFinishButton")?.addEventListener("click",()=>{
        renderFinalSeason();
    });
}
function renderPlayableSeason() {
    // W trybie „Rozegraj sezon” UI pokazuje wyłącznie mecze już ujawnione
    // (rozegrane ręcznie albo jawnie zasymulowane). Ukryty wynik bazowy
    // pozostaje w seasonMatchDB i nie może sam pojawić się na ekranie.
    const round = Number(seasonGameState.currentRound);
    renderLeagueTable(round,false);
    renderRound(round);
}
function simulateCurrentWidzewMatch() {
    const f=getWidzewFixture(seasonGameState.currentRound);
    if(!f || seasonGameState.widzewResults.some(x=>x.round===seasonGameState.currentRound)) return;
    const home=seasonTeamName(f.gospodarz)==="Widzew Łódź";
    const opponent=home ? seasonTeamName(f.gosc) : seasonTeamName(f.gospodarz);
    const score=generateProvisionalWidzewResult(opponent,home);
    const gf=home?score[0]:score[1], ga=home?score[1]:score[0];
    const match={round:seasonGameState.currentRound, opponent, home, gf, ga, scorers:makeMatchScorers(gf,ga)};
    seasonGameState.widzewResults.push(match);
    consumeSopicBonusMatch();
    seasonGameState.simulatedMatchCount = Number(seasonGameState.simulatedMatchCount || 0) + 1;
    updateTopScorersFromMatch(match);

    if (window.__widzewGameMode === "coach" && checkCoachMilestone()) {
        renderPlayableSeason();
        return;
    }

    renderPlayableSeason();
}
function simulateWholeSeason() {
    // Tryb "symuluj cały sezon" pokazuje WYŁĄCZNIE 34 mecze Widzewa.
    // Pozostałe mecze służą tylko do wyliczenia tabeli.
    seasonGameState.widzewResults = [];
    seasonGameState.scorers = {};

    const fixtures = [...seasonGameState.widzewFixtures]
        .sort((a,b) => Number(a.kolejka) - Number(b.kolejka));

    fixtures.forEach(f => {
        const round = Number(f.kolejka);
        const home = seasonTeamName(f.gospodarz) === "Widzew Łódź";
        const opponent = home ? seasonTeamName(f.gosc) : seasonTeamName(f.gospodarz);
        const score = generateProvisionalWidzewResult(opponent, home);
        const gf = Number(home ? score[0] : score[1]);
        const ga = Number(home ? score[1] : score[0]);
        const match = { round, opponent, home, gf, ga, scorers: [], sopicBonus: getSopicBonusOverall() };

        // Losowanie strzelców nie może zatrzymać całej symulacji.
        try {
            // Symulacja sezonu korzysta z lokalnego, sprawdzonego losowania
            // zawodników z aktualnego draftu. Globalne generatory innych warstw
            // nie mogą zmienić źródła danych dla tej ścieżki.
            match.scorers = makeMatchScorers(gf, ga);
            // Generowanie strzelców jest niezależne od klasyfikacji.
            // Awaria TOP STRZELCÓW nie może skasować gotowego meczu.
            const widzewScorers = match.scorers.filter(s =>
                String(s?.type || "").toLowerCase() === "widzew" ||
                String(s?.type || "").toLowerCase() === "own" ||
                String(s?.type || "").toLowerCase() === "own-goal"
            ).length;
            for(let missing = widzewScorers; missing < gf; missing++){
                const s = chooseWeightedScorer();
                match.scorers.push({
                    minute: 1 + Math.floor(Math.random() * 90),
                    type: s.type,
                    name: s.name,
                    player: s.player || null
                });
            }
            match.scorers.sort((a,b)=>Number(a.minute||0)-Number(b.minute||0));

            // Klasyfikację aktualizujemy dopiero po zapisaniu strzelców.
            // Jej błąd nie może wpłynąć na match.scorers.
            try {
                updateTopScorersFromMatch(match);
            } catch (e) {
                console.warn("Nie udało się zaktualizować klasyfikacji strzelców:", e);
            }
        } catch (e) {
            console.warn("Nie udało się wylosować strzelców meczu:", e);
            // Zachowaj przynajmniej strzelców przeciwnika, jeśli ich wygenerowanie
            // się udało. Nigdy nie kasuj całego meczu przez błąd klasyfikacji.
        }
        seasonGameState.widzewResults.push(match);
        consumeSopicBonusMatch();
    });

    // 34 losowania z bardzo małym prawdopodobieństwem dają 0 goli Widzewa.
    // Nie pozwalamy więc, aby błąd/pech generatora tworzył absurdalny sezon 0:0/0:1.
    if (seasonGameState.widzewResults.length &&
        seasonGameState.widzewResults.every(m => m.gf === 0)) {
        const m = seasonGameState.widzewResults[Math.floor(Math.random() * seasonGameState.widzewResults.length)];
        m.gf = 1;
        try {
            m.scorers = makeMatchScorers(m.gf, m.ga);
            updateTopScorersFromMatch(m);
        } catch (e) {
            console.warn("Nie udało się dodać wymuszonego strzelca:", e);
        }
    }

    renderFinalSeason();
}

function renderFinalSeason() {
    const finalRound = seasonGameState.widzewFixtures.length
        ? Math.max(...seasonGameState.widzewFixtures.map(f => Number(f.kolejka) || 0))
        : 34;

    try {
        renderLeagueTable(finalRound, true);
    } catch (e) {
        console.error("Błąd renderowania tabeli końcowej:", e);
        // Awaryjnie spróbuj ponownie po wyzerowaniu tylko warstwy HTML.
        const table = document.getElementById("leagueTable");
        if (table) table.innerHTML = "";
        try { renderLeagueTable(finalRound, true); } catch (e2) { console.error(e2); }
    }

    const label = document.getElementById("roundLabel");
    const title = document.getElementById("roundTitle");
    const matches = document.getElementById("roundMatches");
    const actions = document.getElementById("roundActions");
    if (label) label.textContent = "PODSUMOWANIE";
    if (title) title.textContent = `Wyniki Widzewa · ${seasonGameState.season}`;

    const rows = [...seasonGameState.widzewResults].sort((a,b) => a.round - b.round);
    if (matches) {
        matches.innerHTML = rows.map(r => {
            const homeTeam = r.home ? "Widzew Łódź" : r.opponent;
            const awayTeam = r.home ? r.opponent : "Widzew Łódź";
            const score = r.home ? `${r.gf}:${r.ga}` : `${r.ga}:${r.gf}`;
            const resultClass = Number(r.gf) > Number(r.ga) ? " result-win" : Number(r.gf) < Number(r.ga) ? " result-loss" : " result-draw";
            const scorerHtml = renderMatchScorers(r.scorers);
            return `<div class="round-match widzew-match${resultClass}">
                <div class="round-team home">${seasonLogo(homeTeam)}<span>${seasonSafe(homeTeam)}</span></div>
                <div class="round-score-wrap"><strong class="round-score">${score}</strong>${scorerHtml ? `<div class="match-scorers">${scorerHtml}</div>` : ""}</div>
                <div class="round-team away"><span>${seasonSafe(awayTeam)}</span>${seasonLogo(awayTeam)}</div>
            </div>`;
        }).join("");
    }
    if (actions) actions.innerHTML = `<div class="season-finished-note">SEZON ZAKOŃCZONY</div>`;

    // W trybie GRACZ wynik punktowy pojawia się po zamknięciu
    // okna "Wesprzyj twórcę". Tryb TRENER pozostaje bez punktacji.
    window.__playerScorePending = window.__widzewGameMode === "player";
    setTimeout(() => {
        window.showSupportCreatorModal?.();
    }, 300);
}
window.renderPlayableSeason = renderPlayableSeason;

async function initSeasonMode(mode) {
    const season=window.__seasonValue || "22/23";
    seasonGameState.season=season;
    seasonGameState.mode=mode;
    seasonGameState.currentRound=1;
    seasonGameState.widzewResults=[];
    seasonGameState.playedMatchCount=0;
    seasonGameState.simulatedMatchCount=0;
    seasonGameState.scorers={};
    seasonGameState.generatedResults={};
    window.__playerScorePending = false;
    window.__coachDismissed = false;
    window.__coachMilestoneShown = false;
    window.__coachDecisionShown = false;
    seasonGameState.widzewFixtures=[];
    const loading=document.getElementById("seasonLoading");
    const content=document.getElementById("seasonBoardContent");
    if(loading) {loading.classList.remove("hidden"); loading.textContent="Wczytywanie baz sezonu...";}
    if(content) content.classList.add("hidden");
    try {
        const fixtureFiles = {'25/26': 'fixtures_25-26.csv', '22/23': 'fixtures_22-23.csv', '26/27': 'fixtures_26-27.csv', '23/24': 'fixtures_23-24.csv', '24/25': 'fixtures_24-25.csv'};
        const teamFiles = {'26/27': 'Book 1(teams(26-27)).csv', '22/23': 'Book 1(teams(22-23)).csv', '24/25': 'Book 1(teams(24-25)).csv', '25/26': 'Book 1(teams(25-26)).csv', '23/24': 'Book 1(teams(23-24)).csv'};
        const fixtureFile = fixtureFiles[season];
        const teamFile = teamFiles[season];
        if (!fixtureFile || !teamFile) {
            throw new Error(`Brak pliku sezonu ${season}: fixtures=${fixtureFile || "BRAK"}, teams=${teamFile || "BRAK"}`);
        }
        const [fixtures,teams]=await Promise.all([
            loadSeasonCSV(`data/fixtures/${fixtureFile}`),
            loadSeasonCSV(`data/teams/${teamFile}`)
        ]);
        seasonGameState.fixtures=fixtures;
        seasonGameState.widzewFixtures=getWidzewFixtures();
        seasonGameState.teams=teams;

        // W trybie TRENER zaczynamy dokładnie od kolejki, w której dany trener
        // objął Widzew. Mecze wcześniejsze są już rozegrane na podstawie wyników z CSV.
        const trainerStartRound = (window.__widzewGameMode === "coach")
            ? Math.max(1, Number(window.__widzewTrainerStartRound) || 1)
            : 1;
        seasonGameState.currentRound = trainerStartRound;

        if (trainerStartRound > 1) {
            seasonGameState.widzewFixtures
                .filter(f => Number(f.kolejka) < trainerStartRound)
                .forEach(f => {
                    const score = seasonResultParts(f.wynik);
                    if (!score) return;
                    const home = seasonTeamName(f.gospodarz) === "Widzew Łódź";
                    seasonGameState.widzewResults.push({
                        round: Number(f.kolejka),
                        opponent: home ? seasonTeamName(f.gosc) : seasonTeamName(f.gospodarz),
                        home,
                        gf: home ? score[0] : score[1],
                        ga: home ? score[1] : score[0],
                        scorers: []
                    });
                });
        }
        if (seasonGameState.widzewFixtures.length === 0) {
            throw new Error(`Nie znaleziono meczów Widzewa w terminarzu ${season}.`);
        }
        if (seasonGameState.widzewFixtures.length !== 34) {
            console.warn(`Terminarz ${season}: znaleziono ${seasonGameState.widzewFixtures.length} meczów Widzewa zamiast 34.`);
        }
        // Widzew is intentionally rated from the drafted XI, while other clubs use the season database.
        try { window.__widzewSeasonOverall = getTeamScores().overall; } catch(e) { window.__widzewSeasonOverall=70; }
        if(loading) loading.classList.add("hidden");
        if(content) content.classList.remove("hidden");
        if(mode==="simulate") simulateWholeSeason();
        else renderPlayableSeason();
    } catch(err) {
        console.error("Błąd ładowania sezonu:",err);
        if(loading) loading.textContent=`Nie udało się wczytać baz sezonu: ${err.message || err}.`;
    }
}
function openSeasonMode(mode) {
    const season = window.__seasonValue || "22/23";
    const title = document.getElementById("seasonTitle");
    const intro = document.getElementById("seasonIntro");
    if(title) title.textContent=`SEZON ${season}`;
    if(intro) intro.textContent=`Widzew Łódź · ${mode==="play"?"Rozegraj cały sezon":"Symuluj cały sezon"}`;
    if(window.__showScreen) window.__showScreen(document.getElementById("seasonScreen"));
    (window.initSeasonMode || initSeasonMode)(mode);
}
// Udostępniamy funkcje sezonu po ich zdefiniowaniu, aby warstwy integracyjne mogły się podpiąć.
window.initSeasonMode = initSeasonMode;
window.simulateCurrentWidzewMatch = simulateCurrentWidzewMatch;
window.simulateWholeSeason = simulateWholeSeason;

document.getElementById("playWholeSeason")?.addEventListener("click",()=>openSeasonMode("play"));
document.getElementById("simulateWholeSeason")?.addEventListener("click",()=>openSeasonMode("simulate"));

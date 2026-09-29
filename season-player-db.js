/* Temporary season player database.
   Captures the exact 20-player squad when the user clicks ROZEGRAJ SEZON.
   The database is kept only in memory and is not written to any CSV/file. */
(function () {
    const files = {
        br: "data/br.csv",
        loPo: "data/lo-po.csv",
        so: "data/so.csv",
        pomoc: "data/pomoc.csv",
        skrzydlowi: "data/skrzydlowi.csv",
        napastnicy: "data/napastnicy.csv"
    };

    let databasePromise = null;

    function parseCSV(text) {
        const clean = String(text ?? "").replace(/^\uFEFF/, "").trim();
        if (!clean) return [];
        const firstLine = clean.split(/\r?\n/, 1)[0] || "";
        const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
        const rows = [];
        let row = [], field = "", quoted = false;

        for (let i = 0; i < clean.length; i++) {
            const ch = clean[i], next = clean[i + 1];
            if (ch === '"' && quoted && next === '"') { field += '"'; i++; continue; }
            if (ch === '"') { quoted = !quoted; continue; }
            if (ch === delimiter && !quoted) { row.push(field.trim()); field = ""; continue; }
            if ((ch === "\n" || ch === "\r") && !quoted) {
                if (ch === "\r" && next === "\n") i++;
                row.push(field.trim());
                if (row.some(v => v !== "")) rows.push(row);
                row = []; continue;
            }
            field += ch;
        }
        row.push(field.trim());
        if (row.some(v => v !== "")) rows.push(row);
        const headers = rows.shift() || [];
        return rows.map(values => Object.fromEntries(headers.map((header, i) => [
            header.replace(/^\uFEFF/, "").trim(),
            (values[i] || "").trim()
        ])));
    }

    async function loadCSV(path) {
        const response = await fetch(`${path}?seasonDb=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
        return parseCSV(await response.text());
    }

    function normalize(value) {
        return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    }

    function positionFromRole(role, originalPosition) {
        const r = String(role || "");
        if (r === "br" || r === "bench-br") return "BR";
        if (r === "loPo") return "LO/PO";
        if (r === "so") return "ŚO";
        if (r === "pomoc") return "ŚPD/ŚP/OP";
        if (r === "skrzydlowi") return "LS/LP/PS/PP";
        if (r === "napastnicy" || r === "bench-n") return "N";
        return String(originalPosition || "").trim();
    }

    function readSeasonFromButton(button) {
        const text = String(button?.textContent || "");
        const match = text.match(/ROZEGRAJ\s+SEZON\s+(.+)/i);
        return match ? match[1].trim() : "";
    }

    function readVisibleSquad() {
        const players = [];
        const starters = Array.from(document.querySelectorAll(".squad-list-player"));
        const bench = Array.from(document.querySelectorAll(".bench-player"));

        starters.forEach((el, index) => {
            const info = el.querySelector(".squad-player-info");
            const name = String(info?.querySelector("strong")?.textContent || "").trim();
            const roleLabel = String(info?.querySelector("small")?.textContent || "").trim();
            const parts = name.split(/\s+/);
            if (parts.length < 2) return;
            players.push({
                first: parts.shift(),
                last: parts.join(" "),
                slot: "starter",
                roleLabel,
                index
            });
        });

        bench.forEach((el, index) => {
            const info = el.querySelector(".bench-info");
            const name = String(info?.querySelector("strong")?.textContent || "").trim();
            const roleLabel = String(info?.querySelector("small")?.textContent || "").trim();
            const parts = name.split(/\s+/);
            if (parts.length < 2) return;
            players.push({
                first: parts.shift(),
                last: parts.join(" "),
                slot: "bench",
                roleLabel,
                index
            });
        });

        return players;
    }

    async function buildTemporaryDatabase(button) {
        if (databasePromise) return databasePromise;

        databasePromise = (async () => {
            const season = readSeasonFromButton(button);
            const loaded = await Promise.all(Object.entries(files).map(async ([category, path]) => {
                const rows = await loadCSV(path);
                return [category, rows];
            }));
            const allRows = loaded.flatMap(([category, rows]) => rows.map(row => ({ category, row })));
            const visibleSquad = readVisibleSquad();

            const selected = visibleSquad.map((picked, order) => {
                const first = normalize(picked.first);
                const last = normalize(picked.last);
                const nameMatches = allRows.filter(({ row }) =>
                    normalize(row["Imię"]) === first &&
                    normalize(row["Nazwisko"]) === last
                );
                const seasonMatches = season
                    ? nameMatches.filter(({ row }) => normalize(row["Sezon"]) === normalize(season))
                    : nameMatches;
                const exact = seasonMatches[0] || nameMatches[0];

                if (!exact) {
                    return {
                        order,
                        first: picked.first,
                        last: picked.last,
                        slot: picked.slot,
                        role: picked.roleLabel,
                        position: picked.roleLabel,
                        season,
                        stats: null,
                        found: false
                    };
                }

                const row = { ...exact.row };
                const originalPosition = String(row["Pozycja"] || "").trim();
                const role = picked.slot === "starter"
                    ? ({
                        "BR":"br",
                        "LO/PO":"loPo",
                        "ŚO":"so",
                        "ŚPD/ŚP/OP":"pomoc",
                        "LS/LP/PS/PP":"skrzydlowi",
                        "N":"napastnicy"
                    }[picked.roleLabel] || "")
                    : "";

                return {
                    order,
                    first: picked.first,
                    last: picked.last,
                    slot: picked.slot,
                    role: picked.roleLabel,
                    position: originalPosition || positionFromRole(role, originalPosition),
                    season: row["Sezon"] || season,
                    category: exact.category,
                    stats: row,
                    found: true
                };
            });

            return {
                createdAt: new Date().toISOString(),
                season,
                count: selected.length,
                players: selected
            };
        })().catch(error => {
            databasePromise = null;
            throw error;
        });

        return databasePromise;
    }

    document.addEventListener("click", event => {
        const button = event.target?.closest?.("#playSeasonButton");
        if (!button) return;
        buildTemporaryDatabase(button)
            .then(db => {
                window.widzewSeasonPlayerDB = db;
                console.info("[Widzew Draft] Tymczasowa baza sezonowa utworzona:", db);

                // TOP STRZELCÓW może zostać wyrenderowane zanim baza sezonowa
                // zakończy ładowanie. Po jej utworzeniu odświeżamy same twarze.
                if (typeof window.renderTopScorers === "function") {
                    window.renderTopScorers();
                }
            })
            .catch(error => console.error("[Widzew Draft] Nie udało się utworzyć tymczasowej bazy zawodników:", error));
    }, true);

    window.getWidzewSeasonPlayerDB = function () {
        return window.widzewSeasonPlayerDB || null;
    };
})();

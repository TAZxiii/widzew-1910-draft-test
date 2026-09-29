/* Season table cosmetics: competition logo, headers and season-specific position markers. */
(function () {
    const RULES = {
        "22/23": { green:[1], blue:[2,3,4], red:[16,17,18] },
        "23/24": { green:[1], blue:[2,3], red:[16,17,18] },
        "24/25": { green:[1], blue:[2,3], red:[16,17,18], legiaYellow:true },
        "25/26": { green:[1,2], yellow:[3], blue:[4,5], red:[16,17,18], lechiaPenalty:true },
        "26/27": { green:[1,2], yellow:[3], blue:[4,5], red:[16,17,18] }
    };

    function getSeason() {
        const text = document.getElementById("seasonTitle")?.textContent || "";
        const m = text.match(/(22\/23|23\/24|24\/25|25\/26|26\/27)/);
        if (m) return m[1];
        const intro = document.getElementById("seasonIntro")?.textContent || "";
        const i = intro.match(/(22\/23|23\/24|24\/25|25\/26|26\/27)/);
        return i ? i[1] : "";
    }

    function markerType(position, teamName, rules) {
        if (!rules) return null;
        if (rules.legiaYellow && /legia warszawa/i.test(teamName)) return "yellow";
        if (rules.green?.includes(position)) return "green";
        if (rules.yellow?.includes(position)) return "yellow";
        if (rules.blue?.includes(position)) return "blue";
        if (rules.red?.includes(position)) return "red";
        return null;
    }

    function numberFromCell(cell) {
        return Number.parseInt(String(cell?.textContent || "").replace(/[^0-9-]/g, ""), 10) || 0;
    }

    function applyLechiaPenalty(table, season, rules) {
        if (season !== "25/26" || !rules.lechiaPenalty) return;
        const rows = Array.from(table.querySelectorAll(".league-row"));
        rows.forEach(row => {
            const teamCell = row.children[1];
            const pointsCell = row.children[7];
            if (!teamCell || !pointsCell || !/lechia gdańsk/i.test(teamCell.textContent || "")) return;
            if (row.dataset.lechiaOriginalPoints === undefined) {
                row.dataset.lechiaOriginalPoints = String(numberFromCell(pointsCell));
            }
            const original = Number(row.dataset.lechiaOriginalPoints);
            const corrected = String(original - 5);
            if (pointsCell.textContent !== corrected) pointsCell.textContent = corrected;
        });

        const sortedRows = rows.map((row, index) => ({ row, index }))
            .sort((a, b) => {
                const ap = numberFromCell(a.row.children[7]);
                const bp = numberFromCell(b.row.children[7]);
                if (bp !== ap) return bp - ap;
                return a.index - b.index;
            });

        const currentRows = rows.slice();
        const needsReorder = sortedRows.some((item, index) => currentRows[index] !== item.row);
        if (needsReorder) sortedRows.forEach(({ row }) => table.appendChild(row));

        sortedRows.forEach(({ row }, index) => {
            if (row.children[0]) {
                const position = String(index + 1);
                if (row.children[0].textContent !== position) row.children[0].textContent = position;
            }
        });
    }

    function enhanceLeagueTable() {
        const table = document.getElementById("leagueTable");
        if (!table) return;

        const panel = table.closest(".league-table-panel");
        if (panel && !panel.querySelector(".league-competition-logo")) {
            const logo = document.createElement("img");
            logo.className = "league-competition-logo";
            logo.src = "data/logos/ekstraklasa.png";
            logo.alt = "Ekstraklasa";
            panel.appendChild(logo);
        }

        if (!table.querySelector(".league-table-header")) {
            const header = document.createElement("div");
            header.className = "league-table-header";
            ["#", "Drużyna", "M", "Z", "R", "P", "B", "Pkt"].forEach(label => {
                const cell = document.createElement("span");
                cell.textContent = label;
                header.appendChild(cell);
            });
            table.insertBefore(header, table.firstChild);
        }

        const season = getSeason();
        const rules = RULES[season];
        if (!rules) return;

        applyLechiaPenalty(table, season, rules);

        const rows = Array.from(table.querySelectorAll(".league-row"));
        rows.forEach(row => {
            const positionCell = row.children[0];
            if (!positionCell) return;
            const position = Number.parseInt(positionCell.textContent.trim(), 10);
            if (!Number.isFinite(position)) return;
            const teamCell = row.children[1];
            const teamName = teamCell?.textContent?.trim() || "";
            const type = markerType(position, teamName, rules);
            positionCell.classList.remove("table-marker-green","table-marker-yellow","table-marker-blue","table-marker-red");
            if (type) positionCell.classList.add(`table-marker-${type}`);
        });

        renderLegend(table, season, rules);
    }

    function renderLegend(table, season, rules) {
        if (!table.parentElement) return;
        let legend = table.parentElement.querySelector(".league-table-legend");
        if (!season || !rules) {
            if (legend) legend.remove();
            return;
        }
        const signature = JSON.stringify(rules) + "|" + season;
        if (legend?.dataset.signature === signature) return;
        if (!legend) {
            legend = document.createElement("div");
            legend.className = "league-table-legend";
            table.parentElement.appendChild(legend);
        }
        legend.dataset.signature = signature;
        legend.innerHTML = "";
        const items = [];
        if (rules.green?.length) items.push(["green", "Awans - Liga Mistrzów (kwalifikacje)"]);
        if (rules.yellow?.length || rules.legiaYellow) items.push(["yellow", "Awans - Liga Europy (kwalifikacje)"]);
        if (rules.blue?.length) items.push(["blue", "Awans - Liga Konferencji Europy (kwalifikacje)"]);
        if (rules.red?.length) items.push(["red", "Spadek"]);
        items.forEach(([type, text]) => {
            const item = document.createElement("div");
            item.className = "league-legend-item";
            item.innerHTML = `<span class="league-legend-square table-marker-${type}"></span><span>${text}</span>`;
            legend.appendChild(item);
        });
        if (season === "25/26") {
            const note = document.createElement("div");
            note.className = "league-legend-note";
            note.textContent = "Lechia Gdańsk: −5 pkt za zaległości finansowe.";
            legend.appendChild(note);
        }
    }

    function addStyles() {
        if (document.getElementById("seasonTableFixStyles")) return;
        const style = document.createElement("style");
        style.id = "seasonTableFixStyles";
        style.textContent = `
            .league-table-panel { position: relative; }
            .league-competition-logo { position:absolute; top:16px; left:18px; width:72px; height:72px; object-fit:contain; z-index:2; }
            .league-table-panel .season-panel-title { padding-left:88px; }
            .league-table-header,.league-row { display:grid; grid-template-columns:32px minmax(190px,1fr) 28px 28px 28px 28px 58px 38px; gap:5px; align-items:center; }
            .league-table-header { min-height:32px; padding:3px 7px; color:#aaa; font-size:10px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; text-align:center; border-bottom:1px solid rgba(255,255,255,.14); margin-bottom:4px; }
            .league-table-header span:nth-child(2) { text-align:left; }
            .round-match .match-scorers { grid-column:1/-1; width:100%; justify-self:stretch; align-items:center; text-align:center; }
            .league-row > :first-child { display:flex; align-items:center; justify-content:center; }
            .league-row > :first-child.table-marker-green,.league-row > :first-child.table-marker-yellow,.league-row > :first-child.table-marker-blue,.league-row > :first-child.table-marker-red { width:24px; height:24px; border-radius:3px; color:#fff; font-weight:900; justify-self:center; }
            .table-marker-green { background:#20a84b !important; }
            .table-marker-yellow { background:#e0b52b !important; }
            .table-marker-blue { background:#287bd6 !important; }
            .table-marker-red { background:#d63b3b !important; }
            .league-table-legend { display:flex; flex-direction:column; gap:7px; margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,.14); font-size:11px; }
            .league-legend-item { display:flex; align-items:center; gap:8px; }
            .league-legend-square { flex:0 0 18px; width:18px; height:18px; border-radius:3px; }
            .league-legend-note { margin-top:4px; padding-top:7px; border-top:1px solid rgba(255,255,255,.10); font-size:10px; line-height:1.35; opacity:.72; }
            @media (max-width:700px) { .league-competition-logo{width:56px;height:56px;top:12px;left:12px}.league-table-panel .season-panel-title{padding-left:70px}.league-table-header,.league-row{grid-template-columns:25px minmax(120px,1fr) 25px 25px 25px 25px 48px 35px;gap:3px}.league-table-header{font-size:9px}.league-row{font-size:11px}.league-row > :first-child.table-marker-green,.league-row > :first-child.table-marker-yellow,.league-row > :first-child.table-marker-blue,.league-row > :first-child.table-marker-red{width:22px;height:22px}.league-table-legend{font-size:10px}.league-legend-note{font-size:9px} }
        `;
        document.head.appendChild(style);
    }

    function start() {
        addStyles();
        enhanceLeagueTable();
        const board = document.getElementById("seasonBoardContent") || document.body;
        const observer = new MutationObserver((mutations) => {
            const relevant = mutations.some(mutation => mutation.type === "childList" && !mutation.target.closest?.(".league-table-legend"));
            if (relevant) enhanceLeagueTable();
        });
        observer.observe(board, { childList:true, subtree:true });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
    else start();
})();

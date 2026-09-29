/* Final-season scorer display fix.
   This file only replaces the scorer presentation in the final simulated-season
   view. It does not change any match result generation. */
(function () {
    function isWidzewName(value) {
        return String(value || "").trim().toLowerCase() === "widzew łódź";
    }

    function readMatchScore(matchElement) {
        const scoreElement = matchElement?.querySelector(".round-score");
        const text = String(scoreElement?.textContent || "").trim();
        const match = text.match(/(\d+)\s*:\s*(\d+)/);
        if (!match) return null;

        const homeText = matchElement.querySelector(".round-team.home")?.textContent || "";
        const awayText = matchElement.querySelector(".round-team.away")?.textContent || "";
        const homeGoals = Number(match[1]);
        const awayGoals = Number(match[2]);

        if (isWidzewName(homeText)) {
            return { widzewGoals: homeGoals, opponentGoals: awayGoals };
        }
        if (isWidzewName(awayText)) {
            return { widzewGoals: awayGoals, opponentGoals: homeGoals };
        }
        return null;
    }

    function renderFinalScorers(matchElement) {
        if (!matchElement || !matchElement.classList.contains("widzew-match")) return false;
        if (matchElement.dataset.finalScorersReady === "1") return true;

        const score = readMatchScore(matchElement);
        if (!score || typeof window.makeMatchScorers !== "function") return false;

        let scorers;
        try {
            scorers = window.makeMatchScorers(score.widzewGoals, score.opponentGoals);
        } catch (error) {
            console.error("Nie udało się wylosować strzelców finału sezonu:", error);
            return false;
        }

        const scoreWrap = matchElement.querySelector(".round-score-wrap") || matchElement;
        let container = scoreWrap.querySelector(".match-scorers");
        if (!container) {
            container = document.createElement("div");
            container.className = "match-scorers";
            scoreWrap.appendChild(container);
        }

        container.innerHTML = "";
        scorers
            .slice()
            .sort((a, b) => Number(a.minute || 0) - Number(b.minute || 0))
            .forEach(scorer => {
                const span = document.createElement("span");
                const minute = Math.max(1, Math.min(90, Number(scorer.minute) || 1));
                const isOpponent = scorer.type === "opponent";
                span.className = isOpponent ? "scorer-opponent" : "scorer-widzew";
                span.textContent = `${minute}' ${isOpponent ? "Przeciwnik" : (scorer.name || "Samobój")}`;
                container.appendChild(span);
            });

        matchElement.dataset.finalScorersReady = "1";
        return true;
    }

    function decorateFinalSeasonScorers() {
        const matches = Array.from(document.querySelectorAll(".round-match.widzew-match"));
        if (!matches.length) return;
        matches.forEach(renderFinalScorers);
    }

    function scheduleDecoration() {
        [0, 50, 150, 300].forEach(delay => {
            setTimeout(decorateFinalSeasonScorers, delay);
        });
    }

    const originalRenderFinalSeason = window.renderFinalSeason;
    if (typeof originalRenderFinalSeason === "function") {
        window.renderFinalSeason = function () {
            const result = originalRenderFinalSeason.apply(this, arguments);
            scheduleDecoration();
            return result;
        };
    }

    const style = document.createElement("style");
    style.id = "finalSeasonScorerFixStyles";
    style.textContent = `
        .match-scorers .scorer-widzew { color: #39d353 !important; }
        .match-scorers .scorer-opponent { color: #ff4d4f !important; }
        .match-scorers { display:flex; flex-direction:column; align-items:center; gap:3px; margin-top:7px; font-size:13px; font-weight:800; line-height:1.25; }
    `;
    document.head.appendChild(style);

    scheduleDecoration();
})();

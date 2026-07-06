import { LEVELS } from "@/config/levels";
import { el, button, icoTag, starsRow, fmtTimePrecise } from "./dom";

/** What the leaderboard needs from the surrounding UI shell. */
export interface LeaderboardContext {
  overlay: (solid: boolean) => HTMLElement;
  goHome: () => void;
}

interface LevelEntry {
  username: string;
  time: number;
  stars: number;
}

interface MarathonEntry {
  username: string;
  time: number;
  coins?: number;
  deaths?: number;
}

/**
 * The global leaderboard overlay: top-3 best times per level plus the
 * marathon board, fetched from the backend.
 */
export function openLeaderboard(ctx: LeaderboardContext): void {
  const o = ctx.overlay(true);
  o.id = "leaderboard-overlay";

  const p = el("div", "panel purple wide");
  p.appendChild(el("div", "panel-title", "BESTENLISTE"));

  const loading = el("div", "muted-text", "Lade Daten...");
  loading.style.textAlign = "center";
  loading.style.fontSize = "2.8vmin";
  p.appendChild(loading);

  const closeBtn = button("ZURÜCK", "blue", { icon: "home" });
  closeBtn.onclick = () => ctx.goHome();

  fetch("/api/leaderboard")
    .then((r) => r.json())
    .then((data) => {
      loading.remove();

      const container = el("div", "leaderboard-container");

      for (let i = 0; i < LEVELS.length; i++) {
        const levelDiv = el("div", "leaderboard-level");
        levelDiv.appendChild(el("div", "leaderboard-level-title", `LEVEL ${i + 1}`));

        const list = el("div", "leaderboard-list");
        const levelData: LevelEntry[] = data[i] || [];

        if (levelData.length === 0) {
          list.appendChild(el("div", "leaderboard-empty", "Keine Einträge"));
        } else {
          levelData.forEach((entry, index) => {
            const row = el("div", "leaderboard-row");
            const rank = el("span", "leaderboard-rank", `${index + 1}.`);
            const name = el("span", "leaderboard-name", entry.username);
            const time = el("span", "leaderboard-time", fmtTimePrecise(entry.time));
            const stars = el("span", "leaderboard-stars");
            stars.innerHTML = starsRow(entry.stars);
            row.append(rank, name, time, stars);
            list.appendChild(row);
          });
        }

        levelDiv.appendChild(list);
        container.appendChild(levelDiv);
      }

      // Marathon board: full-width section below the per-level boards.
      const maraDiv = el("div", "leaderboard-level marathon");
      maraDiv.appendChild(el("div", "leaderboard-level-title", "MARATHON"));
      const maraList = el("div", "leaderboard-list");
      const maraData: MarathonEntry[] = data.marathon || [];
      if (maraData.length === 0) {
        maraList.appendChild(el("div", "leaderboard-empty", "Noch kein Run geschafft"));
      } else {
        maraData.forEach((entry, index) => {
          const row = el("div", "leaderboard-row");
          const rank = el("span", "leaderboard-rank", `${index + 1}.`);
          const name = el("span", "leaderboard-name", entry.username);
          const time = el("span", "leaderboard-time", fmtTimePrecise(entry.time));
          const meta = el("span", "leaderboard-meta");
          meta.innerHTML =
            `${icoTag("coin")} ${entry.coins ?? 0}` +
            `<span class="sep">·</span>` +
            `${icoTag("heart")} −${entry.deaths ?? 0}`;
          row.append(rank, name, time, meta);
          maraList.appendChild(row);
        });
      }
      maraDiv.appendChild(maraList);
      container.appendChild(maraDiv);

      p.insertBefore(container, closeBtn);
    })
    .catch((err) => {
      loading.textContent = "Fehler beim Laden!";
      console.error("Leaderboard error:", err);
    });

  p.appendChild(closeBtn);
  o.appendChild(p);
}

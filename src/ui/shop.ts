import { CHARACTERS, CHARACTER_LIST, type CharacterId } from "@/config/characterAssets";
import { saveState } from "@/systems/SaveState";
import { audioManager } from "@/systems/AudioManager";
import { el, button, icoTag } from "./dom";

/** What the shop needs from the surrounding UI shell. */
export interface ShopContext {
  /** Create a fresh full-screen overlay (closes any other overlay). */
  overlay: (solid: boolean) => HTMLElement;
  /** Navigate back to the home screen. */
  goHome: () => void;
}

/**
 * The character shop: shows the account coin balance, one card per character,
 * and lets the player buy locked characters or switch the active one.
 * Selection persists in the save (local + backend).
 *
 * The overlay/panel are built ONCE; buying or selecting only re-renders the
 * balance and the card grid in place — rebuilding the whole overlay flashed
 * the screen and made the shop feel sluggish.
 */
export function openShop(ctx: ShopContext): void {
  const o = ctx.overlay(true);
  o.id = "shop-overlay";

  const p = el("div", "panel purple wide shop-panel");
  p.appendChild(el("div", "panel-title", "SHOP"));

  // Account balance: every coin collected in any run lands here.
  const balance = el("div", "shop-balance");
  p.appendChild(balance);

  const grid = el("div", "shop-grid");
  p.appendChild(grid);

  const closeBtn = button("ZURÜCK", "blue", { icon: "home" });
  closeBtn.onclick = () => ctx.goHome();
  p.appendChild(closeBtn);
  o.appendChild(p);

  const render = () => {
    balance.innerHTML =
      `${icoTag("coin")}<span class="val">${saveState.getTotalCoins()}</span>` +
      `<span class="lbl">Münzen auf deinem Konto</span>`;
    grid.replaceChildren(
      ...CHARACTER_LIST.map((char) => shopCard(char.id, render))
    );
  };
  render();
}

/** One character card in the shop (portrait, name, ability, price / select state). */
function shopCard(id: CharacterId, rerender: () => void): HTMLElement {
  const char = CHARACTERS[id];
  const owned = saveState.isCharacterOwned(id);
  const selected = saveState.getSelectedCharacter() === id;
  const balance = saveState.getTotalCoins();

  const card = el("div", `shop-card${selected ? " selected" : ""}${owned ? "" : " locked"}`);

  const frame = el("div", "shop-portrait");
  const img = el("img");
  img.src = char.portrait.url;
  img.draggable = false;
  if (char.pixelArt) img.classList.add("pixelated");
  frame.appendChild(img);
  if (selected) frame.appendChild(el("div", "shop-active-badge", "AKTIV"));
  card.appendChild(frame);

  card.appendChild(el("div", "shop-name", char.name));
  card.appendChild(el("div", "shop-tagline", char.tagline));

  // Ability panel: what makes this character play differently.
  const ab = char.ability;
  const ability = el("div", "shop-ability");
  ability.style.setProperty("--ab-accent", ab.color);
  ability.innerHTML =
    `<div class="ab-head">` +
    `<span class="ab-badge">FÄHIGKEIT</span>` +
    `<span class="ab-name">${ab.name}</span>` +
    `</div>` +
    `<div class="ab-desc">${ab.desc}</div>` +
    `<div class="ab-hint">${ab.hint}</div>`;
  card.appendChild(ability);

  if (selected) {
    const b = button("AUSGEWÄHLT", "grey");
    b.disabled = true;
    card.appendChild(b);
  } else if (owned) {
    const b = button("AUSWÄHLEN", "green");
    b.onclick = () => {
      saveState.setSelectedCharacter(id);
      audioManager.play("coin");
      rerender(); // in-place: card states flip, no overlay rebuild
    };
    card.appendChild(b);
  } else {
    const price = el("div", "shop-price");
    price.innerHTML = `${icoTag("coin")}<span>${char.price}</span>`;
    card.appendChild(price);

    const affordable = balance >= char.price;
    const b = button("KAUFEN", affordable ? "gold" : "grey");
    if (affordable) {
      b.onclick = () => {
        if (!saveState.buyCharacter(id, char.price)) return;
        audioManager.play("extralife"); // little fanfare for the unlock
        rerender(); // in-place: card flips to owned + selected
      };
    } else {
      b.disabled = true;
      card.appendChild(b);
      const missing = char.price - balance;
      card.appendChild(el("div", "shop-hint", `Noch ${missing} Münzen sammeln!`));
      return card;
    }
    card.appendChild(b);
  }
  return card;
}

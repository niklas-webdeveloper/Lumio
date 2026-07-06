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
 */
export function openShop(ctx: ShopContext): void {
  const o = ctx.overlay(true);
  o.id = "shop-overlay";

  const p = el("div", "panel purple wide shop-panel");
  p.appendChild(el("div", "panel-title", "SHOP"));

  // Account balance: every coin collected in any run lands here.
  const balance = el("div", "shop-balance");
  balance.innerHTML =
    `${icoTag("coin")}<span class="val">${saveState.getTotalCoins()}</span>` +
    `<span class="lbl">Münzen auf deinem Konto</span>`;
  p.appendChild(balance);

  const grid = el("div", "shop-grid");
  for (const char of CHARACTER_LIST) grid.appendChild(shopCard(ctx, char.id));
  p.appendChild(grid);

  const closeBtn = button("ZURÜCK", "blue", { icon: "home" });
  closeBtn.onclick = () => ctx.goHome();
  p.appendChild(closeBtn);
  o.appendChild(p);
}

/** One character card in the shop (portrait, name, price / select state). */
function shopCard(ctx: ShopContext, id: CharacterId): HTMLElement {
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

  if (selected) {
    const b = button("AUSGEWÄHLT", "grey");
    b.disabled = true;
    card.appendChild(b);
  } else if (owned) {
    const b = button("AUSWÄHLEN", "green");
    b.onclick = () => {
      saveState.setSelectedCharacter(id);
      audioManager.play("coin");
      openShop(ctx); // re-render with the new selection
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
        openShop(ctx); // re-render: card flips to owned + selected
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

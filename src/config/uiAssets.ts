import Phaser from "phaser";

/**
 * UI sprite keys — panels, buttons, level slot, title plate and star ratings,
 * sliced from the provided asset sheets into public/assets/ui/.
 */
export const UiTex = {
  panelPause: "ui_panel_pause",
  panelCompleted: "ui_panel_completed",
  panelConfig: "ui_panel_config",
  plateLevels: "ui_plate_levels",
  slot: "ui_slot",
  btnPlay: "ui_btn_play",
  btnPause: "ui_btn_pause",
  btnRestart: "ui_btn_restart",
  btnHome: "ui_btn_home",
  btnBack: "ui_btn_back",
  btnNext: "ui_btn_next",
  btnSettings: "ui_btn_settings",
  btnSound: "ui_btn_sound",
  btnInfo: "ui_btn_info",
  stars0: "ui_stars0",
  stars1: "ui_stars1",
  stars2: "ui_stars2",
  stars3: "ui_stars3",
} as const;

const FILES: Record<string, string> = {
  [UiTex.panelPause]: "panel_pause.png",
  [UiTex.panelCompleted]: "panel_completed.png",
  [UiTex.panelConfig]: "panel_config.png",
  [UiTex.plateLevels]: "plate_levels.png",
  [UiTex.slot]: "slot.png",
  [UiTex.btnPlay]: "btn_play.png",
  [UiTex.btnPause]: "btn_pause.png",
  [UiTex.btnRestart]: "btn_restart.png",
  [UiTex.btnHome]: "btn_home.png",
  [UiTex.btnBack]: "btn_back.png",
  [UiTex.btnNext]: "btn_next.png",
  [UiTex.btnSettings]: "btn_settings.png",
  [UiTex.btnSound]: "btn_sound.png",
  [UiTex.btnInfo]: "btn_info.png",
  [UiTex.stars0]: "stars0.png",
  [UiTex.stars1]: "stars1.png",
  [UiTex.stars2]: "stars2.png",
  [UiTex.stars3]: "stars3.png",
};

/** Queue all UI sprites for loading (call in PreloadScene.preload). */
export function loadUiAssets(scene: Phaser.Scene): void {
  for (const [key, file] of Object.entries(FILES)) {
    scene.load.image(key, `assets/ui/${file}`);
  }
}

/** Texture key for an N-star rating (0..3). */
export function starsTexture(stars: number): string {
  const keys = [UiTex.stars0, UiTex.stars1, UiTex.stars2, UiTex.stars3];
  return keys[Phaser.Math.Clamp(stars, 0, 3)];
}

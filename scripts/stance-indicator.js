// L5R5e Token Stance Indicator
// Renders the active ring stance from actor.system.conflict.stance on the token.
// Visible only to the token owner and the GM — purely client-side, never synced.

const MODULE_ID = "l5r5e-token-stance";
const CONTAINER_NAME = `${MODULE_ID}-stance`;

// Detect PIXI major version once at load time to branch between v7 and v8 Graphics APIs.
const PIXI_MAJOR = parseInt(PIXI.VERSION.split(".")[0]);

const RING_COLORS = {
  air:   0x88BBFF,
  earth: 0x88CC44,
  fire:  0xFF5500,
  water: 0x2277DD,
  void:  0xAA44EE,
};

const RING_ICONS = {
  air:   "systems/l5r5e/assets/icons/rings/air.svg",
  earth: "systems/l5r5e/assets/icons/rings/earth.svg",
  fire:  "systems/l5r5e/assets/icons/rings/fire.svg",
  water: "systems/l5r5e/assets/icons/rings/water.svg",
  void:  "systems/l5r5e/assets/icons/rings/void.svg",
};

// Prevents a stale async draw from replacing a newer one when refreshToken
// fires multiple times in quick succession.
const drawGens = new WeakMap();

function canViewStance(token) {
  if (game.user.isGM) return true;
  return token.actor?.testUserPermission(game.user, "OWNER") ?? false;
}

function removeContainer(token) {
  const c = token.getChildByName?.(CONTAINER_NAME);
  if (c) c.destroy({ children: true });
}

// Returns a PIXI.Graphics background circle, compatible with both PIXI v7 and v8.
function buildBackground(radius, ringColor) {
  const g = new PIXI.Graphics();
  if (PIXI_MAJOR >= 8) {
    // PIXI v8 (Foundry v13+)
    g.circle(0, 0, radius).fill({ color: 0x000000, alpha: 0.55 });
    g.circle(0, 0, radius).stroke({ color: ringColor, width: 1.5, alpha: 0.85 });
  } else {
    // PIXI v7 (Foundry v11–v12)
    g.beginFill(0x000000, 0.55)
     .lineStyle(1.5, ringColor, 0.85)
     .drawCircle(0, 0, radius)
     .endFill();
  }
  return g;
}

async function renderStance(token) {
  const gen = (drawGens.get(token) ?? 0) + 1;
  drawGens.set(token, gen);

  removeContainer(token);

  if (!token.w || !token.h) return;
  if (!token.actor || !canViewStance(token)) return;

  const stance = token.actor.system?.stance;
  const color = RING_COLORS[stance];
  const iconPath = RING_ICONS[stance];
  if (color === undefined || !iconPath) return;

  const iconSize = Math.min(token.w, token.h) * 0.30;
  const bgRadius = iconSize * 0.55;

  let texture;
  try {
    texture = await loadTexture(iconPath);
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not load icon for stance "${stance}"`, err);
    return;
  }

  // Bail out if a newer draw was requested while we were awaiting the texture,
  // or if the token was destroyed in the meantime.
  if (drawGens.get(token) !== gen || token.destroyed) return;

  const container = new PIXI.Container();
  container.name = CONTAINER_NAME;

  container.addChild(buildBackground(bgRadius, color));

  if (texture?.valid) {
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.width = iconSize * 0.82;
    sprite.height = iconSize * 0.82;
    sprite.tint = color;
    container.addChild(sprite);
  }

  // Position the icon at the bottom-right corner, inset so it stays inside the token bounds.
  container.position.set(token.w - bgRadius * 1.1, token.h - bgRadius * 1.1);

  token.addChild(container);
}

// Re-draw on every token refresh (position changes, visibility changes, scene load, etc.).
Hooks.on("refreshToken", (token) => {
  renderStance(token).catch(err =>
    console.error(`${MODULE_ID} | Error rendering stance indicator`, err)
  );
});

// Linked tokens: re-draw directly when the base actor's system data changes.
// We call renderStance() directly rather than token.refresh() because Foundry
// may skip the refreshToken hook when only actor data changes (no canvas-visible
// property like position or vision changed).
Hooks.on("updateActor", (actor, changes) => {
  if (!("system" in changes)) return;
  canvas.tokens?.placeables
    .filter(t => t.document.actorId === actor.id)
    .forEach(t => renderStance(t).catch(console.error));
});

// Unlinked tokens (delta changes) or actor re-linking.
Hooks.on("updateToken", (tokenDoc, changes) => {
  if (
    !foundry.utils.hasProperty(changes, "delta.system") &&
    !("actorId" in changes)
  ) return;
  const token = tokenDoc.object;
  if (token) renderStance(token).catch(console.error);
});

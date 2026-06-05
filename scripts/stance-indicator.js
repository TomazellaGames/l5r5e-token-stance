// L5R5e Token Stance Indicator
// Renders the active ring stance on the token, visible only to owner and GM.
// Adds a right-click context menu to change stance on any token (including NPCs).

const MODULE_ID = "l5r5e-token-stance";
const CONTAINER_NAME = `${MODULE_ID}-stance`;
const PIXI_MAJOR = parseInt(PIXI.VERSION.split(".")[0]);
const RINGS = ["air", "earth", "fire", "water", "void"];

// Official ring colors from system/styles/scss/colors.scss.
// Void is lifted slightly from #4B4641 so it stays visible against the dark token bg.
const RING_COLORS = {
  air:   0x917896,  // rgb(145, 120, 150)
  earth: 0x699678,  // rgb(105, 150, 120)
  fire:  0x9B7350,  // rgb(155, 115, 80)
  water: 0x5F919B,  // rgb(95,  145, 155)
  void:  0x807A75,  // rgb(75,  70,  65)  — brightened for visibility
};

const RING_ICONS = {
  air:   "systems/l5r5e/assets/icons/rings/air.svg",
  earth: "systems/l5r5e/assets/icons/rings/earth.svg",
  fire:  "systems/l5r5e/assets/icons/rings/fire.svg",
  water: "systems/l5r5e/assets/icons/rings/water.svg",
  void:  "systems/l5r5e/assets/icons/rings/void.svg",
};

const drawGens = new WeakMap();

// loadTexture was moved to foundry.canvas.loadTexture in Foundry v13.
// Fall back to the (deprecated) global for v12 compatibility.
const _loadTexture = foundry.canvas?.loadTexture?.bind(foundry.canvas) ?? loadTexture;

// ──────────────── stance data helpers ────────────────

function localizeRing(ring) {
  const key = `l5r5e.rings.${ring}`;
  const result = game.i18n.localize(key);
  return result !== key ? result : ring.charAt(0).toUpperCase() + ring.slice(1);
}

// Characters store stance in system.stance (written by the conflict tab UI).
// NPCs and other actor types store stance in the token document flag so it
// persists per-token and works for both linked and unlinked tokens.
function getTokenStance(token) {
  if (!token.actor) return null;
  if (token.actor.type === "character") return token.actor.system?.stance ?? null;
  return token.document.getFlag(MODULE_ID, "stance") ?? null;
}

async function setTokenStance(token, ring) {
  if (!token.actor) return;
  if (token.actor.type === "character") {
    await token.actor.update({ "system.stance": ring });
  } else {
    // Token document flag keeps the stance per-token for NPCs/armies.
    await token.document.setFlag(MODULE_ID, "stance", ring);
  }
}

// ──────────────── permissions ────────────────

function canViewStance(token) {
  return game.user.isGM || (token.actor?.testUserPermission(game.user, "OWNER") ?? false);
}

function canChangeStance(token) {
  return game.user.isGM || (token.actor?.testUserPermission(game.user, "OWNER") ?? false);
}

// ──────────────── PIXI rendering ────────────────

function removeContainer(token) {
  const c = token.getChildByName?.(CONTAINER_NAME);
  if (c) c.destroy({ children: true });
}

function buildBackground(radius, ringColor) {
  const g = new PIXI.Graphics();
  if (PIXI_MAJOR >= 8) {
    g.circle(0, 0, radius).fill({ color: 0x000000, alpha: 0.55 });
    g.circle(0, 0, radius).stroke({ color: ringColor, width: 1.5, alpha: 0.85 });
  } else {
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

  const stance = getTokenStance(token);
  const color  = RING_COLORS[stance];
  const iconPath = RING_ICONS[stance];
  if (color === undefined || !iconPath) return;

  const iconSize = Math.min(token.w, token.h) * 0.30;
  const bgRadius = iconSize * 0.55;

  let texture;
  try {
    texture = await _loadTexture(iconPath);
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not load icon for stance "${stance}"`, err);
    return;
  }

  // Discard if a newer draw was triggered while we awaited the texture.
  if (drawGens.get(token) !== gen || token.destroyed) return;

  const container = new PIXI.Container();
  container.name = CONTAINER_NAME;
  container.addChild(buildBackground(bgRadius, color));

  if (texture?.valid) {
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.width  = iconSize * 0.82;
    sprite.height = iconSize * 0.82;
    sprite.tint   = color;
    container.addChild(sprite);
  }

  container.position.set(token.w - bgRadius * 1.1, token.h - bgRadius * 1.1);
  token.addChild(container);
}

// Re-draw on every token refresh (position, visibility, scene load, …).
Hooks.on("refreshToken", (token) => {
  renderStance(token).catch(err =>
    console.error(`${MODULE_ID} | Error rendering stance indicator`, err)
  );
});

// Characters: re-draw when the base actor's system data changes.
// We call renderStance directly instead of token.refresh() because Foundry
// may skip the refreshToken hook when only actor data changes.
Hooks.on("updateActor", (actor, changes) => {
  if (!("system" in changes)) return;
  canvas.tokens?.placeables
    .filter(t => t.document.actorId === actor.id)
    .forEach(t => renderStance(t).catch(console.error));
});

// NPCs / unlinked tokens: re-draw when token flags or delta system data changes.
Hooks.on("updateToken", (tokenDoc, changes) => {
  if (
    !foundry.utils.hasProperty(changes, "delta.system") &&
    !foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) &&
    !("actorId" in changes)
  ) return;
  const token = tokenDoc.object;
  if (token) renderStance(token).catch(console.error);
});

// ──────────────── right-click context menu ────────────────

let _lastHoveredToken = null;

Hooks.on("hoverToken", (token, hovered) => {
  console.log(`${MODULE_ID} | hoverToken fired`, { tokenName: token?.name, hovered });
  if (hovered) _lastHoveredToken = token;
});

function _pushStanceEntries(entries, token) {
  if (!token || !canChangeStance(token)) return;
  const currentStance = getTokenStance(token);
  for (const ring of RINGS) {
    const isCurrent = currentStance === ring;
    const displayName = `${localizeRing(ring)}${isCurrent ? " ✓" : ""}`;
    const action = () => setTokenStance(token, ring).catch(err =>
      console.error(`${MODULE_ID} | Failed to set stance to "${ring}"`, err)
    );
    entries.push({
      // v14 ApplicationV2 ContextMenuEntry fields
      label: displayName,
      visible: true,
      onClick: action,
      // v12/v13 legacy ContextMenuEntry fields (same object, ignored by v14)
      name: displayName,
      condition: () => true,
      callback: action,
      icon: `<i class="i_${ring}"></i>`,
    });
  }
}

// v12–v13: called from PlaceableObject._getContextOptions()
Hooks.on("getTokenContextOptions", (tokenOrHtml, entries) => {
  console.log(`${MODULE_ID} | getTokenContextOptions fired`, { tokenOrHtml, entries });
  const token = (tokenOrHtml instanceof Token ? tokenOrHtml : null)
    ?? canvas.tokens?.hover
    ?? _lastHoveredToken;
  console.log(`${MODULE_ID} | resolved token:`, token);
  const before = entries.length;
  _pushStanceEntries(entries, token);
  console.log(`${MODULE_ID} | pushed ${entries.length - before} entries (entries now ${entries.length})`);
});

// v14+: ApplicationV2-based context menu (replaces getTokenContextOptions)
Hooks.on("getTokenPlaceableContextOptions", (application, menuItems) => {
  // canvas.tokens.hover is null by the time the context menu fires in v14;
  // fall back to the last-hovered token, then to the single controlled token.
  const token = canvas.tokens?.hover
    ?? _lastHoveredToken
    ?? (canvas.tokens?.controlled?.length === 1 ? canvas.tokens.controlled[0] : null);
  console.log(`${MODULE_ID} | getTokenPlaceableContextOptions fired`, {
    hover: canvas.tokens?.hover,
    lastHovered: _lastHoveredToken,
    controlled: canvas.tokens?.controlled,
    resolved: token,
  });
  const before = menuItems.length;
  _pushStanceEntries(menuItems, token);
  console.log(`${MODULE_ID} | pushed ${menuItems.length - before} entries`);
});

# L5R5e Token Stance Indicator

A [Foundry VTT](https://foundryvtt.com/) module for the [Legend of the Five Rings 5th Edition](https://foundryvtt.com/packages/l5r5e) system.

## What it does

- **Stance icon on token** — displays the character's active ring stance (Air, Earth, Fire, Water, or Void) as a small colored ring symbol in the bottom-right corner of the token. Only the token's owner and the GM can see it.
- **Change stance from the canvas** — right-clicking any token opens the Token HUD with five ring buttons. Click a ring to set that stance immediately, without opening the character sheet.
- **Works for NPCs too** — NPCs don't have a stance in their data model, so the module stores it in the token itself. Each NPC token keeps its own stance independently.
- **Reactive** — the icon updates automatically whenever the stance changes, whether from the HUD buttons, the character sheet conflict tab, or a macro.

## Compatibility

| Foundry VTT | Status |
|---|---|
| v14 | Verified |
| v12 – v13 | Compatible |

Requires the **l5r5e** system.

## Installation

### From the Foundry module browser (recommended)

1. Open Foundry VTT and go to **Configuration → Add-on Modules → Install Module**.
2. Paste the following manifest URL into the search box at the bottom:
   ```
   https://raw.githubusercontent.com/TomazellaGames/l5r5e-token-stance/main/module.json
   ```
3. Click **Install**.
4. Enable the module in your world under **Configuration → Manage Modules**.

### Manual install

1. Download `l5r5e-token-stance.zip` from the [latest release](https://github.com/TomazellaGames/l5r5e-token-stance/releases/latest).
2. Extract the zip into your Foundry `Data/modules/` folder so the path looks like:
   ```
   Data/modules/l5r5e-token-stance/module.json
   ```
3. Restart Foundry and enable the module in your world.

## Usage

| What you want | How to do it |
|---|---|
| See a token's stance | The ring icon appears on the token (GM and owner only) |
| Change a character's stance | Right-click the token → click a ring button in the HUD |
| Change an NPC's stance | Right-click the token → click a ring button in the HUD |
| Change via the sheet | Use the Conflict tab as normal — the icon updates automatically |

## Author

Jeferson Tomazella — [GitHub](https://github.com/TomazellaGames)

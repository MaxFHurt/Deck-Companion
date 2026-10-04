# Deck Companion

A Magic: The Gathering deck builder for Commander and Standard.

- Import a plain-text decklist or pick cards through search
- Aim the deck: ranked mechanics and land-color focus
- Upgrade recommendations in three tiers: Budget (cards up to $3), Mid (up to $12), Apex (no cap)
- Official preconstructed Commander decklists for new players
- Generate a deck from any commander
- Card text, prices, legality and artwork from Scryfall, refreshed about once a day

It is a static site: no build step and no server. Decks are saved in the browser's local storage. The Profile screen can save a backup file to the device and restore from it, and in Chrome or Edge on a computer it can keep a chosen backup file updated automatically.

## Publish with GitHub Pages

1. Repository **Settings → Pages**
2. Under **Build and deployment**, set **Source** to "Deploy from a branch"
3. Pick the `main` branch and the `/ (root)` folder, then save
4. The site appears at `https://<your-username>.github.io/<repository-name>/` after a minute or two

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page markup and styles |
| `data.js` | Built-in starter card library, precon and theme definitions |
| `lists.js` | Official precon decklists |
| `engine.js` | Import parsing, deck analysis, recommendations |
| `ui.js` | Screens, storage, Scryfall data loading |

## Credits

Card data and images: [Scryfall](https://scryfall.com). Precon decklists: EDHREC.

Deck Companion is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

# Hear Me Out — online

A party game for 2–12 friends, each on their own phone or computer. Everyone secretly picks their most questionable crush, you decorate a cake together, then reveal your picks one by one, put them on the cake, defend yourself, and vote.

Built with React + TypeScript (Vite). Online play runs on Firebase Realtime Database with anonymous sign-in. Without Firebase settings the game runs in **practice mode**: rooms only work between tabs of one browser.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22.12 or newer.

```bash
npm install
npm run dev
```

Open the address it prints (http://localhost:5173). It uses the Firebase settings in `public/hmo-config.js`, so games you start locally are real online rooms. To play both sides yourself, open the second player in a different browser or a private/incognito window: tabs of the same browser are the same player.

With `hmo-config.js` set to `null` the game runs in practice mode instead, where tabs of one browser play against each other (open a new tab, not "Duplicate tab", or add `?seat=B` to a tab's address).

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with live reload |
| `npm test` | Plays whole simulated games with 2–12 players and checks the rules |
| `npm run build` | Type-checks and builds the site into `dist/` |
| `npm run preview` | Serves the built `dist/` folder locally |

## Part 1 — Firebase (about 10 minutes, free)

1. Go to **console.firebase.google.com** and sign in with a Google account.
2. Click **Create a project** (or **Add project**). Name it, e.g. `hear-me-out`. Turn Google Analytics **off**. Click **Create project**, then **Continue**.
3. **Turn on anonymous sign-in**
   - Left menu: **Build → Authentication → Get started**.
   - Tab **Sign-in method** → **Anonymous** → switch **Enable** on → **Save**.
4. **Allow your website**
   - Still in Authentication: tab **Settings → Authorized domains → Add domain**.
   - Type your site's domain, e.g. `ricardor2008.github.io` → **Add**. (`localhost` is allowed already.)
5. **Create the database**
   - Left menu: **Build → Realtime Database → Create Database**.
   - Pick the location closest to you → **Next** → **Start in locked mode** → **Enable**.
   - Open the **Rules** tab. Delete everything there, paste the whole contents of [`firebase/database.rules.json`](firebase/database.rules.json), click **Publish**.
6. **Get your settings**
   - Click the gear next to **Project Overview → Project settings**.
   - Scroll to **Your apps** → click the **`</>`** (Web) icon.
   - Nickname: `hear-me-out`. Leave "Firebase Hosting" unchecked. Click **Register app**.
   - You will see a block that starts with `const firebaseConfig = {`. Copy everything between the `{` and `}`.
7. Open [`public/hmo-config.js`](public/hmo-config.js) and replace `null` so it looks like:
   ```js
   window.HMO_FIREBASE_CONFIG = {
     apiKey: "AIza…",
     authDomain: "hear-me-out-xxxx.firebaseapp.com",
     databaseURL: "https://hear-me-out-xxxx-default-rtdb.firebaseio.com",
     projectId: "hear-me-out-xxxx",
     appId: "1:…:web:…"
   };
   ```
   If there is no `databaseURL` line, add it: copy the URL shown at the top of the **Realtime Database → Data** page.

These keys are meant to be public in a web game; the rules from step 5 are what protect the data. `hmo-config.js` is loaded as-is when the page opens (it is not bundled), so you can also edit it in an already-built `dist/` folder.

## Part 2 — Put it online with GitHub Pages

The repo includes a workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that tests, builds and publishes the game every time you push to `main`.

1. Push this project to your GitHub repo (e.g. `RicardoR2008/Hear-me-out-game`).
2. On GitHub: **Settings → Pages → Source: GitHub Actions**.
3. Open the **Actions** tab and wait for "Deploy to GitHub Pages" to finish (about a minute). The site is then live at `https://<your-user>.github.io/<repo>/`, e.g. https://ricardor2008.github.io/Hear-me-out-game/.
4. The join screen should **not** say "Practice mode". If it does, `public/hmo-config.js` still has `null` or a typo.

Prefer not to use Actions? Run `npm run build` and upload the **contents** of `dist/` to any static host.

## How to play

A printable guide with a picture of every step: [Hear Me Out - How to Play V4.pdf](docs/Hear%20Me%20Out%20-%20How%20to%20Play%20V4.pdf).

- One person taps **Create a room** and reads out the 4-letter code (or taps **Copy invite link**, which says **Share invite link** on phones, and sends it: the link opens the game with the code filled in). Everyone else types it and taps **Join**. 2–12 players.
- The first person in is the host. The top of the lobby says in big letters whether you are the host or a player, and the host has a crown 👑 on their picture at the top of every screen. If the host leaves, the next person who joined becomes host automatically. The same happens mid-game if the host's screen stops answering for about 8 seconds (phone locked, app switched), so nobody is left waiting.
- When you are ready, tap **Start the cake**. Everyone sees who is ready, in the lobby list and as a ✓ on their picture at the top. Once everyone still in the room has tapped it, the host taps **Let us take them to the bakery!** and a 3-second countdown starts on every screen. Tap **Not yet** (it is also in the countdown box) to take your OK back and stop the countdown.
- Pick a theme (everyone suggests, then votes — or type one you already agreed on), decorate the cake together, then secretly pick your hear me out and stick it on the cake.
- When your pick is set, tap **Lock it in**, then **I am ready for the reveal**. Nobody can start the reveal alone: once everyone still in the room is ready, the curtains close for a 3-second countdown. Tap **Not yet** (or **Undo lock-in**) to take your OK back.
- Reveals happen one at a time: the owner shows the picture, then the name, then each line of their defense. Everyone else reacts.
- Vote for Best and Most unhinged (a tie is broken at random, and the award says so), then save a keepsake page of the finished cake.
- Refreshing or losing signal is fine: open the link again and you are put back in your seat. While the connection is down the game says **Connection lost**; if a new version of the game is published while you are playing, it offers a **Refresh**.
- Pictures you upload are shrunk before they are sent, so they arrive fast.

Room data, including pictures, can be read by anyone using the game while the room exists. Rooms older than 24 hours are deleted the next time someone opens the game.

## If something goes wrong

- **"Could not sign in"** → Anonymous sign-in is not enabled (Part 1, step 3), or your site's domain is not in Authorized domains (step 4).
- **"Too many new players from this network right now"** → Firebase limits how many new players can start from one network in an hour. Wait a few minutes, then refresh.
- **"Could not open that room"**, or stuck on "Joining room…" after Create → check the database Rules were published (step 5).
- **"No room with that code"** → the code is wrong, or the room is over 24 hours old.
- **A player is greyed out** → they lost connection. The game skips waiting for them until they come back.

## How the code is organized

```
public/hmo-config.js      Firebase settings (loaded at runtime)
firebase/                 Database security rules
src/net/                  Database layer: Firebase, practice mode (tabs), in-memory (tests)
src/game/controller.ts    All game rules and the host's job of moving the room through phases
src/game/viewModel.ts     Turns game state into exactly what each screen shows
src/game/geometry.ts      Cake shape and where picks may stand without overlapping
src/game/keepsake.ts      The downloadable keepsake page
src/ui/                   React screens; src/ui/cake/ draws the cake (inline styles, copied by the keepsake)
src/updateCheck.ts        Notices when a newer version has been published while a page is open
src/styles.css            Day/night colors, animations and screen styles
tests/                    Multiplayer simulations (Vitest)
```

The game logic does not depend on React: `GameController` holds local state, mirrors the shared room (`rooms/<CODE>` in the database), and when it belongs to the host, advances phases when everyone is ready (each step is a database transaction, so two players acting as host at once still move the room on only once). The UI subscribes to it and renders from `buildViewModel()`.

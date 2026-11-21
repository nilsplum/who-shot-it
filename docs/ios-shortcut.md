# The iPhone shortcut ("All photos" on iOS)

Browsers cannot read an iPhone's photo library, and the Photos app is not a folder the
browser could open. An Apple Shortcut can: the game opens it with a private upload link,
the shortcut sends up to 24 random photos to the player's pool in the game room, and iOS
returns to the browser, where the normal "Play with these?" No/Yes choice continues. Only
the chosen photos are used; the pool is deleted as soon as the browser has it (at the latest
after 15 minutes).

The operator builds the shortcut **once**, shares it as an iCloud link, and puts that link
into `SHORTCUT.installUrl` in `web/shared/config.js`. Players add it with one tap the first
time they use "All photos".

## How the game calls it

```
shortcuts://x-callback-url/run-shortcut?name=Who%20Shot%20It&input=text
  &text=<upload link>                       the shortcut's input
  &x-success=<upload link>/done             marks the pool complete, back to the game
  &x-cancel=<game link>  &x-error=<game link>?setup=1
```

The upload link is `https://<domain>/api/rooms/<CODE>/pool/<token>`; each `POST` with one
JPEG as the raw body adds a photo (max 1.5 MB, max 30 per pool). The token is secret per
player and changes after every pickup. Code: `web/js/device.js` (`shortcutLink`),
`src/room.js` (`poolUpload`, `poolDone`, `takePool`).

## Build it (iPhone, Shortcuts app, about 5 minutes)

1. Open **Shortcuts**, tap **+**. Tap the name at the top and rename it to exactly
   **`Who Shot It`** (no question mark; it must match `SHORTCUT.name`).
2. Add the action **Find Photos**:
   - **Add Filter** → **Is a Screenshot** → set it to **is not** (or switch it off).
   - **Add Filter** → **Media Type** → **is Image** (so videos are skipped).
   - **Sort by** → **Random**.
   - **Limit** → on, **Get 24 Photos**.
3. Add **Repeat with Each** (it repeats with each item in *Photos*).
4. Inside the repeat, add **Resize Image**: resize *Repeat Item* to **width 1080**, height
   **Auto**.
5. Below it, add **Convert Image**: convert *Resized Image* to **JPEG**. Tap the arrow to show
   more: **Quality 70 %**, **Preserve Metadata off** (no location data leaves the phone).
6. Below it, add **Get Contents of URL**:
   - URL: tap the field and pick the variable **Shortcut Input**.
   - Show more: **Method POST**, **Request Body File**, **File** = *Converted Image*.
7. Leave **End Repeat** as it is. Nothing else follows (iOS returns to the game by itself).
8. If the editor shows a line *Receive … input from …* at the top, make sure it accepts
   **Text** (or *Any*).

## Share it

In the Shortcuts list, touch and hold **Who Shot It** → **Share** → **Copy iCloud Link**.
Paste the link (`https://www.icloud.com/shortcuts/…`) as `SHORTCUT.installUrl` in
`web/shared/config.js`, replacing the `TODO_OPERATOR:` text. The shortcut contains no
personal data: the upload link is handed over each time it runs.

## Check it

After deploying, on an iPhone in Safari: join a game → **All photos** → **1 Add shortcut**
(opens the iCloud page, tap **Add Shortcut**) → back in Safari **2 Load photos**. The first
run asks for access to photos and to send them: tap **Allow** (for photos: *Allow Full
Access*). Safari returns to the game and shows "Play with these?". From then on, "All
photos" is a single tap.

If the shortcut is renamed or deleted on a phone, Shortcuts reports an error, iOS returns
with `?setup=1`, and the game shows the two setup steps again.

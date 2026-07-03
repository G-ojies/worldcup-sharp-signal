# Uploading the demo video to YouTube

The finished explainer is at **`~/Videos/greyat-sharpsignal-explainer-FINAL-1080p.mp4`** (1080p, ~4¼ min, narrated).
Other cuts in `~/Videos/`: `…-1080p-voiced.mp4` (short 32s voiced), `…-1080p.mp4` (short silent).

## Steps

1. Go to **studio.youtube.com** (or youtube.com → **Create ▸ Upload video**) and sign in.
2. Click **Create ▸ Upload videos**, choose `~/Videos/greyat-sharpsignal-explainer-FINAL-1080p.mp4`.
3. **Title** — paste:
   ```
   GreYat SharpSignal — Autonomous World Cup Trading Agent (TxLINE + Solana)
   ```
4. **Description** — paste:
   ```
   GreYat SharpSignal is an autonomous "steam-move" trading agent for the 2026 World Cup.
   It streams the TxLINE StablePrice odds feed, detects sharp moves with a deterministic
   z-score signal, proves each update on Solana (validate_odds) before acting, and
   self-grades against the final score.

   ▶ Live: https://worldcup-sharp-signal.vercel.app
   ◇ Code: https://github.com/G-ojies/worldcup-sharp-signal

   Built for the TxODDS "Trading Tools and Agents" track on Superteam Earn.
   #Solana #TxLINE #WorldCup #TradingAgent
   ```
5. **Visibility** — **Unlisted** is fine for a hackathon (anyone with the link can view; not in search). Use **Public** if you want it discoverable. Do NOT use Private (judges couldn't open it).
6. (Optional) **Thumbnail** — upload `~/Videos` frame or the title card; you can grab one with:
   `ffmpeg -ss 2 -i ~/Videos/greyat-sharpsignal-explainer-FINAL-1080p.mp4 -frames:v 1 ~/Videos/thumb.png`
7. Click through **Next** (no need to set "made for kids" → select **No, it's not made for kids**), then **Publish** (or **Save** for unlisted).
8. Copy the video link (e.g. `https://youtu.be/…`).

## After uploading

- Paste the link into **`docs/SUBMISSION.md`** under "Demo video".
- Submit at the Trading Tools and Agents listing (this overwrites the earlier misdirected submission).

> Loom is an equally accepted alternative — loom.com → New video → Upload → share link.

## Note on the voiceover

The narration in the explainer is a synthetic (text-to-speech) voice — fine to submit as-is,
but a human voiceover (yours) usually scores better. To re-voice: mute/replace the audio track
in any editor over the silent cut, or re-record your screen following `docs/VIDEO_SCRIPT.md`.

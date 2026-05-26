---
number: 4
title: How an Apostrophe Broke My Lofi Radio Station
dek: I cancelled a $20-a-month streaming service, built the replacement in Docker, and then spent a few evenings learning that single quotes in filenames can quietly ruin your night.
category: Homelab
kicker: Field report
date: 2026-05-26
readTime: 12
tags:
  - ffmpeg
  - docker
  - youtube
  - homelab
  - lofi
editorNote: The stream is still running. I check it from my phone now, which is the part I'm most pleased about. And for free!
draft: false
---

I run a YouTube channel called [LO-FRQ](https://www.youtube.com/@LO-FRQ). It was a 'secret' up until now, but this was too good not to write about. Its main focus is lofi "study with me" music, but with a hi-bit pixel aesthetic instead of the regular anime vibe you see. One of the videos is a 24/7 livestream "radio station". 

I'm not a musician. I don't want to be on camera. I'm a developer who can string a stack together, and the combination of Suno for music and Leonardo for visuals made the channel possible without any of the traditional creative skills. The pixel art lofi space is also surprisingly empty compared to the illustrated/anime side of it, so there's room to build something that looks like it belongs to itself.

A couple of months after running the channel I sought to set up a dedicated 24/7 radio station of all the music. I found a platform that let me create my own livestream (visuals, music, overlay) for $20 a month. It worked flawlessly. 

Then I cancelled.

## Why cancel something that works

Honestly? Life got in the way. My focus shifted away from the channel, and spending $20 a month on something I hardly look at (and thus not promote) is a waste I gladly clean up. And so I did. Time passed and I saw a notification from a viewer that missed the stream; they used it to actually study! If you actually clicked on my channel link, you notice I don't get a lot of views, so getting a reaction from an actual viewer saying they miss the stream was motivation enough to try and get it back.

But honestly. I wasn't sure if I was ready to dish out $20 a month again for one potential viewer. I figured there had to be a way to 'mimic' the platform I used earlier, albeit a bit barebones. That would give me two benefits: Getting the stream back for $0 and having something cool to build!

## The plan

Run FFmpeg in a Docker container. Give it a looping video and a shuffled playlist of MP3s. Push the combined output to YouTube's RTMP ingest. Done. But is there one time it is actually as easy as that?

The FFmpeg command at the heart of it ended up looking like this:

```bash
ffmpeg \
  -stream_loop -1 -re -i /videos/lighthouse_loop_fixed.mp4 \
  -f concat -safe 0 -re -i /music/playlist.txt \
  -map 0:v:0 \
  -map 1:a:0 \
  -c:v copy \
  -c:a aac -b:a 192k -ar 44100 -ac 2 \
  -f flv "rtmp://a.rtmp.youtube.com/live2/$STREAM_KEY"
```

Two inputs: the video loop (`-stream_loop -1` keeps it cycling forever), and an ffconcat playlist of MP3s. Video gets copied as-is (no re-encoding, which keeps the CPU happy on the NAS), audio gets re-encoded to AAC because YouTube LIVE works better that way. Out it goes as FLV to YouTube's RTMP endpoint.

The stream key lives as an environment variable, not in the compose file. That part was obvious. The rest was less obvious.

## Things that broke before the stream even started

**MP3 cover art.** Suno embeds cover art into every track it generates. The FFmpeg concat demuxer sees those MP3s as having two streams (audio plus an MJPEG thumbnail) and gets confused about which is which. The fix was a pre-processing step: strip the cover art into a separate `/music/clean/` folder and build the playlist from there.

**A handful of WAV files.** Roughly 20 of the ~400 tracks were WAVs. Converted to MP3 on first run via a wrapper script. I think this wasn't technically necessary in the end, but here we are.

**Line endings.** This one cost me an evening. The wrapper `stream.sh` *must* be saved with LF endings. I'd edited it on Windows, which gave me CRLF, which bash inside the Alpine container does not enjoy. The error messages are completely opaque: unexpected `done`, "Invalid argument" on `-map` flags that look syntactically perfect. None of it points at the actual cause. If you ever edit shell scripts on Windows and deploy them to Linux containers, save yourself the time and configure your editor for LF up front.

**YouTube's keyframe requirement.** YouTube wants keyframe intervals of 4 seconds or less. The video I had was encoded with intervals of about 9.8 seconds. The fix was to re-encode the video once with a keyframe every 50 frames (2 seconds at 25fps) and a bitrate that meets YouTube's 6800 Kbps recommendation:

```bash
ffmpeg -i lighthouse_loop.mp4 \
  -c:v libx264 -b:v 6000k -maxrate 6000k -bufsize 12000k \
  -g 50 -keyint_min 50 -sc_threshold 0 \
  -pix_fmt yuv420p \
  lighthouse_loop_fixed.mp4
```

Done once, never touched again.

The wrapper script (`stream.sh`) handles the housekeeping: strips cover art from new tracks, converts new WAVs, generates the shuffled ffconcat playlist, runs FFmpeg, and restarts it after 10 seconds if it exits for any reason. The whole thing is maybe 60 lines of bash.

## The apostrophe

The stream went live. It worked. I was pleased with myself for about a day.

Then it started buffering after a while. Audio would cut out for a few seconds, the stream would stall or freeze and just break after that. A restart of the stream (by restarting the docker container) fixed it. Sometimes for an hour, sometimes for 14 hours (that's weirdly specific, I know). As a (low-code) developer, these are the bugs I hate the most: it isn't reproducible on demand and doesn't leave a smoking gun in the logs.

I noticed it first. Spent an evening reading FFmpeg logs trying to find a pattern. Then a viewer messaged. They were the ones who confirmed it wasn't just my connection or my browser. Something was actually wrong with the stream itself.

A few evenings of digging later, I found it.

The FFmpeg concat demuxer expects its playlist in this format:

```
ffconcat version 1.0
file '/music/clean/Track Name.mp3'
file '/music/clean/Another Track.mp3'
```

Single-quoted strings. Which means a track called `Siren's Call.mp3` becomes:

```
file '/music/clean/Siren's Call.mp3'
```

The parser sees the quoted string as ending after `Siren`, followed by garbage. FFmpeg either silently skipped the file, hung trying to probe it, or, just quit quietly. From a viewer's perspective: random stream stalls.

The fix is to escape apostrophes when writing the playlist. The concat demuxer accepts the shell-style `'\''` escape inside a single-quoted string:

```bash
while read f; do
  escaped="${f//\'/\'\\\'\'}"
  echo "file '$escaped'" >> /music/playlist.txt
done < /tmp/shuffled.txt
```

Once the playlist generation was fixed, the stalls stopped. About 12 of the 400 tracks had apostrophes in their names. That was enough.

In hindsight I should've known apostrophes would come back to bite me in the ass once again (I failed my mandatory Java class way back  in school on a simple syntax error). Suno generates poetic-sounding track names; about 3% of them had apostrophes; the concat demuxer doesn't tell you when its parser errors. Three small things lined up just right to take a few evenings of my life.

## The visibility problem

Self-hosting trades a hosted service's status dashboard for no dashboard at all. Checking on the stream meant SSHing into the NAS and grepping through Docker logs, or just opening YouTube and looking. Neither of those answers the actual questions:

- Is the container alive?
- Is FFmpeg inside it actually running, or silently wedged?
- How long has the current session been up?
- What track is playing right now?
- Where are we in the playlist?
- Is anything in the logs worth caring about?

So I built a small dashboard. Read-only, LAN-only. Lives in a separate container on the same NAS. The whole point is that I can check on it from my phone.

## The monitor

`lofrq-monitor` is the second container. It has strict read-only access to three things:

1. The Docker socket (mounted read-only) for container status and uptime
2. The `/music/` directory for the playlist file and the FFmpeg log
3. The MP3 files themselves, for duration metadata

The stack is FastAPI for the backend, React with Vite and Tailwind for the frontend, served from a single multi-stage container on port 5011. GitHub Actions builds and pushes the image to GHCR on every commit to `main`. Dockhand pulls from GHCR using a PAT. The whole flow is "git push, wait a minute, container restarts with new code.". **very** satisfying.

The interesting bit is the "now playing" panel. FFmpeg doesn't tell you which track it's on. It writes a `time=` progress line every second showing elapsed position in the *combined* output stream, which is just a running total since the session started. To find the current track, the monitor reads `playlist.txt` to get the ordered list, uses `mutagen` to read the duration of each MP3, walks the cumulative durations until it finds the one that contains the current `time=` value, and returns that track name. Accurate to about a second.

The other interesting bit is log rotation. The FFmpeg log grows indefinitely. The watchdog loop in `stream.sh` handles this: when the log goes past 100MB, it captures the last 2000 lines, truncates the file to zero bytes, and appends the captured tail back. FFmpeg keeps writing through all of this because the `>>` redirect uses `O_APPEND`, which always seeks to the current end-of-file before writing. The file descriptor stays valid. The stream doesn't notice.

What the dashboard actually shows:

- Header with a green dot, "LIVE", and uptime
- "Now playing" panel: current track name, track N of 395
- Scrollable playlist with the current track highlighted and auto-scrolled into view
- Live log tail (last 50 lines, with the cosmetic MP3 warnings filtered out)

It's not pretty. It's exactly as much UI as I need.

## The whole thing on one page

```
┌──────────────────────────────────┐
│ Synology NAS (DSM 7)             │
│                                  │
│ ┌──────────────────────────┐     │
│ │ lofrq-stream container   │─────────► YouTube Live (RTMP)
│ │ - bash stream.sh         │     │
│ │ - FFmpeg                 │     │
│ │ - watchdog + log rotate  │     │
│ └────┬────────────┬────────┘     │
│      │            │              │
│      │ /music     │ docker.sock  │
│      │ (RW)       │ (RO)         │
│      ▼            ▼              │
│ ┌──────────────────────────┐     │
│ │ lofrq-monitor container  │     │
│ │ - FastAPI + React SPA    │     │
│ │ - reads /music (RO)      │     │
│ │ - reads docker.sock (RO) │     │
│ │ - port 5011              │     │
│ └────────┬─────────────────┘     │
│          │                       │
│          ▼ HTTP on LAN           │
│ ┌──────────────────────────┐     │
│ │ Phone / laptop on LAN    │     │
│ │ "● LIVE | Uptime: 4h 22m"│     │
│ │ "NOW PLAYING: Birdsong"  │     │
│ └──────────────────────────┘     │
└──────────────────────────────────┘
```

Two containers. One pushes RTMP out. The other reads the first one's filesystem and Docker socket and gives me a dashboard. 

## What it cost

Before: $20/month. No visibility. Black box.
After: $0/month. Full visibility. Two containers I can change whenever I want.

Í had the NAS running anyway, 

Worth saying: This wasn't necessarily about the money. Obviously the platform I previously used worked flawlessly, had an easy editor for me to edit my stream on demand, and even had a promote feature (which I doubt did anything for my stream, but still). Saving $20 a month is nice, but it was more about me building something, and spending some time on my, now not so secret anymore, YouTube channel.

The stream is at [LO-FRQ LIVE](https://www.youtube.com/watch?v=qq1tUvmR4DQ). The containers itself aren't in a public repo, but the FFmpeg command and the wrapper logic above are enough to rebuild it.

If you ever find yourself debugging a stream that keeps buffering for no obvious reason: check your filenames for apostrophes. Save yourself a few evenings.
Oh, and this goes without saying, feel free to listen to the music while working, or relaxing, or whatever you do while listening to music!

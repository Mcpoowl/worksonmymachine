---
number: 6
title: I Had a Folder, Not a Backup
dek: My NAS went from hobby machine to household infrastructure. My backup plan was one folder copy. It was not enough.
category: Homelab
kicker: Field report
date: 2026-10-02
readTime: 8
tags:
  - synology
  - docker
  - backup
  - postgres
  - hyper-backup
editorNote: The restore test is on my list. It'll probably stay there.
draft: false
---

My NAS is getting old. It still works fine, no weird noises, no warnings, but it's at the age where I've started looking at it the way you look at a car with 300,000 kilometers on it. It's fine. Until it isn't.

The problem is that it stopped being a hobby machine somewhere along the way. It runs our photo library. It runs the dashboards for the house. It runs a handful of apps I built myself, plus the Git server where all my compose files live. If it dies tomorrow, that's not "oh well, I'll tinker with something else this weekend". That's my household asking me why the photos are gone.

So I wanted a proper backup. Offsite, encrypted, and ideally good enough that I could use it to move everything to a new box when the time comes.

My plan going in was simple. Pretty much everything lives in `/volume1/docker/<containername>`. Copy that folder somewhere offsite, done. Right?

Not quite. I sat down with Claude to sanity check it, and the rest of the evening was mostly me finding out how many of my assumptions were held together by the words "I suppose".

## You can't just copy a database

The first hole: live databases. If you copy the files of a running Postgres or SQLite database, you can end up with a backup that looks perfectly fine and refuses to restore. The fix is to back up a *dump* of the database instead of its raw files.

This one stung a bit, because I've already lost data to exactly this kind of thing. TeslaMate, which logs every drive and charge of my car, runs on Postgres. A while back I did a big Postgres major version upgrade, tried to migrate the data over, missed something, and ended up with a completely clean sheet. All of that drive history, gone. Not a disaster, honestly, more of an "oh. bummer." But a simple dump would have saved it, because a dump is exactly what you're supposed to use to move between Postgres versions.

So now there's a script that runs every night at 3:00, dumps the TeslaMate database, gzips it, keeps 14 days of them, and fails, with an alert, if the dump is suspiciously small. The core of it is one line:

```bash
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
```

The first time I ran it by hand, bash threw this at me:

```
invalid option namemate/backup-teslamate.sh: line 2: set: pipefail
```

Which is not a sentence. Turns out I'd written the script on my Windows machine, so every line ended with an invisible carriage return. Bash read `pipefail\r`, didn't know what that was, and the `\r` also jumped the cursor back to the start of the line, which is why the error message looked like it had been through a blender. One `sed` command to strip the line endings, and it worked (thanks Claude!). Works on my machine, as they say. Just not on the other one.

Immich, for the record, already dumps its own database every night. Good on Immich.

## The volumes I didn't care about

Hole number two: not everything lives in my docker folder. Docker also has named volumes, which it keeps somewhere else entirely, so a copy of `/volume1/docker` doesn't include them.

I ran `docker volume ls`, saw five volumes, and confidently said I didn't really care about any of them.

One of them was called `gamepile-data`. GamePile is another app I built, to give me game recommendations based on my Steam playtime. That volume is its database. I was about to "not care" about my own app's data, which is a bold move from the person who wrote it.

In the end I decided I genuinely don't mind losing it, or the data for Kwijt, my household financing app. Both are easy to fill again. So they're still not in the backup, but now it's a choice instead of an accident. That feels like progress. Small progress.

## The GitHub mirror that never happened

The next idea was to mirror my Gitea server to a private GitHub repo. If the NAS dies, Gitea dies with it, and that's where all my compose files live.

Before you mirror anything, you check your Git history for secrets, because a mirror sends *everything*, including every old commit. I checked. Some of my compose files had keys in them. One app had a whole `.env` file committed, and that one had keys I actually cared about.

So I asked whether I could just leave that `.env` out of the mirror. You can't. A Git mirror copies whole commits, and every old commit still contains the file, even if you delete it today.

Then I asked whether I could just stop committing the `.env`. Also no, because Dockhand, which deploys my stacks, reads the `.env` straight from the repo. Delete it and the next deploy breaks.

Fine, I said, then I just won't mirror that app's repo.

And that's when I remembered I don't have separate repos. I have one repo, `homelab-compose`, with a folder per app. So "don't mirror that one app" meant "don't mirror anything".

So I didn't. After all that, the GitHub mirror is the one thing that didn't get built. That's fine, though: Gitea's own data lives in the docker folder, so the main backup covers it anyway. Encrypted, which matters, because that backup is now the only offsite copy of those secrets. Moving them out of the repo properly is something for future me. Future me has a long list. On that list is maybe also creating separate repos for each compose? Maybe. Someday..

## The actual backup

After all of that, the backup itself was almost boring, which is how it should be. Hyper Backup, Synology's own tool, straight to Google Drive, with client-side encryption, so Google only ever sees scrambled data.

The docker folder is 95 GB, and 69 GB of that is photos. I excluded the raw Postgres folders, since the dumps cover those, and kept everything else, including Immich's thumbnails. I have the space, and regenerating thumbnails for an entire photo library can take forever. It runs daily at 4:00, after the database dumps are done, and keeps around 60 versions.

Versions matter more than I first thought. With everything in one folder, a single bad `rm -rf` takes out photos and apps at the same time. A plain mirror would then very faithfully copy that deletion offsite too. Versioning means I can go back to yesterday instead.

The encryption key is saved in multiple protected places that aren't the NAS. Lose the password and the key, and the backup is just 78 GB of very expensive nothing.

The first run took a few hours and ended up at about 78 GB. Photos and videos are already compressed, so there wasn't much left to squeeze.

## Night one

The next morning I had an email waiting. The TeslaMate dump had failed:

```
permission denied while trying to connect to the Docker daemon socket
```

My first instinct was to put `sudo` in front of the scheduled command. Too simple, it turns out: `sudo` asks for a password, and a scheduled task can't type one. The real problem was that the task ran as my regular user, who isn't allowed to talk to Docker. When I tested it by hand, I used `sudo`, so of course it worked then. Switching the task to run as root fixed it.

Honestly, this was the most reassuring part of the whole thing. The very first night, something broke, and I found out within hours because I'd turned on failure emails. Without them, I'd have found out on the day I actually needed that dump. Which, given my track record with TeslaMate, would have been very on brand. It's almost as if i MEANT for the first try to fail ;).

## Not quite done

Here's the honest status. The backup runs, it's encrypted, it's offsite, and the key is safe. What I haven't done yet is the most important part: an actual test restore.

Until you've restored something, you don't have a backup. You have hope. Right now I have about 78 GB of very well organised hope on Google Drive. Restoring one compose file and one photo is on the list.

The good news is that this doubles as my migration plan. When I get a new NAS (or a NUC, or whatever I convince myself I need), I can stop everything on the old one, copy the docker folder across, start it back up, and keep the old box untouched as a fallback for a few weeks. The offsite backup is for when there's no old box left to copy from.

My NAS isn't a hobby machine anymore. My backup finally isn't a hobby either. Mostly.

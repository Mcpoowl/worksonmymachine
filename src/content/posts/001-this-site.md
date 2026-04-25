---
number: 1
title: This Site Took Four Hours to Build and Two Days to Load
dek: Building a personal blog with Astro and Claude was the easy part. Getting it to resolve on my own network was not.
category: Dev
kicker: Field report
date: 2026-04-26
readTime: 8
tags:
  - astro
  - cloudflare
  - deployment
  - meta
  - dns
editorNote: A site called 'Works on My Machine' worked on every machine except mine..
draft: false
---

I've been wanting a personal site for years. Not a portfolio (I don't need another place to list skills I have in a font no one asked for). Just a place to scribble things down. Notes, rants, field reports from whatever I broke this week and other ramblings I might have.

The brief I gave myself: fast, no CMS to maintain, something new to learn. Text on a screen. RSS feed. Done.

I looked at Hugo, Eleventy, and about four other static site generators before landing on Astro. Astro won because it ships zero JavaScript by default, has a clean content collections API, works with .MD files and the docs don't make me want to close the tab. That's a high bar nowadays.

## The build

I did something I'd been curious about for a while: I built the whole thing in a conversation with Claude. Not vibe-coding in the "just make it work" sense though: I had a proper design handoff, a TODO list, requirements, backlog and a clear sense of what I wanted. Claude handled implementation. I handled decisions. And frustrations, but we'll get to that..

This is worth writing about separately, and I will. The short version: it went surprisingly well, and the parts that didn't? At least interesting. The longer version involves a font file path that was wrong, a progress bar that filled backwards, and a thirty-minute detour into Shiki dual-theme syntax highlighting that I absolutely did not see coming. Hell, those are words I didn't even know before today.

The stack ended up as:

- **Astro** — static site generator, file-based routing
- **Newsreader** — the serif. Variable font, optical sizing, the works
- **IBM Plex Mono** — for everything that needs to look like it came out of a terminal
- **Pure CSS** — no Tailwind, no utility framework. I know, I know
- **Cloudflare Pages (Workers)** — deployment, which we'll get to

Total build time: about four hours of active work across two sessions. The design was already specced out including a complete handoff document with tokens, component specs, the whole thing. Having that made the difference between "Claude writes what it thinks a blog looks like" and "Claude builds what I actually want." The results? You're reading it right now. Not gonna lie, I was pretty impressed considering all the vibe-coded SaaS sites I've seen pop up the last few months. THEY. ALL. LOOK. THE. SAME.

## The domain

Anyway.. Bought `worksonmymachine.io` on Namecheap. The `.io` tax is real (it's not cheap) but `.dev` felt too on-the-nose,`.com` was gone years ago to someone who has never used it and `.tech` was just.. 'meh'

Namecheap's UI is fine. I've used it for years. The process of moving DNS to Cloudflare was new for me, but couldn't have been easier: go get Cloudflare's nameservers, paste them into Namecheap, wait. Cloudflare sends you a very cheerful email when it's done. The email arrived. I moved on.

Or so I thought.

## The deployment

Cloudflare Pages was also new. Claude recommended it; I wanted to learn something new, didn't want to maintain a CMS, and definitely didn't want WordPress. But how do you then manage articles and updates? Well, apparently with Astro, .md files (which gave me a reason to try out Obsidian!) and Cloudflare Pages linked to a GitHub repo that builds the entire thing when it sees a new commit. What?! That sounded great, and I knew Cloudflare from all the DDOS protection things you see all the time, so it would probably be easy, right? 

Linking GitHub was peanuts. Then I needed an output directory apparently, which was nowhere to be found in the configuration. Learned that Cloudflare Pages now uses Wrangler, so I needed a .toml file. This is fine in principle. In practice, it meant I spent thirty minutes figuring out that `npx wrangler deploy` is the wrong command for a Pages project (you want `wrangler pages deploy`), and then another twenty figuring out that actually, with the new Workers Assets model, `wrangler deploy` *is* correct if your `wrangler.toml` has an `[assets]` block. "Le sigh".

The build logs were patient with me about this. More patient than I deserved.

The first deploy succeeded. The build logs said "Complete!" in green. I felt good about myself. Then I tried to open the site and got a blank page with a DNS error. But the dev site worked, even on Cloudflare.

## The DNS

Here's what happened, roughly:

The domain was on Cloudflare's nameservers. The Cloudflare zone was active: I had the email, I could see the green checkmark, the whole thing. The DNS record for `worksonmymachine.io` was a Worker-type record pointing at the right worker. Everything, as far as Cloudflare was concerned, was correct.

My browser didn't think so.

I tried Chrome. I tried Firefox. I tried Edge. Incognito, cleared caches: "Server not found." "DNS address could not be found." Variations on the theme of: this does not exist.

Then I ran `nslookup worksonmymachine.io 1.1.1.1` (explicitly using Cloudflare's own DNS resolver). It resolved immediately. Four addresses, all Cloudflare IPs.

Then I ran `Test-NetConnection worksonmymachine.io -Port 443`. Name resolution failed.

The gap between those two results is the whole story: Cloudflare's own resolver (1.1.1.1) knew about the domain. My ISP's resolver didn't. The nameserver change had propagated to Cloudflare's infrastructure but hadn't made it to whatever DNS server my router was handed by my ISP that morning.

There is no fix for this. You wait. The TTLs expire. The resolvers catch up. It takes a few hours, sometimes overnight.

The site called "Works on My Machine" did, in fact, not work on my machine. The irony is not lost on me..

Claude told me to wait. Made sure it was just a waiting game, waiting for my resolvers to catch up. I believed, but something gnawed at me. It was a long night, I was done, so said good night.

## The morning after

It should load the next day. Of course it didn't. Same as the night before. Same error messages, same blank pages. Cloudflare still showing me everything in the green, but nothing.

I felt actual dread. Spent 10 minutes with my hands over my face, trying to figure out what to do next. Then it dawned on me. I use AdGuard as a DNS server on my home network. Could it have a high cache time?

Opened AdGuard, went to `Settings --> DNS Settings --> DNS cache configuration` and pressed `Clear Cache`. Reloaded `worksonmymachine.io`. Everything worked. One button click could've saved me an entire evening of trying, pulling the little hair I still have left out of my head and feeling frustrated.

In the end, the font rendered exactly right. The dark mode toggle worked. The reading bar on articles fills correctly as you scroll down, which I'm embarrassingly pleased about given that I spent part of an afternoon fixing it running *backwards*. The now card shows what I'm actually working on. The about page has the real bio.

It's a small site. One post (this one), a /now card, an about page, and a lot of CSS I'm proud of. It works. It works on your machine too, assuming your ISP's DNS has caught up.

---

The whole thing: design, build, deploy, the DNS drama, it took the better part of a week of evenings. I've shipped worse things faster and felt worse about them. This one? This one I like <3.

More soon. If I don't break anything in the meantime.

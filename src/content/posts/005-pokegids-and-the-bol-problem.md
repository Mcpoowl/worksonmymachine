---
number: 5
title: "How a Banned IP Turned Into a Second Website"
dek: I built a private tool to track Pokémon TCG restocks. Then it got me banned from bol.com.
category: Dev
kicker: Field report
date: 2026-07-12
readTime: 9
tags:
  - astro
  - cloudflare
  - pokemon
  - side-project
  - ban
  - scraper
editorNote: "an IP ban later, but zero regrets!"
draft: false
---

I just started my Pokémon TCG collection journey (yes, I'm late, I know). I'm in for the fun of it, and for the nostalgia; I'm not chasing grails, I mostly just like opening packs and the possible dopamine hit

The problem with getting into it now is that everything sells out in minutes and half the resellers seem to have a script running before you've even seen the restock email, buy it all up, and resell it for crazy prices. So a while back I built myself a private tool, pokeping, that watches a handful of  shops, groups the listings into actual products, works out whether a price is a genuinely good buy against MSRP, and pings me on Telegram when something worth having shows up. Not the fastest, but still, a one-stop-shop, instead of me having to go through 20 bookmarks, and still not finding anything.

It worked. Then it got me banned from bol.com. Whoops.

## The ban

bol.com is the big one here, the Amazon-equivalent for the Netherlands and Belgium, and it sits behind Akamai's bot protection. pokeping scraped it like any other shop: a headed browser, periodic checks. Too eager, apparently, because at some point bol flagged my home IP and blocked it with an "abuse from this IP address" message. 

That's annoying for two reasons. One, these bans can go from temporary to permanent if you push your luck. Two, I actually buy from bol myself, a lot, so losing access isn't just "the scraper stops working", it's "I can't order anything anymore."

I dialled the crawler back: a 30-minute interval instead of constant polling, slower pacing, and an auto-stop that disables the bol crawl the moment it sees a ban coming. bol scraping went from always-on to opt-in, off by default.

That helped, but it didn't solve the actual problem. Scraping bol from a home IP is risky no matter how careful you are about it. You're not negotiating with the site, you're gambling against Akamai, and the house always wins eventually. And obviously, this is not how you want to solve this from a dev perspective anyway, ideally.

So I disabled the bol.com scraper, access was restored (thankfully the ban was temporary), and got back to the drawing board.

## Going legit instead

So instead of getting better at scraping, I went the other way: I built pokegids.nl, a public Pokémon TCG content site. Buying guides, honest reviews, a release calendar. In Dutch, aimed at people newer to the hobby than the collectors who've been at it for years.

It's not a side hustle bolted onto the restock tool (*yet*). It's a completely seperate 'tool', that has me really excited to be honest, but hopefully, it will help me with pokeping as well (and later any potential readers as well). bol has an official Marketing Catalog API for sites that legitimately drive them customers, affiliate and content sites exactly like this one. Build something real, get approved, and the API replaces the scraper entirely. No more banned IPs, because there's nothing left scraping.

So the shape of the whole thing is: content site earns a bit through affiliate links and helps people who'd otherwise be as lost as I was, that qualifies me for the API, and the API is what should eventually feed both the public site and my own private tool. Three pieces, each one covering for a weakness in the last.

It's a bit of a chicken and egg story: To build the tool you need API access, but to get API access you need a tool (or atleast show bol you have an 'affliate' interest). So right now pokegids is running on content and hope, not on the mechanism it was actually built to plug into. That's fine for now. And either way, even if bol would still deny the API access, i'll still keep writing content probably as I'll still continue my hobby anyway)

## Building it

The site itself came together fast, another Astro build. Markdown in git, typed content collections, no CMS. Same instinct as this blog: I don't want to run a database for a hobby project.

A few things went sideways, in the way these things always do:

The first Cloudflare deploy failed outright because Astro 7 wants Node 22.12 or newer and I had it pinned at 20. Bumped it to 22.19.0, deploy went through. Site got shown as unsafe, forgot to always serve HTTPS, and other small hiccups that made the first deploy took longer than expected

I also planned this one a bit more compared to other project (as this blog for example). Complete spec written, design session, ready to pick up and continue whenever, as opposed to having built everything in one session.

I'm pretty stoked about the look too, it's colourful, playful and I genuinely hope it'll help people in the end, but I guess that's up to me and my writing skills.

## Same person, two completely different rooms

pokeping and pokegids don't share a look, on purpose. pokeping is dark, dense, an instrument panel, because it's for me and only me. pokegids is warm cobalt and marigold, rounded display type, more poster than dashboard, because it's for someone who's never heard of a restock monitor and shouldn't need to.

They'll probably link to each other eventually in some way or form. I really want to help people like me grab stock for a normal price instead of having to pay scalper prices without having to resort to sketchy paid tools, that'll probably don't even work half of the time, even it that means I'd lose my 'competitive edge'.

Two sites now, doing two different jobs, built two days apart, held together by one dumb IP ban. I'll take it. We live and we learn.. Thank bol for unflagging my IP address. It won't happen again. <3

Oh, and the site, should you be interested, is [Pokegids.nl](https://www.pokegids.nl). It's in Dutch, but feel free to browse around!

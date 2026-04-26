---
number: 2
title: The Inverter is Off. Probably.
dek: My SolarEdge inverter is supposed to shut itself off when electricity prices go negative. Let's check if it actually does.
category: Home Assistant
kicker: Field report
date: 2026-04-26
readTime: 10
tags:
  - home-assistant
  - solaredge
  - energy
  - solar
  - NRO
editorNote: A simple idea that turned into a multi-hour conversation with myself.
draft: false
---

Dynamic energy pricing in the Netherlands is a thing. Zonneplan, which is my 'energy supplier' recalculates the kWh price every hour based on the wholesale market. Most of the time it's fine. Some hours it's almost free. And then there are the negative hours.

Negative tariffs happen when there's too much electricity on the grid and not enough demand. Spring and summer afternoons, usually: half the country's solar panels are producing flat out, nobody's home and the grid has nowhere to put it. The market price goes below zero and you, the prosumer with your own panels, get charged for what you export.

So you don't want to export. Ideally you don't want to *produce* either, because the grid only sees your meter. What you actually want to do is *import*. Charge the EV, run the dishwasher, do laundry, run the dryer, heat up some water, anything that pulls power off the grid instead of pushing it back. Negative prices mean the grid is paying *you* to take electricity off its hands. Might as well take them up on it.

SolarEdge has a feature for this: Negative Tariff Optimization. Setup is straightforward. Enable it in the app, pick your mode (mine is "Dynamic 60 minutes"), tell it your supplier's costs and VAT so the inverter knows what "negative" means for you specifically. SolarEdge isn't pulling prices from anywhere. It's using the wholesale market data plus what you told it to figure out when producing would put you in the red. Once that's set, it shuts itself off.

Except I don't trust set-and-forget. I trust *set, then build a notification to verify it actually does the thing*.

## What I wanted

A push notification on my phone that says one of two things:

> "Tariff is negative. Inverter is off. Good."

> "Tariff is negative. Inverter is still producing. Not good."

And the same in reverse when the price climbs back. That's it. No clever logic. No Home Assistant trying to flip switches. Just: did SolarEdge actually do what it promised?

Sounds simple enough, right? I knew what I wanted, just no clue where I should start.

## Slight sidestep

I'm using the SolarEdge cloud integration in Home Assistant, not the Modbus TCP one. The Modbus integration talks to the inverter directly over LAN and updates in near real-time. I don't have it set up. I just set up the Cloud version with my API key and it worked, and never looked back.
The cloud integration polls SolarEdge's servers roughly every 15 minutes and gives me a handful of sensors. The one that matters here is `sensor.solaredge_current_power`, which reports how much the inverter is producing in watts. There is no sensor that says "inverter is on" or "inverter is off." There's just power.

Which would be fine except `current_power` is zero for tons of reasons. It's zero at night. Zero at 4:30pm in winter. Near zero under a heavy cloud bank even when the inverter is healthy. So "power is zero" is not the same as "the inverter shut down for tariff reasons." 
## Trigger on the cause, verify with the effect

My first instinct was to use `current_power` with some added filters. Maybe use a sun constraint to rule out the notification triggering in the night. This still wasn't as fool-proof as I hoped. And it doesn't really matter to me if the inverter is on, if the tariffs aren't negative. My real goal was to know if the inverter was turned off when _my tariffs are negative_. That's a whole different look at it.

So power isn't the trigger. Power is the verification. The trigger is the tariff. When the Zonneplan tariff transitions to negative, that's the event. After a short wait, check whether the inverter has actually shut down. Notify either way. Same thing in reverse when the price climbs back. Two automations, mirror images of each other, each doing one job.

## The lag math, and what I had wrong

Question I asked before building anything: how long is the window where I can't actually see what's happening?

I asked Claude to walk me through the timeline and got back something like "T+5 to detect the tariff change, T+25 once the SolarEdge poll catches up, total 25-ish minutes of uncertainty." Twenty-five minutes felt too long. Asked: Why five minutes to detect the tariff change? We have the prices already. They're published hours in advance, sitting right there in the `forecast` attribute of the Zonneplan integration in Home Assistant.

That's where it all came together.

Zonneplan tariffs for tomorrow are public from today at, roughly, 4pm. There's no 'detection lag' for the tariff itself, because there's nothing to detect. It's the same as just checking the calendar, basically.

I checked the actual sensor behavior. `sensor.zonneplan_current_electricity_tariff` updates its value at the hour boundary, give or take a few milliseconds(well, 1 millisecond to be exact). So a `numeric_state` trigger on that sensor fires basically instantly when the new hour rolls over. That's a whole different number compared to the 5 minutes Claude gave me..

The corrected timeline is simpler:

- T+0: hour boundary, sensor state changes, automation triggers
- T+0 to T+20: I wait, because SolarEdge hasn't polled yet
- T+20: check power, send notification

Twenty minutes, not twenty-five. And those twenty minutes are entirely the SolarEdge cloud poll cycle, not anything Home Assistant could do better. If I wanted to shrink that, I'd have to switch SolarEdge to local Modbus polling, which would get me sub-second updates over the LAN. Different evening, different post (and probably different kind of frustrations).

A small happy little accident: `numeric_state` triggers in Home Assistant fire on the *crossing*, not on every state update where the condition is true. A trigger configured for `below: -0.01` fires once when the price drops from positive to negative. It does not fire again at the next hour even if the price goes from -0.05 to -0.08. Both values are below the threshold, but no crossing happened. Which is exactly what I want here: three consecutive negative hours produce one notification, not three. Slightly messed up if you think of it as "is the value currently below the threshold," because that's not what it does. It checks "did the value just become below the threshold." 

## What got shipped

Two automations. One for shutdown verification, one for restart. Both require the sun constraint as well. No notifications at 22:00 in November.

Trigger on the tariff crossing. Wait 20 minutes for the SolarEdge cloud to catch up. Check power. If it matches expectation (low when tariff is negative, producing when tariff is positive), send a friendly confirmation. If it doesn't, send an alert with the actual values so I know what I'm looking at.

Thresholds are 50 W instead of exactly zero, because comparing to zero on a real sensor is iffy imo. Above 50 W during daylight means the inverter is on. Below 50 W means it isn't producing meaningfully.

The cool thing is, I didn't have to build this automation (or rather _notification_) myself. I described the use case to Claude, and Claude wrote the them straight into my Home assistant via 
 [ha-mcp](https://github.com/homeassistant-ai/ha-mcp), an MCP server that gives Claude direct access to the Home Assistant API. No copy-paste through the UI, no editing files, no restart cycle. Description in, working automation out. That part deserves a post of its own and will get one, because it changes how I tinker with Home Assistant more than I expected. The YAML below isn't pseudocode; it's roughly what landed in my config.

```yaml
trigger:
  - platform: numeric_state
    entity_id: sensor.zonneplan_current_electricity_tariff
    below: -0.01
condition:
  - condition: numeric_state
    entity_id: sun.sun
    attribute: elevation
    above: 10
action:
  - delay: { minutes: 20 }
  - choose:
      - conditions:
          - condition: numeric_state
            entity_id: sensor.solaredge_current_power
            below: 50
        sequence: [ notify "good, it shut down" ]
      - conditions:
          - condition: numeric_state
            entity_id: sensor.solaredge_current_power
            above: 50
        sequence: [ notify "warning, it didn't shut down" ]
```

## What this doesn't catch

Plenty.

If the inverter shuts down correctly at 13:00 but somehow turns itself back on at 13:30, in the middle of the same negative-tariff window, I won't know about it. The automation only checks once, at T+20. 

It also doesn't catch hardware faults during positive-tariff hours. If the inverter dies at noon on a sunny day with electricity at €0.30/kWh, this automation has nothing to say about it. That's a different automation: a generic "inverter healthy during daylight" check. Also not built yet. Don't really care at this point either.

---

Now we play the waiting game. The next negative-price hour will tell me whether the success path fires correctly, and at some point a failure (a SolarEdge hiccup, a Zonneplan integration glitch, a cloud poll that drops on the floor, or my Home Assistant randomly deciding to switch off) will tell me if it works as intended. At one of my projects at work we had a saying: "Real men test in Production". Guess what we're doing?

//edit: I was anxiously waiting. I deployed the notification in a window where the inverter was already turned off (and manually checked), and the tariff would switch back to positive at around 4pm. So technically I should receive a notification at around 4:20pm (heh). And lo' and behold a notification arrived exactly at 4:20pm saying the inverter was back on, with the tariff _and_ the wattage my solar panels were producing at that moment. I double checked SolarEdge to be sure and everything worked as intended. The next, full, test is when the "The inverter has been turned off" notification would also be sent, but no negative prices anymore today, or tomorrow apparently. For now: SUCCESS!

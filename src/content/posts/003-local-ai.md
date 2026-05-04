---
number: 3
title: My boss is paying for my smart home
dek: I wanted AI connected to Home assistant without spending precious company resources.
category: Home Assistant
kicker: Field report
date: 2026-05-04
readTime: 10
tags:
  - home-assistant
  - mcp
  - ollama
  - lm-studio
editorNote: Qwen still doesn't know what a dashboard is. I'm working on it..
draft: false
---
I have a Claude subscription at work. It's great. I use it almost every day. It's also paid by my employer, so having Claude update my Home Assistant dashboards isn't really part of the budget. 

There had to be a different way. Local AI, connected to Home Assistant via ha-mcp (https://github.com/homeassistant-ai/ha-mcp). All the individual tools were there. Now to connect it all, shouldn't be that difficult.

## The first attempt

My first attempt (after consulting) was running a local model via ollama and Open WebUI. Getting ollama and open-webui running was easy. Ollama was installed on my desktop PC (Windows) and as a test I just ran open-webui via Docker Desktop. I downloaded a model (Qwen2.5:14b was suggested to me) and I was able to start a chat ánd get answers. Pretty much halfway there I'd guess. Guess again.

For some reason, getting ha-mcp working was the real problem. Despite it comes with a very convenient installation guide, I didn't manage to get it working. It connected fine when setting it up, but Qwen wasn't actually calling the tools it seemed. I just got the same responses over and over again. 

> I don't have direct access to your system or the specific data you're working with, so I won't be able to execute a function like `ha_config_get_dashboard` and directly provide the raw JSON response.

I spent a few evenings messing with settings, getting mcpo running, trying different configurations in Docker Desktop, switching between OpenAPI and HTTP Streamable in open-webui: nothing worked. I no longer remember everything I tried to get it to work. It didn't in the end, so it doesn't really matter anyways. At some point I put it down and tried something else.

## LM Studio

After a couple of days (10 to be exact according to Docker Desktop) I tried again, but came across LM Studio to run the models. I tried it since it was a no-nonsense download instead of messing with docker-compose files, which is a nice change of pace in itself. The only thing I had to do was grab a model (Qwen3.5-9b was my choice here) and setup the MCP server itself. Since I still had that docker container running, it was a matter of pressing the big Play button in Docker Desktop. Configuring the MCP server in LM Studio was easy as well. It uses the same config as stated in the ha-mcp Github, which I already used when I tested it with Claude. Restarted, started a new chat and asked:

> Can you see my home assistant?

Took a total of 8 seconds (3 seconds to analyse my prompt and 5 seconds to call the right tool), but it returned with a complete overview of my home assistant instance. It just worked.


There's a slight difference in how it feels compared to a cloud model. When you send a message, there's a visible "PROCESSING PROMPT" phase before it starts responding. The model is actually loading and processing your context locally, and you can see it happening. It's not too bad. Just slow compared to the 'instant response' you're used to from Claude or good old 'Chatty'. That's normal I guess. It still uses a lot of compute. I have a pretty beefy GPU from NVIDIA, so thankfully can use CUDA to do some GPU offloading, which probably helps?

## The context window problem

Then I saw it. It saw my Home Assistant. My single question also used 28% of the context window. 28% in a single sentence. The model has a context size of 262.144 tokens. On paper that sounds like a lot. In practice, if a single "hello, what can you see?" costs 73.000 tokens, it adds up.

Simple commands don't hit the context as hard as broad queries, so it's not terrible in practice. But it's something you think about. And the larger the context gets, the slower and more mistakes the model makes.

## The terminology problem

This one caught me off guard more than the context thing.

I asked Qwen to create a new dashboard. It didn't. It added elements to my existing views and messed up my dashboards.

In Home Assistant, "views" and "dashboards" are related but different. I knew what I meant. Qwen didn't. It took the word literally and did something technically correct but not what I asked.

I asked Claude the same thing with the same wording. It understood. Created the right thing in the right place. No confusion.

That's not Qwen's fault: It's what you get when you move to a local model. Cloud models have absorbed years of conversations but also forum posts, documentation, support threads. They have context about what people usually mean. A local model has weights and whatever you tell it. And that means "what you tell it" needs to be a bit more precise than you'd expect.

## Where this leaves me

It works. That's not nothing. A while ago, "local AI that actually controls my house" was something I read about but couldn't set up. Now it's running.

But it's not a Claude replacement. The context fills faster than I'd like for extended sessions, and the model interprets commands literally, so you need to be careful with wording.

For simple, specific queries it works well. "What's the temperature in the bedroom?" is fine. "Set up my evening routine" requires more precision than I want to give.

I'll keep it running. I think it's pretty cool having a local LLM running, even if it's only for routine stuff. Which means I'm still building my Home Assistant dashboards by hand.
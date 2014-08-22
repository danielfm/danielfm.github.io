---
layout: page_bigcover
permalink: /portfolio.html
title: Featured Projects
description:
  visible: true
  text: So, are you interested in my work? Go ahead, take a look!
tags: [daniel, martins, software engineer, globo.com, programming, open source, portfolio, projects]
date: 2014-05-23 00:00
image:
  feature: portfolio.jpg
---

## Globosat Play (2014)

<div class="device-mockup" data-device="imac" data-orientation="portrait" data-color="black">
  <div class="device">
    <div class="screen">
      <a href="http://play.com.br" target="_blank" title="Go to Globosat Play">
        <img src="/images/portfolio/globosat-play.png"/>
      </a>
    </div>
  </div>
</div>

Globosat Play is a "TV Everywhere" VOD service that cable TV subscribers can
use to watch content licensed by [Globosat](http://en.wikipedia.org/wiki/Globosat)
in Brazil - which includes movies, TV shows, documentaries and concerts - at
no extra cost.

### What Did I Do?

I was the lead engineer responsible for creating and deploying the software
platform that's used to organize the VOD content of channels and TV shows.

Apart from the usual technical stuff, that time I had the opportunity to work
more closely with the product owners to help them develop a viable release plan
for the first iterations.

### A Challenge?

In order to be able to meet the agressive deadlines and scale the project across
multiple teams, we decided early on to divide this big product into different
smaller projects, each one with its own infrastructure, and assign a small team
of developers (2-4 developers each) to take care of each project.

By doing this, we wanted to eliminate the possibility of one small faulty deploy
to cause a full blown service outage, and, at the same time, give each team a
chance to develop a sense of ownership.

The problem with this approach though is that those smaller pieces must look and
feel like a _single product_, and the first step toward that goal was to find
a way to share code among the teams, otherwise we would spend much time redoing
the same things over and over again.

We attacked this issue gradually over time by developing a few libraries of
reusable components that went from small server-side helpers (i.e. date
formatters) to a full-featured UX components toolkit a la
[Bootstrap](http://getbootstrap.com).

It wasn't easy to convince the stakeholders this was the way to go, but the
effort eventually paid off.

## Combate Play (2013)

<div class="device-mockup" data-device="imac" data-orientation="portrait" data-color="black">
  <div class="device">
    <div class="screen">
      <a href="http://combate.tv" target="_blank" title="Go to Combate Play">
        <img src="/images/portfolio/combate-tv.png"/>
      </a>
    </div>
  </div>
</div>

Combate is a brazilian TV channel that has the rights to exclusively broadcast
all editions of the UFC - The world's most popular MMA  competition - in
brazilian territory.

With Combate Play, the channel subscribers enjoy instant and unlimited access -
at no extra cost - to a constantly updated collection of duels, and can also
watch the UFC live over the internet via smartphone, tablet or computer.

### What Did I Do?

I was the lead software engineer responsible for the VOD aspect of the project,
and worked in pretty much everything from server configuration, coding, testing,
release planning, and so on.

### A Challenge?

From a systems integration point of view, this was a very challenging project.
The information was scattered through several APIs, some of them agonizingly
slow, which in turn rendered the application nearly unusable in the first
iterations.

The performance problem was solved by combining a flexible caching system that
supports both short and long-lived stale caching as fallback, agressive
timeouts, and asynchronous client-side code to render non vital chunks of
content.

This gave us the ability to use different cache timeouts for different
types of requests. The other benefit is that the system is now much more
resilient against cascading failures.

## Spare Time Hacks

All my hacks are [open source code](https://github.com/danielfm). Check them out
if you want to know what my code looks like.

### mandelbrot

This page's cover picture was generated using
[a simple function](https://gist.github.com/danielfm/0e83487fc4a5dfa6884f) I
wrote in Octave after reading a little bit about
[Fractals](http://en.wikipedia.org/wiki/Fractal), which is a rather fascinating
subject.

The region of the Mandelbrot Set depicted here -- around `.283+.484i` -- is
known as [Quad-Spiral Valley](http://www.nahee.com/Derbyshire/manguide.html). To
generate the picture yourself:

{% highlight matlab %}
% Quad-Spiral Valley (scale: 1/400, iterations: 512)
M = mandelbrot (0.283+0.484i, 400, 512, 1280, 800);
imwrite (M, bone (512), 'output.png');
{% endhighlight %}

### photo-mosaic

Although the input and target images can be customized, the goal of this hack
was to paint [Mona Lisa](http://en.wikipedia.org/wiki/Mona_Lisa) using a corpus
of 3,588 images of Pablo Picasso's paintings and drawings as pixels in the
target image.

The resulting file, a 13,960x20,800 JPEG image, can be downloaded from the
project's repository as a 7zip archive.

Link: <https://github.com/danielfm/photo-mosaic>

#### Why is it cool?

In order to build that mosaic efficiently, I coded a minimal
[k-d tree](http://en.wikipedia.org/wiki/K-d_tree) implementation to help me
with the task of finding the input image whose average RGB color is the closest
of a given pixel in the target image.

The code also had to be tweaked so it could run in parallel. Fortunately,
this was easy to do thanks to Clojure's built-in concurrency features like
`pmap` and [reducers](http://clojure.com/blog/2012/05/15/anatomy-of-reducer.html).

### bencode

This is a Clojure implementation of Bencode, the encoding format used by
[BitTorrent](http://en.wikipedia.org/wiki/BitTorrent) for storing and
transmitting loosely structured data between trackers and peers.

Link: <https://github.com/danielfm/bencode>

#### Why is it cool?

The fun started by implementing the code that translates between bencode
strings and Clojure's native data structures.

With this done, I started reading the
[metainfo file spec](http://www.bittorrent.org/beps/bep_0003.html) and
thought it would be interesting to build a tool to create _.torrent_ files,
just because.

BitTorrent metainfo files are expensive to compute due to the constant piece
splitting and hashing, so in order come up with an efficient implementation,
I replaced the poorly parallelized Clojure code with a pure Java implementation
based on thread pools.

The result was a fast implementation that can process very large files at
roughly the same speed as [mktorrent](http://mktorrent.sourceforge.net)'s,
which is implemented in pure C.

*[UFC]: Ultimate Fighting Championship
*[MMA]: Mixed Martial Arts
*[VOD]: Video On Demand

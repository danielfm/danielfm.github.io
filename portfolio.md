---
layout: page_bigcover
permalink: /portfolio.html
title: Featured Projects
description:
  visible: true
  text: Some highlighted projects I’ve worked on during my carreer as a software engineer, as well as some fun side projects.
tags: [daniel, martins, software engineer, globo.com, programming, open source, portfolio, projects]
date: 2014-05-23 00:00
image:
  feature: portfolio.jpg
---

## Index of Contents

- [Professional Projects](#professional-projects)
  - [Globosat Play](#globosat-play)
  - [Combate Play](#combate-play)
- [Spare Time Hacks](#spare-time-hacks)
  - [spotify.el](#spotifyel)
  - [mandelbrot](#mandelbrot)
  - [photo-mosaic](#photo-mosaic)
  - [bencode](#bencode)
- [Open Source Contributions](#open-source-contributions)

## Professional Projects

### Globosat Play

<div class="device-mockup" data-device="imac" data-orientation="portrait" data-color="black">
  <div class="device">
    <div class="screen">
      <a href="http://play.com.br" target="_blank" title="Go to Globosat Play">
        <img src="/images/portfolio/globosat-play.png"/>
      </a>
    </div>
  </div>
</div>

**2014 -** Globosat Play is a "TV Everywhere" VOD service that cable TV subscribers can
use to watch content licensed by [Globosat](http://en.wikipedia.org/wiki/Globosat)
in Brazil - which includes movies, TV shows, documentaries and concerts - at
no extra cost.

#### What Did I Do?

I was the lead engineer responsible for creating and deploying the software
platform that's used to organize the VOD content of channels and TV shows.

Apart from the usual technical stuff, that time I had the opportunity to work
more closely with the product owners to help them develop a viable release plan
for the first iterations.

#### A Challenge?

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

### Combate Play

<div class="device-mockup" data-device="imac" data-orientation="portrait" data-color="black">
  <div class="device">
    <div class="screen">
      <a href="http://combate.tv" target="_blank" title="Go to Combate Play">
        <img src="/images/portfolio/combate-tv.png"/>
      </a>
    </div>
  </div>
</div>

**2013 -** Combate is a brazilian TV channel that has the rights to exclusively broadcast
all editions of the UFC - The world's most popular MMA  competition - in
brazilian territory.

With Combate Play, the channel subscribers enjoy instant and unlimited access -
at no extra cost - to a constantly updated collection of duels, and can also
watch the UFC live over the internet via smartphone, tablet or computer.

#### What Did I Do?

I was the lead software engineer responsible for the VOD aspect of the project,
and worked in pretty much everything from server configuration, coding, testing,
release planning, and so on.

#### A Challenge?

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
if you want to see what my code looks like.

### spotify.el

<div class="device-mockup" data-device="imac" data-orientation="portrait" data-color="black">
  <div class="device">
    <div class="screen">
      <a href="http://combate.tv" target="_blank" title="Go to Combate Play">
        <img src="https://github.com/danielfm/spotify.el/raw/master/img/playlist-tracks.png"/>
      </a>
    </div>
  </div>
</div>

As a somewhat heavy [Emacs](https://www.gnu.org/software/emacs/) user, I like
the idea of not having to leave my favorite text editor when I need to do things
like accessing the
[IRC](https://www.gnu.org/software/emacs/manual/html_mono/erc.html),
[interacting with git](https://magit.vc/), and things like that. One of the
things I missed the most was the ability to control the Spotify client
application from within Emacs, so I created spotify.el.

With spotify.el, I can browse my playlists, list their tracks, show tracks
from some given artist or album, as well as control the Spotify player
(play, pause, go to the next track, toggle repeat, etc), all without leaving
my text editor.

Link: <https://github.com/danielfm/spotify.el>

#### Why is it cool?

It's really nice to have everything just a few key strokes away; this is why
I love Emacs so much.

One thing I particularly liked was how smooth the whole process of creating
this extension was. You can write code and have it evaluated right away right
there, in the same editor, which makes it really easy to get things done.

### mandelbrot

This page's cover picture was generated using
[a simple function](https://gist.github.com/danielfm/0e83487fc4a5dfa6884f) I
wrote in Octave after reading a little bit about
[Fractals](http://en.wikipedia.org/wiki/Fractal), which is a rather fascinating
subject.

The region of the [Mandelbrot Set](http://en.wikipedia.org/wiki/Mandelbrot_set)
depicted here -- around `.283+.484i` -- is known as the Quad-Spiral Valley.
To generate the picture yourself:

```matlab
% Loads the parallel package (make sure to have it installed first)
pkg load parallel

% Quad-Spiral Valley (scale: 1/400, iterations: 512, workers: 4)
M = mandelbrot (0.283+0.484i, 400, 512, 1280, 800, 4);
imwrite (M, copper (512), 'output.jpg', 'Quality', 100);
```

#### Why is it cool?

Even though Octave doesn't support threads, I've used the
[parallel](http://octave.sourceforge.net/parallel/overview.html) package in
order to compute the pixel intensity values in parallel by dividing the
work into `N` jobs and submitting them to child processes spawned via `fork()`.

### photo-mosaic

<div class="device-mockup" data-device="imac" data-orientation="portrait" data-color="black">
  <div class="device">
    <div class="screen">
      <a href="http://combate.tv" target="_blank" title="Go to Combate Play">
        <img src="https://github.com/danielfm/photo-mosaic/raw/master/img/demo-2.jpg"/>
      </a>
    </div>
  </div>
</div>

Although the input and target images can be customized to produce any image,
the goal of this hack was to paint
[Mona Lisa](http://en.wikipedia.org/wiki/Mona_Lisa) using a corpus of 3,588
images of Pablo Picasso's paintings and drawings as pixels in the target image.

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

## Open Source Contributions

You can see all [merged Pull Requests](https://github.com/pulls?page=1&q=is%3Apr+author%3Adanielfm+archived%3Afalse+is%3Aclosed+is%3Apublic+is%3Amerged)
I've made over the years to other open source projects in
[GitHub](https://github.com) you can see all pull requests I've made over the
years to other open source projects. :tada:

---
layout: post
title: Functional Programming 101 - With Clojure
description:
  visible: true
  text: Help Hercules defeat the Hydra. With functional programming.
date: 2014-01-26 10:00
categories: [clojure, programming]
comments: true
image:
  feature: functional-programming-101.jpg
---

Here goes a simple yet interesting programming problem originally proposed by
[Mattox Beckman](http://www.iit.edu/csl/cs/faculty/beckman_mattox.shtml). After
seeing [Tejas Dinkar](http://blog.gja.in/2014/01/functional-programming-101-with-haskell.html)'s
take on this problem using [Haskell](http://haskell.org), I decided to give it
a go with [Clojure](http://clojure.org).

> You are Hercules, about to fight the dreaded Hydra. The Hydra has 9 heads.
> When a head is chopped off, it spawns 8 more heads. When one of these 8 heads
> is cut off, each one spawns out 7 more heads. Chopping one of these spawns 6
> more heads, and so on until the weakest head of the hydra will not spawn out
> any more heads.
>
> Our job is to figure out how many chops Hercules needs to make in order to
> kill all heads of the Hydra. And no, it's not _n!_.

We can start by defining a function that returns a `n`-headed Hydra.

{% highlight clojure %}
(defn new-hydra
  "Returns a Hydra with n heads."
  [n]
  (repeat n n))

(new-hydra 3)
;; => (3 3 3)
{% endhighlight %}

To make it easy to compare both solutions, the data structure I'm using here
is the same one used by Dinkar: a list. In this list, each number represents
a living head and its level of strength.

Now, according to the problem description, when Hercules chops off a level 3
head, the Hydra grows two level 2 heads.

{% highlight clojure %}
(chop-head (new-hydra 3))
;; => (2 2 3 3)
{% endhighlight %}

Here's one possible implementation for such a function.

{% highlight clojure %}
(defn chop-head
  "Returns a new Hydra after chop off its first head."
  [hydra]
  (let [head (first hydra)]
    (into (rest hydra)
          (new-hydra (dec head)))))
{% endhighlight %}

This code should make sense even if you are not familiar with Clojure.

<blockquote class="pullquote">
What happens if Hercules tries to cut off the head of a headless Hydra?
</blockquote>

Most functional programming languages I know are laid on top of a strong principle
called the [closure property](http://mitpress.mit.edu/sicp/full-text/book/book-Z-H-15.html#%_sec_2.2).

> In general, an operation for combining data objects satisfies the closure
> property if the results of combining things with that operation can
> themselves be combined using the same operation. Closure is the key to power
> in any means of combination because it permits us to create hierarchical
> structures --  structures made up of parts, which themselves are made up of
> parts, and so on.
>
> -- Gerald Jay Sussman, Hal Abelson

To illustrate this concept with code, let's consider Clojure's `cons` function.

{% highlight clojure %}
(cons 1 (cons 2 '()))
;; => (1 2)

(cons 1 (cons 2 (cons 3 nil)))
;; => (1 2 3)
{% endhighlight %}

That means `cons` follows the closure principle. But what about our `chop-head`
function? Does the principle hold?

{% highlight clojure %}
(chop-head (chop-head (chop-head '(2))))
;; => NullPointerException
{% endhighlight %}

Apparently not. To fix that, we need to make sure `dec` is not called with
`nil`, since it's not possible to decrement a null value.

{% highlight clojure %}
(defn chop-head
  "Returns a new Hydra after chop off its first head."
  [hydra]
  (let [head (first hydra)]
    (into (rest hydra)
          (new-hydra (dec (or head 1))))))
{% endhighlight %}

What about now?

{% highlight clojure %}
(chop-head (chop-head (chop-head '(2))))
;; => ()
{% endhighlight %}

## Killing The Hydra

In order for Hecules to kill the Hydra, he needs to repeatedly chop off Hydra's
heads while it still has them.

{% highlight clojure %}
(defn chop-until-dead
  "Repeatedly chops Hydra's heads until no head is left."
  [hydra]
  (take-while #(not (empty? %))
              (iterate #(chop-head %) hydra)))
{% endhighlight %}

The `(iterate f x)` function returns a lazy (infinite) sequence of `x`, `(f x)`,
`(f (f x))`, etc, given that `f` is a function free of side-effects.

{% highlight clojure %}
(take 3 (iterate inc 0))
;; => (0 1 2)
{% endhighlight %}

Since `chop-head` respects the closure principle by always returning a list,
we can use it in `iterate` until we get an empty list, which means the Hydra
is DEAD.

Let's test it on a 3-headed baby Hydra.

{% highlight clojure %}
(chop-until-dead (new-hydra 3))
;; => ((3 3 3) (2 2 3 3) (1 2 3 3) (2 3 3) (1 3 3) (3 3)
;;     (2 2 3) (1 2 3) (2 3) (1 3) (3) (2 2) (1 2) (2) (1))
{% endhighlight %}

How many chops are needed in order to kill the original 9-headed Hydra?

{% highlight clojure %}
(count (chop-until-dead (new-hydra 9)))
;; => 986409
{% endhighlight %}

Another interesting question: what is the maximum number of heads Hercules
fought at once?

{% highlight clojure %}
(apply max
       (map count
            (chop-until-dead (new-hydra 9))))
;; => 37
{% endhighlight %}

Ah. Beautiful.

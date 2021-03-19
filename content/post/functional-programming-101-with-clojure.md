---
title: Functional Programming 101 - With Clojure
author: Daniel Martins
date: 2014-01-26
tags: [clojure, programming, challenge]
aliases:
- /posts/functional-programming-101-with-clojure.html
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

```clojure
(defn new-hydra
  "Returns a Hydra with n heads."
  [n]
  (repeat n n))

(new-hydra 3)
;; => (3 3 3)
```

To make it easy to compare both solutions, the data structure I'm using here
is the same one used by Dinkar: a list. In this list, each number represents
a living head and its level of strength.

Now, according to the problem description, when Hercules chops off a level 3
head, the Hydra grows two level 2 heads.

```clojure
(chop-head (new-hydra 3))
;; => (2 2 3 3)
```

Here's one possible implementation for such a function.

```clojure
(defn chop-head
  "Returns a new Hydra after chop off its first head."
  [hydra]
  (let [head (first hydra)]
    (into (rest hydra)
          (new-hydra (dec head)))))
```

This code should make sense even if you are not familiar with Clojure.


> What happens if Hercules tries to cut off the head of a headless Hydra?

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

```clojure
(cons 1 (cons 2 '()))
;; => (1 2)

(cons 1 (cons 2 (cons 3 nil)))
;; => (1 2 3)
```

That means `cons` follows the closure principle. But what about our `chop-head`
function? Does the principle hold?

```clojure
(chop-head (chop-head (chop-head '(2))))
;; => NullPointerException
```

Apparently not. To fix that, we need to make sure `dec` is not called with
`nil`, since it's not possible to decrement a null value.

```clojure
(defn chop-head
  "Returns a new Hydra after chop off its first head."
  [hydra]
  (let [head (first hydra)]
    (into (rest hydra)
          (new-hydra (dec (or head 1))))))
```

What about now?

```clojure
(chop-head (chop-head (chop-head '(2))))
;; => ()
```

## Killing The Hydra

In order for Hecules to kill the Hydra, he needs to repeatedly chop off Hydra's
heads while it still has them.

```clojure
(defn chop-until-dead
  "Repeatedly chops Hydra's heads until no head is left."
  [hydra]
  (take-while #(not (empty? %))
              (iterate #(chop-head %) hydra)))
```

The `(iterate f x)` function returns a lazy (infinite) sequence of `x`, `(f x)`,
`(f (f x))`, etc, given that `f` is a function free of side-effects.

```clojure
(take 3 (iterate inc 0))
;; => (0 1 2)
```

Since `chop-head` respects the closure principle by always returning a list,
we can use it in `iterate` until we get an empty list, which means the Hydra
is DEAD.

Let's test it on a 3-headed baby Hydra.

```clojure
(chop-until-dead (new-hydra 3))
;; => ((3 3 3) (2 2 3 3) (1 2 3 3) (2 3 3) (1 3 3) (3 3)
;;     (2 2 3) (1 2 3) (2 3) (1 3) (3) (2 2) (1 2) (2) (1))
```

How many chops are needed in order to kill the original 9-headed Hydra?

```clojure
(count (chop-until-dead (new-hydra 9)))
;; => 986409
```

Another interesting question: what is the maximum number of heads Hercules
fought at once?

```clojure
(apply max
       (map count
            (chop-until-dead (new-hydra 9))))
;; => 37
```

Ah. Beautiful.

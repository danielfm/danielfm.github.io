---
layout: post_bigcover
title: Why Are Continuations So Darn Cool?
description:
  visible: true
  text: Meet your programming language's time machine.
categories: 
categories: [programming]
tags: [functional programming, scheme, racket, continuations, call/cc]
comments: true
image:
  feature: continuations/delorean.jpg
---

> Continuations are the least understood of all control-flow constructs. This
> lack of understanding (or awareness) is unfortunate, given that continuations
> permit the programmer to implement powerful language features and algorithms.
>
> -- Matt Might, in [Continuations By Example](http://matt.might.net/articles/programming-with-continuations--exceptions-backtracking-search-threads-generators-coroutines/)

The usual way to control the flow of execution of a computer program is via
procedure calls and returns; a [stack](http://en.wikipedia.org/wiki/Call_stack)
data structure is how high-level programming languages keep track of the point
to which each active subroutine should return control when it finishes
executing.

Unfortunately, you'll need more than that if you intend to write useful
programs to solve real-world problems. That's why most high-level programming
languages also provide other control-flow primitives, like the `goto`
statement, loops, and exception handling.

I'm not saying that implementing a programming language is an easy task, but
putting that aside for a moment, it's like programming languages in general
fight as hard as they can to make the call stack something as hidden and
intangible as possible - something no one but itself are allowed to control.

What would happen if some programming languages, instead of keeping the call
stack inside a 2" solid steel safe, actually gave the programmers the ability
to "capture" them as functions that can be invoked, stored, and passed around
as values?

In this post, I hope to show you what _continuations_ are and how they can be
used in practical situations. So grab [Racket](http://racket-lang.org) and
let's go!

**Update (Jun 20, 2014):**  I've changed some things in this post in response
to some great comments in this
[Reddit discussion](http://www.reddit.com/r/scheme/comments/27gn0j/why_are_continuations_so_darn_cool/) and this
[blog post](http://jecxjo.motd.org/code/blosxom.cgi/coding/explain_continuations)
by jecxjo.

## First Example

**Note:** The following problem is solvable without continuations, but I'd like
to start with something simple enough.

Suppose you are writing code that interfaces with some API over HTTP. Also
suppose this API requires a `SessionId` header to be sent over with the request
in order to avoid
[CSRF](http://en.wikipedia.org/wiki/Cross-site_request_forgery) attacks.

{% highlight racket %}
#lang racket/base

;; Object to keep the session-id across requests
(struct session [id #:mutable])

(define (perform-request! session method params)

  ;; Performs the request
  (define headers  (session-id-headers session))
  (define response (http-request API-URL headers method params))

  ;; Retries the request with the given Session-Id
  ;; if necessary
  (when (request-denied? response)
    (update-session-id! session response)
    (perform-request! session method params))

  (parse-json response))
{% endhighlight %}

When the first request is sent - without the `SessionId` header - the server
responds with an error, i.e. HTTP 409, in which case the procedure updates
`session` with the session id given by the server and retries the request.

The code makes sense, but it's **broken.**

The recursive call is not made in tail position. So, when it happens,
another stack frame is pushed to the call stack and even though the retried
request succeeds, what gets returned to the caller is the response to that
first unauthorized request.

If only we had the chance to **return** that second response right to the caller
instead of having the stack to unwind itself...

{% highlight racket %}
(define (perform-request! session method params)
  ;; ...

  (when (request-denied? response)
    (update-session-id! session response)

    ;; Something like this
    (return (perform-request! ...)))

  (parse-json response))
{% endhighlight %}

### Enter `call/cc`

A continuation can be viewed as the evaluation context surrounding an
expression or, in other words, a **snapshot** of the current control state
of the program.

Here's an example:

{% highlight racket %}
#lang racket/base

;; We'll keep the captured continuation here
(define cc #f)

;; This function returns the value 3 *and* stores the
;; continuation that represents the execution context
;; in which this function was called
(define (val!)
  (call/cc
   (lambda (k)
     (set! cc k)
     3)))

;; Stored continuation for this expression: (+ 1 (* 2 ?))
(+ 1 (* 2 (val!))) ;-> 7

;; Replays the continuation with different arguments
(cc 2) ;->  5, or (+ 1 (* 2 2))
(cc 6) ;-> 13, or (+ 1 (* 2 6))
{% endhighlight %}

It turns out that, if we rename `k` to `return`, this is exactly the thing
we need in order to fix that broken API client example:

{% highlight racket %}
(define (perform-request! session method params)
  (let/cc return ; same as (call/cc (lambda (return) body...))
    ;; ...

    ;; Retries the request and gives the control
    ;; back to the caller if request-denied?
    (when (request-denied? response)
      (update-session-id! session response)
      (return (perform-request! session method params)))

    (parse-json response)))
{% endhighlight %}

Now the function captures the current continuation at the moment the procedure
`perform-request!` is first called. Then, if the server denies a request, we
re-send the request with the given `SessionId` and use that grabbed continuation
to transfer the control back to the caller.

Nice, don't you think? It's like we're freezing time at `let/cc`, doing some
stuff, and then resuming from there.

This is a common use case of continuations. Check out
[this project](https://github.com/danielfm/transmission-rpc-client) if you want
to read the code that inspired this example.

## Generators

[Generators](http://en.wikipedia.org/wiki/Generator_(computer_programming)) can
be viewed as special routines that behave like iterators. If you are familiar
with Python, you've probably seen code like this one:

{% highlight python %}
def iterate(list):
  "Generator function that iterates through list."
  for item in list:
    yield item

# Usage
it = iterate(range(2))

it.next() # -> 0
it.next() # -> 1
it.next() # -> raises StopIteration error
{% endhighlight %}

Do you see any resemblance between this example and the previous one? Although
Python doesn't provide a `call/cc`-like facility in the language, one can argue
that its generators are like a poor man's continuation.

Let's pretend for a moment that Racket didn't have a
[generator library](http://docs.racket-lang.org/reference/Generators.html)
that does exactly this. How could this be implemented Racket using
continuations?

What we need is a function that returns another function which, when called,
yields one item at a time, until the list is exhausted.

{% highlight racket %}
(define (iterate lst)
  (lambda ()
    (let/cc return
      (for-each
       (lambda (item)
         (return item))
       lst))))

;; Usage
(define next (iterate (range 3)))
(next) ;-> 0
(next) ;-> 0
{% endhighlight %}

This code follows the same pattern as the previous ones, but it doesn't seem
to work the way you might expect. The reason should be clear though: `iterate`
returns a lambda that uses the captured continuation to yield the list's first
item.

To make this code work, we need to capture the current continuation from the
inside of `for-each` and store it so it can be used to resume the computation
when `next` is called again.

{% highlight racket %}
(define (iterate lst)

  ;; Defines `state` as being a function that starts the
  ;; iteration via `for-each`
  (define (state return)
    (for-each
     (lambda (item)

       ;; Here, we capture the continuation that represents the
       ;; current state of the iteration
       (let/cc item-cc

         ;; Before the item is yielded, we update `state` to
         ;; `item-cc` so the computation is resumed the next
         ;; time the generator is called
         (set! state item-cc)

         ;; Yields the current item to the caller
         (return item)))
     lst)

    ;; Yields 'done when the list is exhausted
    (return 'done))

  ;; Returns a function that calls the stored `state` with the
  ;; current continuation so we can yield one item at a time
  (define (generator)
    (call/cc state))
  generator)

;; Usage
(define next (iterate '(0 1)))

(next) ;-> 0
(next) ;-> 1
(next) ;-> 'done
{% endhighlight %}

If you are having trouble understanding how this code works, the following
diagram might help.

![Diagram](/images/continuations/generator.svg)

## Other Examples

Moving along to more high level stuff, in
[this example](http://docs.racket-lang.org/more/index.html) Matthew Flatt
explains how to build a continuation-based web server in Racket. Still in the
realm of continuation-based-web-something, if you are into Smalltalk, don't
forget to check [Seaside](http://www.seaside.st/), a web application framework
that uses continuations to model multiple independent flows between different
components.

If you don't code Scheme or Smalltalk for a living, don't worry. The chances
are your language does support some flavor of continuations, either natively or
via some third-party library.

## Conclusion

It seems that continuations can be used to implement a wide variety of advanced
control constructs including non-local exits, exception handling, backtracking,
and [coroutines](http://en.wikipedia.org/wiki/Coroutine).

In this post, I hope to have clarified some of the key aspects about
continuations. If you have any suggestion on how to improve this text, please
let me know.

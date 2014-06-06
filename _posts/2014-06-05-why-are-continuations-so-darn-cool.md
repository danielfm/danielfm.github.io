---
layout: post
title: Why Are Continuations So Darn Cool?
description:
  visible: true
  text: Meet your programming language's time machine.
categories: 
categories: [programming]
tags: [functional programming, scheme, racket, continuations, call/cc]
comments: true
image:
  feature: delorean.jpg
---

If you at least spent some time reading about functional programming, there's
a change you might have stumbled upon a funny word, _continuation._

The fact that so few developers even heard about it probably means that it
isn't some fundamental concept in programming languages, right?

Well, I hope to show you it's actually quite the opposite; knowing what this
little beast is - and how to use it - can be a nice addition to your toolbox.
So, fasten your seatbelts, grab
[Racket](http://racket-lang.org/), and let's go!

## A First Example

Suppose you want to write a predicate function that returns whether a given
value is present in some list:

{% highlight scheme %}
#lang racket/base

(define (contains? val lst)
  (if (empty? lst)
    #f
    (if (equal? val (car lst))
      #t
      (contains? val (cdr lst)))))

;; Usage
(contains? 2 '(8 6 9 7 6 8 1 2 3)) ;-> #t
(contains? 5 '(8 6 9 7 6 8 1 2 3)) ;-> #f
{% endhighlight %}

This is a pretty straightfoward procedure that recursively consumes the list
until it's exhausted, or the value is found.

It's also a typical example of a
[tail-recursive](http://en.wikipedia.org/wiki/Tail_call) procedure. For
languages that support tail call optimization, the stack space requirements for
such function are **constant**, whereas a similar implementation in other
languages would require **linear** space.

This procedure is simple enough that you don't have to worry about what's going
on in the stack. However, there are situations where you'd want a finer control
over the stack so it won't bite you in the ass.

### Be Wary of Stack

Now suppose you are writing code that interfaces with some API over HTTP.
Also suppose this API requires a `SessionId` header to be sent over with the
request in order to avoid
[CSRF](http://en.wikipedia.org/wiki/Cross-site_request_forgery) attacks.

{% highlight scheme %}
;; Object to keep the session id across requests
(struct session [id #:mutable])

(define (perform-request! session method params)
  (define headers  (session-id-header session))
  (define response (http-request API-URL headers method params))
  (when (request-denied? response)
    (update-session-id! session response)
    (perform-request! session method params))
  (parse-json response))
{% endhighlight %}

When the first request is sent - without the `SessionId` header - the server
responds with an error, i.e. HTTP 409, in which case the procedure updates
`session` with the session id given by the server and retries the request.

The code looks good, except that it's **broken.**

This procedure is not tail-recursive so, when it's retried, another stack frame
is pushed to the call stack and, even though the second request succeeded, what
gets returned to the caller is the response to that first unauthorized request.

If only we had the chance to return that second response right to the caller
instead of having the stack to unwind itself...

{% highlight scheme %}
(define (perform-request! session method params)
  ;; ...
  (when (request-denied? response)
    (update-session-id! session response)
    (return (perform-request! ...))) ; magic needed here
  (parse-json response))
{% endhighlight %}

### Enter `call/cc`

A continuation can be viewed as the evaluation context surrounding an
expression or, in other words, a **snapshot** of the current control state
of the program.

Here's an example:

{% highlight scheme %}
(define cc #f)

(define (val!)
  (call/cc
   (lambda (k)
     (set! cc k) ; stores the current continuation and returns 3
     3)))

;; stored continuation for this expression is (+ 1 (* 2 ?))
(+ 1 (* 2 (val!))) ;-> 7

;; "replays" the stored continuation with different arguments
(cc 2) ;->  5, or (+ 1 (* 2 2))
(cc 6) ;-> 13, or (+ 1 (* 2 6))
{% endhighlight %}

It turns out that, if we rename `k` to `return`, this is exactly the thing
we need in order to fix that broken API client example:

{% highlight scheme %}
(define (perform-request! session method params)
  (let/cc return ; same as (call/cc (lambda (return) body...))
    (define headers  ...)
    (define response ...)
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

## Continuation-Based Generators

If you are familiar with Python, you've probably seen code like this one:

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

[Generators](http://en.wikipedia.org/wiki/Generator_(computer_programming)) can
be viewed as special routines that behave like iterators.

Do you see any resemblance between this example and the previous one? Although
Python doesn't provide a `call/cc`-like facility in the language, one can argue
that its generators are like a poor man's continuation.

Let's pretend for a moment that Racket didn't have a
[generator library](http://docs.racket-lang.org/reference/Generators.html)
that does exactly this. How could this be implemented with continuations?

{% highlight scheme %}
(define (iterate lst)
  (define (state return)
    (for-each
     (lambda (item)
       (let/cc item-cc
         (set! state item-cc)
         (return item)))
      lst)
     (return 'done))

   (define (generator)
     (call/cc state))
  generator)

;; Usage
(define next (iterate (range 2)))

(next) ;-> 0
(next) ;-> 1
(next) ;-> 'done
{% endhighlight %}

This code is not that hard to follow. The trick is to treat the stack - I mean,
a continuation - like a regular procedure which can be stored, invoked, and
passed around as values.

What's happening is this:

1. When `next` is called the first time, `state` is called with the current
   continuation, which calls `for-each`, which in turn executes that lambda on
   each item in `lst`.
2. For each item, we update `state` with the continuation that is the snapshot
   of that particular moment in the computation, and `return` the current value.
3. The next time `next` is called, the new `state` will be called with the
   current continuation, which will resume the computation and return the next
   item in `lst`. This flow will continue until the every item in `lst` is
   consumed.
4. Finally, when no item is left in `lst`, we `return` the symbol `'done`.

## Other Examples

It seems that continuations can be used to implement a wide variety of advanced
control constructs including non-local exits, exception handling, backtracking
and [coroutines](http://en.wikipedia.org/wiki/Coroutine).

That's not bad for some random unimportant only-theoretical programming
language concept no one will ever need, right? :-)

Now, moving along to more high level stuff, in
[this example](http://docs.racket-lang.org/more/index.html) Matthew Flatt
explains how to build a continuation-based web server in Racket.

Speaking of continuation-based-web-something, if you are into Smalltalk, don't
forget to check [Seaside](http://www.seaside.st/), a web application framework
that uses continuations to model multiple independent flows between different
components.

If you don't code Scheme or Smalltalk for a living, don't worry. The chances
are your language does support some flavor of continuations, either natively or
via some third-party library.

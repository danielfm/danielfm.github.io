---
layout: post
title: A Week Of Docker
description:
  visible: true
  text: Lessons learned after Dockerizing a simple Rails app.
date: 2014-08-11 14:30
categories: [devops]
tags: [docker, ruby, fig, programming, tips, deployment, development, environment]
comments: false
image:
  feature: trying-docker/containers.jpg
---

If you got here, the chances are you heard the fuss around
[Docker](http://docker.com) and how it's supposed to change the way we deploy
applications.

According to the [official website](https://docs.docker.com/), Docker is...

> ...a platform for developers and sysadmins to develop, ship, and run
> applications. Docker lets you quickly assemble applications from components
> and eliminates the friction that can come when shipping code. Docker lets
> you get your code tested and deployed into production as fast as possible.

I'm not here to sell you anything; apparently there are too many people doing
that already. Instead, I'm going to document my experiences trying to
"Dockerize" a simple [Rails](http://rubyonrails.org/) application and show you
some things I learned along the way.

## The Application

I few months ago I built [TeXBin](https://github.com/danielfm/texbin), a
simple Rails application where you can post a `.tex` file and get a URL for its
PDF version. The code was sitting in my laptop without being used, so I thought
it would be nice to use it as a hello world project for Docker.

The proposed stack is composed by three components: the application itself,
a [MongoDB](http://mongodb.org) instance, and a [Nginx](http://nginx.org)
server to both serve the static content and act as a reverse proxy to the
application.

![Architecture](/images/trying-docker/architecture.svg)

Also, to make things simpler, let's assume that I will deploy this stack on a
single server -- although it's possible to link containers living in different
hosts by using
[Ambassador Containers](https://docs.docker.com/articles/ambassador_pattern_linking/).

<blockquote class="pullquote">
WTF is a container?
</blockquote>

Docker is built on top of Linux kernel facilities, like `cgroups` and
`namespaces`, and provides a way to create lightweight workspaces -- or
containers -- that _run processes in isolation_.

> By using containers, resources can be isolated, services restricted, and
> processes provisioned to have a private view of the operating system with
> their own process ID space, file system structure, and network interfaces.
> Multiple containers can share the same kernel, but each container can be
> constrained to only use a defined amount of resources such as CPU, memory and
> I/O.
>
> -- [Wikipedia](http://en.wikipedia.org/wiki/Docker_(software))

So, in short, you get nearly all the benefits of virtualization with barely
none of the overhead that comes with it.

<blockquote class="pullquote">
Why not put everything inside the same container?
</blockquote>

You get several benefits by exposing the different components of your
application as different containers. Just to be clear, by **component** I mean
some service that binds to a TCP port.

In particular, having different containers for different components gives us
freedom to _move the pieces around or add new pieces_ as we see fit, like:

- impose different usage limits (CPU shares and memory limits) for the database,
  the application, and the webserver
- change from a simple MongoDB instance to a
  [replica set](http://docs.mongodb.org/manual/replication/) composed by
  several containers across multiple hosts
- spin up two or more containers of your application so you can perform
  [blue-green deployments](http://martinfowler.com/bliki/BlueGreenDeployment.html),
  improve concurrency and resource usage, etc

In other words: keep the moving parts, well, moving.

## The Dockerfile

Containers are created from images, so first we need to create an image
with the application code and all the required software packages.

Instead of doing things manually, Docker can build images automatically by
reading the instructions from a `Dockerfile`, which is a text file that contains
all the commands you would normally execute manually in order to build a Docker
image.

This is the application's Dockerfile:

{% highlight bash %}
# Base image (https://registry.hub.docker.com/_/ubuntu/)
FROM ubuntu

# Install required packages
RUN apt-get update
RUN apt-get install -y ruby2.0 ruby2.0-dev bundler texlive-full

# Create directory from where the code will run
RUN mkdir -p /texbin/app
WORKDIR /texbin/app

# Make unicorn reachable to other containers
EXPOSE 3000

# Container should behave like a standalone executable
CMD ["start"]
ENTRYPOINT ["foreman"]

# Install the necessary gems
ADD Gemfile /texbin/app/Gemfile
ADD Gemfile.lock /texbin/app/Gemfile.lock
RUN bundle install

# Copy application code to container
ADD . /texbin/app/

# Try not to add steps after the last ADD so we can use the
# Docker build cache more efficiently
{% endhighlight %}

Information about the individual commands can be obtained
[here](https://docs.docker.com/reference/builder/).

### 1<sup>st</sup> Tip: Kiss RVM Goodbye

Why do you need RVM if the application will live inside a controlled and
isolated environment?

The only reason you might want to do that is because you need to install a
particular version of Ruby that you can't find via traditional OS package
managers. If that's the case, go ahead and install the Ruby you want from the
source code.

Using RVM from within a Docker container is not a pleasant experience; every
command must run inside a login shell session and you'll have problems using
`CMD` together with `ENTRYPOINT`.

### 2<sup>nd</sup> Tip: Optimize for the Build Cache

Docker stores intermediate images after successfully executing each command in
the Dockerfile. This is a great feature; if any step fails along the way, you
can fix the problem and the next build will reuse the cache up until that
point.

Some instructions though, like `ADD`, aren't that cache friendly. That's
why it's a good practice to only `ADD` stuff as late as possible as this
invalidates the cache for all following instructions when there's any changes
in the source files or their metadata.

Which leaves us to...

### 3<sup>rd</sup> Tip: Don't Forget the `.dockerignore`

A really important step is to avoid `ADD`ing irrelevant files to the
container, like `README`, `fig.yml`, `.git/`, `logs/`, `tmp/`, and others.

To avoid `ADD`ing files one by one, create a `.dockerignore` file and put there
the patterns you want to ignore. This will help keep the build fast by
decreasing the chance of cache busting.

## Testing the Images

First, we'll need a container that exposes a single MongoDB server:

{% highlight bash %}
$ docker run --name texbin_mongodb -d mongo
{% endhighlight %}

To build the application image and start a new container:

{% highlight bash %}
$ docker build -t texbin:dev .
$ docker run --name texbin_test -d --link texbin_mongodb:mongodb -p 3000:3000 -v /texbin/app/public texbin:dev
{% endhighlight %}

Learning how [container linking](https://docs.docker.com/userguide/dockerlinks/)
and [volumes](https://docs.docker.com/userguide/dockervolumes/) work is
essential if you want to understand what's going on.

**Note:** The project also includes a `Dockerfile` for the
[Nginx container](https://github.com/danielfm/texbin/tree/master/config/docker/nginx)
which I won't show here because it doesn't bring anything new to the table.

Now `docker ps` should display two running containers. If everything's
working, you should be able to access the application at
<http://localhost:3000>. To see the logs, run `docker logs texbin_test`.

![Screenshot](/images/trying-docker/screenshot.png)

## Docker in Development

It turns out it's quite easy to automate these last steps with
[Fig](http://www.fig.sh/):

{% highlight yaml %}
# fig.yml

mongodb:
  image: mongo

app:
  build: .
  ports:
    - "3000:3000"
  links:
    - mongodb:mongodb
  volumes:
    - .:/texbin/app
{% endhighlight %}

Then, run `fig up -d` in the terminal in order to build the images, start the
containers, and link them together.

The only difference between this and the commands we ran manually before is
that now we're mounting the hosts's current directory to container's
`/texbin/app` so that we can view our changes to the application in real time.

Try changing some `.html.erb` template and refreshing the browser.

## Defining New Environments

The goal is to run the same application in production, but with a different
configuration. A simple way to -- sort of -- solve this is by creating another
image based on the previous one that changes the required configuration:

{% highlight bash %}
# Uses our previous image as base
FROM texbin

# Set the proper environment
ENV RAILS_ENV production

# Custom settings for that environment
ADD production_env /texbin/app/.env
ADD production_mongoid.yml /texbin/app/config/mongoid.yml

# Precompile the assets
RUN rake assets:precompile

# Exposes the public directory as a volume
VOLUME /texbin/app/public
{% endhighlight %}

If you know a better way to do this, please let me know in the comments.

## Going Live

The first thing to do is to push your images to the server. There are plenty
of ways to do that: [the public registry](https://registry.hub.docker.com/), a
[private-hosted registry](https://github.com/docker/docker-registry), git, etc.

Once the images are built, just repeat the procedure we did earlier and
you're done. However, as you probably know, deploying an application involves
not only the deployment process itself, but also stuff like:

### Managing Updates

- How can I deploy new stuff without downtime?

### Monitoring

- Host machine monitoring (load, memory, I/O, network)
- Are my containers up?
- Are the services withing my containers up?

### Logging

- How can we see what's going on with my application?
- How do I rotate and archive the logs?

### Maintenance Tasks

- How can I back up my data?
- How can I run data migrations?


## Conclusion

- Docker does one thing, and does it well: processes running in isolation
- Container orchestration is hard and error-prone if done by hand
- Container linking are somewhat limited
  - No default service discovery solution (ambassadors is still a hack)

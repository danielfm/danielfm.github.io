---
title: A Week Of Docker
author: Daniel Martins
date: 2014-08-15
tags: [docker, fig, tips, deployment]
aliases:
- /posts/a-week-of-docker.html
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
PDF version. The code was sitting in my laptop without being used, so why not
use it as guinea pig in my first attempt to use Docker? :-)

The proposed stack is composed by three components: the application itself, a
[MongoDB](http://mongodb.org) instance, and a [Nginx](http://nginx.org) server
to both serve the static content and act as a reverse proxy to the application.

![Architecture](/images/a-week-of-docker/architecture.svg)

## WTF is a container?

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
none of the execution overhead that comes with it.

## Why not put everything within the same container?

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
- spin up two or more application containers so you can perform
  [blue-green deployments](http://martinfowler.com/bliki/BlueGreenDeployment.html),
  improve concurrency and resource usage, etc

In other words: it's a good idea to keep the moving parts, well, moving.

## The Dockerfile

Containers are created from images, so first we need to create an image
with the application code and all the required software packages.

Instead of doing things manually, Docker can build images automatically by
reading the instructions from a `Dockerfile`, which is a text file that contains
all the commands you would normally execute manually in order to build a Docker
image.

This is the application's `Dockerfile`:

```dockerfile
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
```

Information about the individual commands can be obtained
[here](https://docs.docker.com/reference/builder/).

### 1<sup>st</sup> Tip: Kiss RVM Goodbye

Why do you need RVM if the application will live inside a controlled and
isolated environment?

The only reason you might want to do that is because you need to install a
particular version of Ruby that you can't find via traditional OS package
managers. If that's the case, you'll be better off installing the Ruby version
you want from the source code.

Using RVM from within a Docker container is not a pleasant experience; every
command must run inside a login shell session and you'll have problems using
`CMD` together with `ENTRYPOINT`.

### 2<sup>nd</sup> Tip: Optimize for the Build Cache

Docker stores intermediate images after successfully executing each command in
the `Dockerfile`. This is a great feature; if any step fails along the way, you
can fix the problem and the next build will reuse the cache built up until that
last successful command.

Instructions like `ADD` are not cache friendly though. That's why it's a good
practice to only `ADD` stuff as late as possible in the `Dockerfile` since any
changes in the files -- or their metadata -- will invalidate the build cache for
all subsequent instructions.

Which leads us to...

### 3<sup>rd</sup> Tip: Don't Forget the `.dockerignore`

A really important step is to avoid `ADD`ing irrelevant files to the
container, like `README`, `fig.yml`, `.git/`, `logs/`, `tmp/`, and others.

If you are familiar with `.gitignore`, the idea is the same: just create a
`.dockerignore` file and put there the patterns you want to ignore. This wil
help keep the image small and the build fast by decreasing the chance of cache
busting.

## Testing the Images

To run the application, first we'll need a container that exposes a single
MongoDB server:

```bash
$ docker run --name texbin_mongodb_1 -d mongo
```

Then you have to build the application image and start a new container:

```bash
$ docker build -t texbin:dev .
$ docker run --name texbin_app_1 -d --link texbin_mongodb_1:mongodb -p 3000:3000 texbin:dev
```

Learning how [container linking](https://docs.docker.com/userguide/dockerlinks/)
and [volumes](https://docs.docker.com/userguide/dockervolumes/) work is
essential if you want to understand how to "plug" containers together.

**Note:** The project also includes a `Dockerfile` for the
[Nginx container](https://github.com/danielfm/texbin/tree/master/config/docker/nginx)
which I won't show here because it doesn't bring anything new to the table.

Now `docker ps` should display two running containers. If everything's
working, you should be able to access the application at
<http://localhost:3000>. To see the logs, run `docker logs texbin_app_1`.

![Screenshot](/images/a-week-of-docker/screenshot.png)

## Docker in Development

It turns out it's quite easy to automate these last steps with
[Fig](http://www.fig.sh/):

```yaml
# fig.yml

mongodb:
  image: mongo

app:
  build: .
  ports:
    - 3000:3000
  links:
    - mongodb:mongodb
  volumes:
    - .:/texbin/app
```

Then, run `fig up` in the terminal in order to build the images, start the
containers, and link them.

The only difference between this and the commands we ran manually before is
that now we're mounting the hosts's current directory to container's
`/texbin/app` so that we can view our changes to the application in real time.

Try changing some `.html.erb` template and refreshing the browser.

## Defining New Environments

The goal is to run the same application in production, but with a different
configuration, right? A simple way to -- sort of -- solve this is by creating
another image, based on the previous one, that changes the required
configuration:

```dockerfile
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
```

If you know a better way to do this, please let me know in the comments.

## Going Live

The first thing to do is to push your images to the server. There are plenty
of ways to do that: [the public registry](https://registry.hub.docker.com/), a
[private-hosted registry](https://github.com/docker/docker-registry), git, etc.
Once the images are built, just repeat the procedure we did earlier and you're
done.

But that's not everything. As you probably know, deploying an application
involves [a lot more](http://www.oscon.com/oscon2014/public/schedule/detail/34136)
than just moving stuff to some remote servers. This means you'll still have to
worry with things like deployment automation, monitoring (at host and container
levels), logging, data migrations and backup, etc.

## Conclusion

I'm glad I took the time to look at Docker. Despite its young age, it's a very
impressive rapidly-evolving piece of technology with a lot of potential to
radically change the DevOps landscape in the next couple of years.

However, Docker solves only one variable of a huge equation. You'll still have
to take care of boring things like monitoring, and I imagine it's rather
difficult -- not to say impossible -- to use Docker in production without
[some layer of automation](https://github.com/newrelic/centurion) on top of it.

Also, features like container linking, are somewhat limited and we'll probably
see substantial improvements in
[future releases](https://github.com/docker/docker/milestones). So stay tuned!

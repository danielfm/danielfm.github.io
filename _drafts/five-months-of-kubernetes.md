---
layout: post_bigcover
title: Five Months of Kubernetes
description:
  visible: true
  text: This is how we used Kubernetes to power our continuous delivery pipeline.
date: 2016-09-31 00:00
categories: [ops]
tags: [ops, infrastructure, kubernetes, descomplica, paas, cloud, aws, beanstalk, continuous delivery]
comments: true
image:
  feature: five-months-of-kubernetes/cover.jpg
---

For the past year, the [company](https://descomplica.com.br) I work for moved
towards a more service-oriented architecture for its core components (auth,
search, etc) and we've been using
[Elastic Beanstalk](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/Welcome.html)
from the start to orchestrate the deployment of those services to AWS.

It was a good decision at the time. In general, Elastic Beanstalk works fine
and has a very gentle learning curve; it didn't take long for all teams to start
using it for their projects.

Fast-forward a few months, everything was nice and good. Our old problems were
solved, but - as you might have guessed - we had new ones to worry about.

## Cost Issues

In Elastic Beanstalk, each EC2 instance runs exactly one application container[^1].
This means that, if you follow reliability best practices, you'll have two or more
instances (spread across multiple [availability zones](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html))
for each application. You might need even more instances if you have other
environments besides the production one, i.e. staging.

Anyway, you'll end up having multiple dedicated instances per service which,
depending on your workload, will sit there doing nothing most of the time.

We needed to find a way to use our available compute resources more wisely.

## The Clear Winner

After looking around for alternatives to ECS, [Kubernetes](http://kubernetes.io)
seemed to be the right one for us.

> Kubernetes is a container orchestration tool that builds upon 15 years of
> experience of running production workloads at Google, combined with
> best-of-breed ideas and practices from the community.

Although Kubernetes is a feature-rich project, a few key features caught our
attention: [namespaces](http://kubernetes.io/docs/user-guide/namespaces/),
[automated rollouts and rollbacks](http://kubernetes.io/docs/user-guide/deployments/),
[service discovery via DNS](http://kubernetes.io/docs/user-guide/services/),
[automated container scaling based on resource usage](http://kubernetes.io/docs/user-guide/horizontal-pod-autoscaling/),
and of course, the promise of a [self-healing system](http://kubernetes.io/docs/user-guide/pod-states/#container-probes).

Kubernetes is somewhat opinionated around how containers are supposed to be
organized and networked, but this should not be a problem if your service
follows the [Twelve-Factor](https://12factor.net/) practices.

## Our Path to Production

<figure>
  <img src="/images/five-months-of-kubernetes/five-months.png" alt="Five months"/>
  <figcaption>This is where it all started.</figcaption>
</figure>

In order to ensure Kubernetes was a viable option for us, the first thing we
did was perform some reliability tests to make sure it could handle failure
modes such as dying nodes, killed Kubelet/Proxy/Docker daemons, and availability
zone outages.

It's impossible to anticipate all the ways things can go wrong, but in the end,
we were very impressed by how Kubernetes managed to handle these failures.

At that time, we used [kube-up](http://kubernetes.io/docs/getting-started-guides/binary_release/)
to bootstrap our test clusters. This tool, although it served its purpose, not
always worked as expected; it suffered from a number of issues, such as poorly
chosen defaults, random timeouts that left the stack only half-created, and
inconsistent behavior when destroying the cluster causing orphan resources
to be left behind[^2].

Once we agreed that Kubernetes was the way to go, we needed a more reliable
way to create and destroy our Kubernetes clusters.

### Enter kube-aws

[kube-aws](https://github.com/coreos/coreos-kubernetes/tree/master/multi-node/aws)
is a tool created by some good guys from CoreOS. The cool thing about it
is that it uses [CloudFormation](https://aws.amazon.com/cloudformation/) under
the hoods, which gives us some neat advantages.

The first obvious advantage is that it's very easy to create and destroy
clusters without leaving anything silently hanging around.

Another feature is that, unlike kube-up, you can create clusters in an
existing VPC so the services hosted in Kubernetes have access to other existing
AWS-hosted services, such as
[relational databases](https://aws.amazon.com/rds/), right off the bat.

In fact, you can run multiple clusters at the same time in the same VPC. This
has a nice side-effect in which you can treat each cluster as an immutable
piece of infrastructure; instead of modifying a running cluster - and risking
break something - you simply create a new cluster and gradually shift traffic
from the old one to the new in a way that any incidents has limited impact.

The final and probably the most useful feature is that you can easily customize
nearly every aspect of the cluster provisioning configuration to make it fit
your own needs. In our case, we added
[cluster level logging](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch/)
that ingests application logs to [Sumologic](https://sumologic.com),
[cluster monitoring](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/cluster-monitoring)
with [InfluxDB](https://www.influxdata.com) and [Grafana](http://grafana.org),
[ABAC-based authorization](http://kubernetes.io/docs/admin/authorization/#abac-mode),
among other things.

### The First Environment

After solving the problem of reliably creating and destroying clusters, we felt
confident to start migrating our staging environment over to Kubernetes.

It was easy enough to manually create the yaml manifests for the first
[deployments](http://kubernetes.io/docs/user-guide/deployments/), but we needed
an automated way to deploy new application images as soon as they were built
by our continuous integration system.

Just as a proof of concept, we quickly hacked together a small JavaScript
function in [AWS Lambda](https://aws.amazon.com/documentation/lambda/) (based on
[this article](https://aws.amazon.com/blogs/compute/dynamic-github-actions-with-aws-lambda/))
that automatically updated the corresponding deployment object whenever it
received a merge event in which the tests passed.

> This small Lambda function has now evolved into a major component in our
> delivery pipeline, orchestrating deployments to other environments as well,
> including production.

With this done, migrating staging services from Beanstalk to Kubernetes was
pretty straightforward. First, we created one DNS record for each service (each
initially pointing to the legacy deployment in Elastic Beanstalk) and made sure
that all services referenced each other via this DNS. Then, it was just a matter
of changing those DNS records to point the corresponding
[Kubernetes-managed load balancers](http://kubernetes.io/docs/user-guide/services/#type-loadbalancer).

To ensure every part of the staging pipeline was working as expected, we spent
some time monitoring all staging deployments looking for bugs and polishing
things up.

### More Tests, More Learning

Before deploying our first production service to Kubernetes, we did some load
testing to find out the optimal configuration for the
[resource requirements](http://kubernetes.io/docs/user-guide/compute-resources/)
needed by each service and out how many pods we needed to handle the current
traffic.

<figure>
  <img src="/images/five-months-of-kubernetes/grafana.png" alt="Grafana"/>
  <figcaption>This is where monitoring comes in handy.</figcaption>
</figure>

Observing how your services behave under load and how much compute they need
is _essential_.

Also take some time to understand how
[QoS classes](https://github.com/kubernetes/kubernetes/blob/master/docs/design/resource-qos.md#qos-classes)
work in Kubernetes so you have a more fine control over which pods gets
killed in the case of memory pressure. This is particularly important if you,
like us, share the same cluster for all environments.

#### Tip: Give `kube-system` some love

If you ever tried Kubernetes, you probably noticed there's a `kube-system`
namespace there with a bunch of stuff in it; do yourself a favor and take some
time to understand the role of each of those things.

For instance, take the
[DNS add-on](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns);
it's rather common to see people having
[issues](https://github.com/coreos/coreos-kubernetes/issues/533) because they
forgot to add more DNS pods to handle their ever-increasing workload.

### Going Live

Instead of shifting all traffic at once, like we did in staging, we thought we
needed to take a more careful approach and used
[weighted routing policy](http://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html)
to gradually shift traffic to the Kubernetes cluster, usually in 25% increments.

Once we noticed no more requests were reaching the legacy
Beanstalk environments, we went ahead and killed them[^3].

## Beyond Production

Kubernetes gave us the power and flexibility to almost effortlessly mold our
delivery pipeline in a way we never thought possible. One example of such
improvement is what we now call _development environments_.

<figure>
  <img src="/images/five-months-of-kubernetes/deploy-pending.png" alt="Updating deployment..."/>
  <figcaption>Meet the Dungeon Master.</figcaption>
</figure>

Whenever someone opens a Pull Request to one of our projects, the AWS Lambda
function I mentioned earlier creates a temporary environment running the
modifications introduced by the PR.

Also, whenever new code is pushed, this environment gets automatically updated
as long as they pass the tests. Finally, when the PR is merged (or closed), the
environment is deleted.

<figure>
  <img src="/images/five-months-of-kubernetes/deploy-success.png" alt="Deployment updated!"/>
  <figcaption>Deployment updated, it's code review time!</figcaption>
</figure>

This feature made our code reviews more thorough because the developers can
actually see the changes running. This is even more useful for UX changes in
front-end services; artists and product owners get the chance to validate the
changes and share their inputs before the PR is merged.

To send the [GitHub Status](https://developer.github.com/v3/repos/statuses/)
notifications you see in these pictures, we implemented a small daemon in Go
that runs within the Kubernetes cluster that monitors deployments to our
`development` namespace and reconciles the deployment status for each revision.

## Conclusion

Kubernetes is a very complex piece of software that aims to solve a very complex
problem, so expect to spend some time learning how its many pieces fit together
before using it in your projects.

Kubernetes is production-ready, but avoid the temptation of trying to run
_everything_ on it. In our experience, Kubernetes does not offer a clean
solution for a number of problems you might face, such as
[stateful applications](http://kubernetes.io/docs/user-guide/petset/).

The documentation is not great as well, but initiatives like the
[Kubernetes Bootcamp](https://kubernetesbootcamp.github.io/kubernetes-bootcamp/index.html)
and [Kelsey Hightower](https://twitter.com/kelseyhightower)'s
[Kubernetes The Hard Way](https://github.com/kelseyhightower/kubernetes-the-hard-way)
gives me hope that the game is changing - and it's changing fast - especially
if we consider that Kubernetes is one of the top projects on GitHub, with one
major release every 3 months thanks to the contributions from over 800 people.
These numbers are pretty damn impressive if you ask me.

Without Kubernetes, I don't know how - or if - we could have accomplished
all the things we did in such a small period of time with such a small
engineering team[^4].

We hope to continue building on Kubernetes to make our delivery platform even
more dynamic and awesome!

[^1]: Each AWS region seems to evolve at a different pace. At the time of this writing, [multi-container](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_docker_ecs.html) Beanstalk applications, or even [ECS](https://aws.amazon.com/ecs/) wasn't available for the `sa-east-1` region. Almost all of our users live in Brazil, so moving out to a different region wasn't really an option.
[^2]: There are a number of initiatives to come up with a better tool to create and manage Kubernetes clusters, such as [kops](https://github.com/kubernetes/kops).
[^3]: The migration is still in progress, but things are moving fast; we expect it to be completed by the end of the month.
[^4]: The ops/delivery team is actually a one-engineer team: me!

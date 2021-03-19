---
author: Daniel Martins
title: Pain(less?) NGINX Ingress
date: 2017-09-13
tags: [ops, infrastructure, kubernetes, k8s, cloud, ingress, nginx, webserver, optimization]
aliases:
- /posts/painless-nginx-ingress.html
---

So you have a [Kubernetes](https://kubernetes.io) cluster and are using (or
considering using) the
[NGINX ingress controller](https://github.com/kubernetes/ingress-nginx)
to forward outside traffic to in-cluster services. That's awesome!

The first time I looked at it, everything looked so easy; installing the NGINX
ingress controller was one `helm install` away, so I did it. Then, after hooking
up the DNS to the load balancer and creating a few
[Ingress resources](https://kubernetes.io/docs/concepts/services-networking/ingress/#the-ingress-resource),
I was in business.

Fast-forward a few months, all external traffic for all environments
(dev, staging, production) was going through the ingress servers. Everything was
good. Until it wasn't.

We all know how it happens. First, you get excited about that shiny new thing.
You start using it. Then, eventually, some shit happens.

## My First Ingress Outage

Let me start by saying that if you are not alerting on
[accept queue overflows](http://veithen.github.io/2014/01/01/how-tcp-backlog-works-in-linux.html),
well, you should.

{{< figure src="/images/production-ingress/tcp-diagram.svg" caption="Do mind the queues." alt="TCP connection flow diagram" >}}

What happened was that one of the applications being proxied through NGINX
started taking too long to respond, causing connections to completely fill the
[NGINX listen backlog](http://nginx.org/en/docs/http/ngx_http_core_module.html#listen),
which caused NGINX to quickly start dropping connections, including the ones
being made by Kubernetes'
[liveness/readiness probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/).

What happens when some pod fails to respond to the liveness probes? Kubernetes
thinks there's something wrong with the pod and restarts it. The problem is that
this is one of those situations where restarting a pod will actually make more
harm than good; the accept queue will overflow, again and again, causing Kubernetes
to keep restarting the NGINX pods until they all started to crash-loop.

{{< figure src="/images/production-ingress/listen-overflows.png" caption="TCP listen overflows as reported by `netstat`." alt="Graph showing surges of TCP listen overflow errors" >}}

What are the lessons learned from this incident?

- Know every bit of your NGINX configuration. Look for anything that should
  (or should not) be there, and don't blindingly trust any default values.
- Most Linux distributions do not provide an optimal configuration for running
  high load web servers out-of-the-box; double-check the values for each kernel
  param via `sysctl -a`.
- Make sure to measure the latency across your services and set the various
  timeouts based on the expected upper bound + some slack to accommodate slight
  variations.
- Change your applications to drop requests or degrade gracefully when
  overloaded. For instance, in NodeJS applications,
  [latency increases](https://medium.com/springworks-engineering/node-js-profiling-event-loop-lag-flame-charts-539e04723e84)
  in the event loop might indicate the server is in trouble keeping up with the
  current traffic.
- Do not use just one NGINX ingress controller deployment for balancing across
  all types of workloads/environments.

### The Importance of Observability

Before detailing each of the previous points, my 0th advice is to _never_ run a
production Kubernetes cluster (or anything else for that matter) without proper
monitoring; by itself, monitoring won't prevent bad things from happening, but
collecting telemetry data during such incidents will give you means to root-cause
and fix most issues you'll find along the way.

{{< figure src="/images/production-ingress/netstat-metrics.png" caption="Some useful `node_netstat_*` metrics." alt="Grafana dashboard showing a few netstat metrics." >}}

If you choose to jump on the [Prometheus](https://prometheus.io) bandwagon, you can
leverage [node_exporter](https://github.com/prometheus/node_exporter) in order to
collect node-level metrics that could help you detect situations like the one I've
just described.

{{< figure src="/images/production-ingress/ingress-metrics.png" caption="Some of the metrics exposed by the NGINX ingress controller." alt="Grafana dashboard for displaying NGINX ingress metrics." >}}

Also, the NGINX ingress controller itself exposes Prometheus metrics; make
sure to collect those as well.

## Know Your Config

The beauty of ingress controllers is that you delegate the task of generating and
reloading the proxy configuration to this fine piece of software and never worry
about it; you don't even have to be familiar with the underlying technology
(NGINX in this case). Right? **Wrong!**

If you haven't done that already, I urge you to take a look at the configuration
your ingress controller generated for you. For the NGINX ingress controller,
all you need to do is grab the contents of `/etc/nginx/nginx.conf` via `kubectl`.

```bash
kubectl -n <namespace> exec <nginx-ingress-controller-pod-name> -- /
   cat /etc/nginx/nginx.conf > ./nginx.conf
```

Now look for anything that's not compatible with your setup. Want an example? Let's start with [`worker_processes auto;`](http://nginx.org/en/docs/ngx_core_module.html#worker_processes)

```nginx
# $ cat ./nginx.conf
daemon off;

worker_processes auto;
pid /run/nginx.pid;

worker_rlimit_nofile 1047552;
worker_shutdown_timeout 10s ;

events {
    multi_accept        on;
    worker_connections  16384;
    use                 epoll;
}

http {
    real_ip_header      X-Forwarded-For;
    # ...
}

# ...
```


> The optimal value depends on many factors including (but not limited to) the
> number of CPU cores, the number of hard disk drives that store data, and load
> pattern. When one is in doubt, setting it to the number of available CPU cores
> would be a good start (the value “`auto`” will try to autodetect it).

Here's the first gotcha: as of now (will it ever be?), NGINX is not
[Cgroups](https://en.wikipedia.org/wiki/Cgroups)-aware, which means the `auto`
value will use the number of _physical CPU cores_ on the host machine, not the
number of "virtual" CPUs as defined by the Kubernetes
[resource requests/limits](https://kubernetes.io/docs/concepts/configuration/manage-compute-resources-container/).

Let's run a little experiment. What happens when you try to load the following
NGINX configuration file from a container limited to only one CPU in a dual-core
server? Will it spawn one or two worker processes?

```nginx
# $ cat ./minimal-nginx.conf

worker_processes auto;

events {
  worker_connections 1024;
}

http {
  server {
    listen 80;
    server_name localhost;

    location / {
      root  html;
      index index.html index.htm;
    }
  }
}
```

Thus, if you intend to restrict the NGINX ingress CPU share, it might not make
sense to spawn a large number of workers per container. If that's the case, make
sure to explicitly set the desired number in the `worker_processes` directive.

```text
$ docker run --rm --cpus="1" -v `pwd`/minimal-nginx.conf:/etc/nginx/nginx.conf:ro -d nginx
fc7d98c412a9b90a217388a094de4c4810241be62c4f7501e59cc1c968434d4c

$ docker exec fc7 ps -ef | grep nginx
root         1     0  0 21:49 pts/0    00:00:00 nginx: master process nginx -g daemon off;
nginx        6     1  0 21:49 pts/0    00:00:00 nginx: worker process
nginx        7     1  0 21:49 pts/0    00:00:00 nginx: worker process
```

Now take the `listen` directive; it does not specify the `backlog` parameter
(which is `511` by default on Linux). If your kernel's `net.core.somaxconn` is
set to, say, `1024`, you should also specify the `backlog=X` parameter
accordingly. In other words, make sure your config is in tune with your kernel.

And please, don't stop there. Do this thought exercise to every line of the
generated config. Hell, take at look at
    [all the things](https://github.com/kubernetes/ingress-nginx/blob/master/rootfs/etc/nginx/template/nginx.tmpl)
the ingress controller will let you change, and don't hesitate to
change anything that does not fit your use case. Most NGINX directives can be
[customized](https://github.com/kubernetes/ingress-nginx/blob/master/docs/user-guide/configmap.md)
via `ConfigMap` entries and/or annotations.

### Kernel Params

Using ingress or not, make sure to always review and tune the kernel params
of your nodes according to the expected workloads.

This is a rather complex subject on its own, so I have no intention of covering
everything in this post; take a look at the [References](#references) section
for more pointers in this area.

#### Kube-Proxy: Conntrack Table

If you are using Kubernetes, I don't need to explain to you what
[Services](https://kubernetes.io/docs/concepts/services-networking/service/)
are and what they are used for. However, I think it's important to understand
in more detail how they work.

> Every node in a Kubernetes cluster runs a kube-proxy, which is
> responsible for implementing a form of virtual IP for `Services` of type
> other than `ExternalName`. In Kubernetes v1.0 the proxy was purely in
> userspace. In Kubernetes v1.1 an iptables proxy was added, but was not
> the default operating mode. Since Kubernetes v1.2, the iptables proxy is
> the default.

In other words, all packets sent to a Service IP are forwarded/load-balanced to
the corresponding `Endpoint`s (`address:port` tuples for all pods that match the
`Service`
[label selector](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/))
via iptables rules managed by [kube-proxy](https://kubernetes.io/docs/admin/kube-proxy/);
connections to `Service` IPs are tracked by the kernel via the `nf_conntrack`
module, and, as you might have guessed, this connection tracking  information is
stored in RAM.

As the values of different conntrack params need to be set in conformance with
each other (ie. `nf_conntrack_max` and `nf_conntrack_buckets`), kube-proxy
configures sane defaults for those as part of its bootstrapping procedure.

```
$ kubectl -n kube-system logs <some-kube-proxy-pod>
I0829 22:23:43.455969       1 server.go:478] Using iptables Proxier.
I0829 22:23:43.473356       1 server.go:513] Tearing down userspace rules.
I0829 22:23:43.498529       1 conntrack.go:98] Set sysctl 'net/netfilter/nf_conntrack_max' to 524288
I0829 22:23:43.498696       1 conntrack.go:52] Setting nf_conntrack_max to 524288
I0829 22:23:43.499167       1 conntrack.go:83] Setting conntrack hashsize to 131072
I0829 22:23:43.503607       1 conntrack.go:98] Set sysctl 'net/netfilter/nf_conntrack_tcp_timeout_established' to 86400
I0829 22:23:43.503718       1 conntrack.go:98] Set sysctl 'net/netfilter/nf_conntrack_tcp_timeout_close_wait' to 3600
I0829 22:23:43.504052       1 config.go:102] Starting endpoints config controller
...
```

These are good defaults, but you might want to [increase those](https://kubernetes.io/docs/admin/kube-proxy/)
if your monitoring data shows you're running out of conntrack space. However,
bear in mind that increasing these params will result in
[increased memory usage](https://johnleach.co.uk/words/372/netfilter-conntrack-memory-usage),
so be gentle.

{{< figure src="/images/production-ingress/conntrack-usage.png" caption="Conntrack usage monitoring." alt="Grafana dashboard showing the conntrack usage." >}}

## Sharing Is (Not) Caring

We used to have just a single NGINX ingress deployment responsible for proxying
requests to all applications in all environments (dev, staging, production)
until recently. I can say from experience this is **bad** practice;
_don't put all your eggs in one basket._

I guess the same could be said about sharing one cluster for all environments,
but we found that, by doing this, we get better resource utilization by allowing
dev/staging pods to run on a best-effort QoS tier, taking up resources not
used by production applications.

The trade-off is that this limits the things we can do to our cluster. For
instance, if we decide to run a load test on a staging service, we need to be
really careful or we risk affecting production services running in the same
cluster.

Even though the level of isolation provided by containers is generally good, they
still [rely on shared kernel resources](https://sysdig.com/blog/container-isolation-gone-wrong/)
that are subject to abuse.

### Split Ingress Deployments Per Environment

That being said, there's no reason not to use dedicated ingresses per
environment. This will give you an extra layer of protection in case your
dev/staging services get misused.

Some other benefits of doing so:

- You get the chance to use different settings for each environment if needed
- Allow testing ingress upgrades in a more forgiving environment before rolling
  out to production
- Avoid bloating the NGINX configuration with lots of upstreams and servers
  associated with ephemeral and/or unstable environments
- As a consequence, your configuration reloads will be faster, and you'll have
  fewer configuration reload events during the day (we'll discuss later why you
  should strive to keep the number of reloads to a minimum)

#### Ingress Classes To The Rescue

One way to make different ingress controllers manage different `Ingress`
resources in the same cluster is by using a different **ingress class name** per
ingress deployment, and then annotate your `Ingress` resources to specify which
one is responsible for controlling it.

```yaml
# Ingress controller 1
apiVersion: extensions/v1beta1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - args:
            - /nginx-ingress-controller
            - --ingress-class=class-1
            - ...

# Ingress controller 2
apiVersion: extensions/v1beta1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - args:
            - /nginx-ingress-controller
            - --ingress-class=class-2
            - ...

# This Ingress resource will be managed by controller 1
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: class-1
spec:
  rules: ...

# This Ingress resource will be managed by controller 2
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: class-2
spec:
  rules: ...
```

## Ingress Reloads Gone Wrong

At this point, we were already running a dedicated ingress controller for the
production environment. Everything was running pretty smoothly until we
decided to migrate a WebSocket application to Kubernetes + ingress.

Shortly after the migration, I started noticing a strange trend in memory usage
for the production ingress pods.

{{< figure src="/images/production-ingress/ingress-memory-issue.png" caption="What the hell is happening?!" alt="Grafana dashboard showing nginx-ingress containers leaking memory." >}}

Why was the memory consumption skyrocketing like this? After I `kubectl exec`’d
into one of the ingress containers, what I found was a bunch of worker processes
stuck in shutting down state for several minutes.

```
root     17755 17739  0 19:47 ?        00:00:00 /usr/bin/dumb-init /nginx-ingress-controller --default-backend-service=kube-system/broken-bronco-nginx-ingress-be --configmap=kube-system/broken-bronco-nginx-ingress-conf --ingress-class=nginx-ingress-prd
root     17765 17755  0 19:47 ?        00:00:08 /nginx-ingress-controller --default-backend-service=kube-system/broken-bronco-nginx-ingress-be --configmap=kube-system/broken-bronco-nginx-ingress-conf --ingress-class=nginx-ingress-prd
root     17776 17765  0 19:47 ?        00:00:00 nginx: master process /usr/sbin/nginx -c /etc/nginx/nginx.conf
nobody   18866 17776  0 19:49 ?        00:00:05 nginx: worker process is shutting down
nobody   19466 17776  0 19:51 ?        00:00:01 nginx: worker process is shutting down
nobody   19698 17776  0 19:51 ?        00:00:05 nginx: worker process is shutting down
nobody   20331 17776  0 19:53 ?        00:00:05 nginx: worker process is shutting down
nobody   20947 17776  0 19:54 ?        00:00:03 nginx: worker process is shutting down
nobody   21390 17776  1 19:55 ?        00:00:05 nginx: worker process is shutting down
nobody   22139 17776  0 19:57 ?        00:00:00 nginx: worker process is shutting down
nobody   22251 17776  0 19:57 ?        00:00:01 nginx: worker process is shutting down
nobody   22510 17776  0 19:58 ?        00:00:01 nginx: worker process is shutting down
nobody   22759 17776  0 19:58 ?        00:00:01 nginx: worker process is shutting down
nobody   23038 17776  1 19:59 ?        00:00:03 nginx: worker process is shutting down
nobody   23476 17776  1 20:00 ?        00:00:01 nginx: worker process is shutting down
nobody   23738 17776  1 20:00 ?        00:00:01 nginx: worker process is shutting down
nobody   24026 17776  2 20:01 ?        00:00:02 nginx: worker process is shutting down
nobody   24408 17776  4 20:01 ?        00:00:01 nginx: worker process
```

In order to understand why this happened, we must take a step back and look at how
configuration reloads is implemented in NGINX.

> Once the master process receives the signal to reload configuration, it checks
> the syntax validity of the new configuration file and tries to apply the
> configuration provided in it. If this is a success, the master process starts
> new worker processes and sends messages to old worker processes, requesting
> them to shut down. Otherwise, the master process rolls back the changes and
> continues to work with the old configuration. Old worker processes, receiving
> a command to shut down, stop accepting new connections **and continue to service
> current requests until all such requests are serviced. After that, the old
> worker processes exit.**

Remember we are proxying WebSocket connections, which are long-running by nature;
a WebSocket connection might take hours, or even days to close depending on the
application. The NGINX server cannot know if it's okay to break up a connection
during a reload, so it's up to you to make things easier for it. (One thing you
can do is to have a strategy in place to actively close connections that are
idle for far too long, both at the client and server-side; don't leave this as
an afterthought)

Now back to our problem. If we have that many workers in that state, this means
the ingress configuration got reloaded many times, and workers were unable to
terminate due to the long-running connections.

That's indeed what happened. After some debugging, we found that the NGINX
ingress controller was repeatedly generating a different configuration file due
to changes in the ordering of upstreams and server IPs.

```diff
I0810 23:14:47.866939       5 nginx.go:300] NGINX configuration diff
I0810 23:14:47.866963       5 nginx.go:301] --- /tmp/a072836772	2017-08-10 23:14:47.000000000 +0000
+++ /tmp/b304986035	2017-08-10 23:14:47.000000000 +0000
@@ -163,32 +163,26 @@
 
     proxy_ssl_session_reuse on;
 
-    upstream production-app-1-80 {
+    upstream upstream-default-backend {
         # Load balance algorithm; empty for round robin, which is the default
         least_conn;
-        server 10.2.71.14:3000 max_fails=0 fail_timeout=0;
-        server 10.2.32.22:3000 max_fails=0 fail_timeout=0;
+        server 10.2.157.13:8080 max_fails=0 fail_timeout=0;
     }
 
-    upstream production-app-2-80 {
+    upstream production-app-3-80 {
         # Load balance algorithm; empty for round robin, which is the default
         least_conn;
-        server 10.2.110.13:3000 max_fails=0 fail_timeout=0;
-        server 10.2.109.195:3000 max_fails=0 fail_timeout=0;
+        server 10.2.82.66:3000 max_fails=0 fail_timeout=0;
+        server 10.2.79.124:3000 max_fails=0 fail_timeout=0;
+        server 10.2.59.21:3000 max_fails=0 fail_timeout=0;
+        server 10.2.45.219:3000 max_fails=0 fail_timeout=0;
     }
 
     upstream production-app-4-80 {
         # Load balance algorithm; empty for round robin, which is the default
         least_conn;
-        server 10.2.109.177:3000 max_fails=0 fail_timeout=0;
         server 10.2.12.161:3000 max_fails=0 fail_timeout=0;
-    }
-
-    upstream production-app-5-80 {
-        # Load balance algorithm; empty for round robin, which is the default
-        least_conn;
-        server 10.2.21.37:9292 max_fails=0 fail_timeout=0;
-        server 10.2.65.105:9292 max_fails=0 fail_timeout=0;
+        server 10.2.109.177:3000 max_fails=0 fail_timeout=0;
     }
 
     upstream production-app-6-80 {
@@ -201,61 +195,67 @@
     upstream production-lap-production-80 {
         # Load balance algorithm; empty for round robin, which is the default
         least_conn;
-        server 10.2.45.223:8000 max_fails=0 fail_timeout=0;
+        server 10.2.21.36:8000 max_fails=0 fail_timeout=0;
         server 10.2.78.36:8000 max_fails=0 fail_timeout=0;
+        server 10.2.45.223:8000 max_fails=0 fail_timeout=0;
         server 10.2.99.151:8000 max_fails=0 fail_timeout=0;
-        server 10.2.21.36:8000 max_fails=0 fail_timeout=0;
     }
 
-    upstream production-app-7-80{
+    upstream production-app-1-80 {
         # Load balance algorithm; empty for round robin, which is the default
         least_conn;
-        server 10.2.79.126:3000 max_fails=0 fail_timeout=0;
-        server 10.2.35.105:3000 max_fails=0 fail_timeout=0;
-        server 10.2.114.143:3000 max_fails=0 fail_timeout=0;
-        server 10.2.50.44:3000 max_fails=0 fail_timeout=0;
-        server 10.2.149.135:3000 max_fails=0 fail_timeout=0;
-        server 10.2.45.155:3000 max_fails=0 fail_timeout=0;
+        server 10.2.71.14:3000 max_fails=0 fail_timeout=0;
+        server 10.2.32.22:3000 max_fails=0 fail_timeout=0;
     }
 
-    upstream production-app-8-80 {
+    upstream production-app-2-80 {
         # Load balance algorithm; empty for round robin, which is the default
         least_conn;
-        server 10.2.53.23:5000 max_fails=0 fail_timeout=0;
-        server 10.2.110.22:5000 max_fails=0 fail_timeout=0;
-        server 10.2.35.91:5000 max_fails=0 fail_timeout=0;
-        server 10.2.45.221:5000 max_fails=0 fail_timeout=0;
+        server 10.2.110.13:3000 max_fails=0 fail_timeout=0;
+        server 10.2.109.195:3000 max_fails=0 fail_timeout=0;
     }
 
-    upstream upstream-default-backend {
+    upstream production-app-9-80 {
         # Load balance algorithm; empty for round robin, which is the default
         least_conn;
-        server 10.2.157.13:8080 max_fails=0 fail_timeout=0;
+        server 10.2.78.26:3000 max_fails=0 fail_timeout=0;
+        server 10.2.59.22:3000 max_fails=0 fail_timeout=0;
+        server 10.2.96.249:3000 max_fails=0 fail_timeout=0;
+        server 10.2.32.21:3000 max_fails=0 fail_timeout=0;
+        server 10.2.114.177:3000 max_fails=0 fail_timeout=0;
+        server 10.2.83.20:3000 max_fails=0 fail_timeout=0;
+        server 10.2.118.111:3000 max_fails=0 fail_timeout=0;
+        server 10.2.26.23:3000 max_fails=0 fail_timeout=0;
+        server 10.2.35.150:3000 max_fails=0 fail_timeout=0;
+        server 10.2.79.125:3000 max_fails=0 fail_timeout=0;
+        server 10.2.157.165:3000 max_fails=0 fail_timeout=0;
     }
 
-    upstream production-app-3-80 {
+    upstream production-app-5-80 {
         # Load balance algorithm; empty for round robin, which is the default
         least_conn;
-        server 10.2.79.124:3000 max_fails=0 fail_timeout=0;
-        server 10.2.82.66:3000 max_fails=0 fail_timeout=0;
-        server 10.2.45.219:3000 max_fails=0 fail_timeout=0;
-        server 10.2.59.21:3000 max_fails=0 fail_timeout=0;
+        server 10.2.21.37:9292 max_fails=0 fail_timeout=0;
+        server 10.2.65.105:9292 max_fails=0 fail_timeout=0;
     }
 
-    upstream production-app-9-80 {
+    upstream production-app-7-80 {
         # Load balance algorithm; empty for round robin, which is the default
         least_conn;
-        server 10.2.96.249:3000 max_fails=0 fail_timeout=0;
-        server 10.2.157.165:3000 max_fails=0 fail_timeout=0;
-        server 10.2.114.177:3000 max_fails=0 fail_timeout=0;
-        server 10.2.118.111:3000 max_fails=0 fail_timeout=0;
-        server 10.2.79.125:3000 max_fails=0 fail_timeout=0;
-        server 10.2.78.26:3000 max_fails=0 fail_timeout=0;
-        server 10.2.59.22:3000 max_fails=0 fail_timeout=0;
-        server 10.2.35.150:3000 max_fails=0 fail_timeout=0;
-        server 10.2.32.21:3000 max_fails=0 fail_timeout=0;
-        server 10.2.83.20:3000 max_fails=0 fail_timeout=0;
-        server 10.2.26.23:3000 max_fails=0 fail_timeout=0;
+        server 10.2.114.143:3000 max_fails=0 fail_timeout=0;
+        server 10.2.79.126:3000 max_fails=0 fail_timeout=0;
+        server 10.2.45.155:3000 max_fails=0 fail_timeout=0;
+        server 10.2.35.105:3000 max_fails=0 fail_timeout=0;
+        server 10.2.50.44:3000 max_fails=0 fail_timeout=0;
+        server 10.2.149.135:3000 max_fails=0 fail_timeout=0;
+    }
+
+    upstream production-app-8-80 {
+        # Load balance algorithm; empty for round robin, which is the default
+        least_conn;
+        server 10.2.53.23:5000 max_fails=0 fail_timeout=0;
+        server 10.2.45.221:5000 max_fails=0 fail_timeout=0;
+        server 10.2.35.91:5000 max_fails=0 fail_timeout=0;
+        server 10.2.110.22:5000 max_fails=0 fail_timeout=0;
     }
 
     server {
```

This caused the NGINX ingress controller to reload its configuration several
times per minute, making these shutting down workers pile up until the pod got
`OOMKilled`.

Things got a lot better once I upgraded the NGINX ingress controller to a
fixed version and specified the `--sort-backends=true` command line flag.

{{< figure src="/images/production-ingress/ingress-reloads.png" caption="Number of unnecessary reloads went down to zero after fix." alt="Grafana dashboard showing number of nginx-ingress configuration reloads." >}}

Thanks to [@aledbf](https://github.com/aledbf) for his assistance in finding and
fixing this bug!

### Further Minizing Config Reloads

The lesson here is to keep in mind that _configuration reloads are expensive
operations_ and it's a good idea to avoid those especially when proxying
WebSocket connections. This is why we decided to create a specific ingress
controller deployment just for proxying these long-running connections.

In our case, changes to WebSocket applications happen much less frequently
than other applications; by using a separate ingress controller, we avoid
reloading the configuration for the WebSocket ingress whenever there are
changes (or scaling events/restarts) to other applications.

Separating the deployment also gave us the ability to use a different ingress
configuration that's more suited to long-running connections.

#### Fine-Tune Pod Autoscalers

Since NGINX ingress uses pod IPs as upstream servers, every time the list of
endpoints for a given `Service` changes, the ingress configuration must be
regenerated and reloaded. Thus, if you are observing frequent autoscaling events
for your applications during normal load, it might be a sign that your
`HorizontalPodAutoscalers` need adjustment.

{{< figure src="/images/production-ingress/hpa.png" caption="HPA in action during peak hours." alt="Grafana dashboard showing the Kubernetes autoscaler in action." >}}

Another thing that most people don't realize is that the horizontal pod
autoscaler have a back-off timer that prevents the same target to be
scaled several times in a short period.

```text
Name:                                                   <app>
Namespace:                                              production
Labels:                                                 <none>
Annotations:                                            <none>
CreationTimestamp:                                      Fri, 23 Jun 2017 11:41:59 -0300
Reference:                                              Deployment/<app>
Metrics:                                                ( current / target )
  resource cpu on pods  (as a percentage of request):   46% (369m) / 60%
Min replicas:                                           8
Max replicas:                                           20
Conditions:
  Type                  Status  Reason                  Message
  ----                  ------  ------                  -------
  AbleToScale           False   BackoffBoth             the time since the previous scale is still within both the downscale and upscale forbidden windows
  ScalingActive         True    ValidMetricFound        the HPA was able to succesfully calculate a replica count from cpu resource utilization (percentage of request)
  ScalingLimited        True    TooFewReplicas          the desired replica count was less than the minimum replica count
Events:
  FirstSeen     LastSeen        Count   From                            SubObjectPath   Type            Reason                  Message
  ---------     --------        -----   ----                            -------------   --------        ------                  -------
  14d           10m             39      horizontal-pod-autoscaler                       Normal          SuccessfulRescale       New size: 10; reason: cpu resource utilization (percentage of request) above target
  14d           3m              69      horizontal-pod-autoscaler                       Normal          SuccessfulRescale       New size: 8; reason: All metrics below target
```

According to the default value for the `--horizontal-pod-autoscaler-upscale-delay`
flag in
[kube-controller-manager](https://kubernetes.io/docs/admin/kube-controller-manager/),
if your application scaled up, it won't be able to scale up again for 3 minutes.

Thus, in case your application **really** experiences an increased load, it
might take ~4 minutes (3m from the autoscaler back-off + ~1m from the metrics
sync) for the autoscaler to react to the increased load, which might be just
enough time for your service to degrade.

## References

- [Tuning NGINX for Performance](https://www.nginx.com/blog/tuning-nginx/)
- [How TCP backlog works in Linux](http://veithen.github.io/2014/01/01/how-tcp-backlog-works-in-linux.html)
- [How TCP Sockets Work](https://eklitzke.org/how-tcp-sockets-work)
- [Netfilter Conntrack Memory Usage](https://johnleach.co.uk/words/372/netfilter-conntrack-memory-usage)
- [Optimizing web servers for high throuhgput and low latency](https://blogs.dropbox.com/tech/2017/09/optimizing-web-servers-for-high-throughput-and-low-latency/)
- [Container isolation gone wrong](https://sysdig.com/blog/container-isolation-gone-wrong/)

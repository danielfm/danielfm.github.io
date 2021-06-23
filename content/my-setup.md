---
title: My Setup
author: Daniel Martins
date: 2021-03-22
tags: [setup, hardware, software]
---

Not that anyone's interested in this, but I thought about sharing more information about my setup and how it's working for me, so here it is.

**Note:** This is a work in progress and things keeps changing all the time, so the information below is most likely outdated.

### Hardware

#### Lenovo Thinkpad T480

I use a [Thinkpad T480](https://www.laptopmag.com/reviews/laptops/lenovo-thinkpad-t480) running Arch Linux as my daily driver.

My current installation has a little more focus on security and privacy than previous iterations, so I spent a little more time setting up Secure Boot with my own keys, [LVM on LUKS](https://wiki.archlinux.org/index.php/Dm-crypt/Encrypting_an_entire_system#LVM_on_LUKS) for full disk encryption, two-factor authentication during login with pamu2f + [YubiKey](https://www.yubico.com/br/product/yubikey-5-nfc/) (I also have a [Ledger Nano S](https://shop.ledger.com/products/ledger-nano-s) as a backup) and `ufw` firewall configuration that denies all traffic except for the ones I explicitly want. I also try to keep a VPN running at all times, but I'm still evolving this bit.

I keep the [machine configuration with Ansible](https://github.com/danielfm/archlinux-workstation), which was particularly useful when I had two laptops (the other one was an old Dell which is now in use by my partner after her laptop went dead) that I wanted to run with the same configuration.

##### Things to improve

I want to migrate to [Btrfs](https://wiki.archlinux.org/index.php/Dm-crypt/Encrypting_an_entire_system#Btrfs_subvolumes_with_swap), which has native support for snapshots. This is a nice feature to have in order to protect against upgrade issues.

In one occasion, I interrupted the upgrade process by mistake, which caused the kernel images from not being generated, and the system stopped booting. Luckily I had taken a snapshot with [Timeshift](https://github.com/teejee2008/timeshift) prior to upgrading, and I was able to restore the snapshot, but the process of taking and restoring snapshots is much easier and faster in Btrfs. I could even take snapshots automatically before applying system updates.

Going slightly off-topic, I would also like to experiment with VPN router devices in order to make VPN usage simpler and more pervasive in my household.

#### Monitors

| Model          | Size | Resolution | Position  |
|----------------|:----:|------------|-----------|
| LG 29WK500/50S | 29"  | 2560x1080  | Landscape |
| Dell U2412M    | 24"  | 1920x1200  | Portrait  |

It's impossible for me to work with just the laptop built-in display.

I like to use the display in portrait position for reading articles and the other one for splitting between text editor, web browsers and terminal windows, all that arranged in different workspaces. I use a [i3wm](https://i3wm.org/), a tiling window manager for simplifying the task of navigating between the different windows in different workspaces and displays with the keyboard.

{{< figure src="/images/my-setup/desk.jpg" caption="My monitor disposition." alt="Desk with monitors, keyboard and trackball" >}}

##### Things to improve

This LG is crap. At least I got it cheap. The plastic cover is fragile and the matte surface scratches easily. Also, I currently have an issue where the monitor turns off right after turning it on, especially after using the monitor for several hours straight. The problem goes away after disconnecting the display from the power supply for a few hours. It's really annoying.

The Dell display is very good, but it's starting to age. I might buy myself a couple of 4k displays someday.

#### ErgoDox EZ Keyboard

A few years back, I used a Macbook Pro as my work computer. I was one of the many users that were affected by the terrible build quality of the built-in "butterfly" keyboard, so I began considering using an external keyboard.

Regarding the ergonomics, one issue I had was occasional shoulder and wrist pain, which was most likely caused by the effort I had to make to keep my fingers lined up with the key rows while touch typing. Also, as an old [Emacs](https://www.gnu.org/software/emacs/) user, other common cause of pain was the infamous [Emacs pinky](https://ergoemacs.org/emacs/emacs_pinky.html). I tried to do the usual change of mapping the `Caps Lock` key to `Ctrl`, to make the key easier to reach, but that only helped so much.

After some research, I decided to purchase myself a programmable split keyboard, and the one I chose was the [ErgoDox EZ](https://ergodox-ez.com/).

With ErgoDox EZ, I managed to move the `Ctrl` key to my thumbs, causing much less strain on my pinkies. I also heavily changed the default layout to fit my needs. To do that, I used [WhatPulse](https://whatpulse.org/) for a while, in order to identify the most pressed keys and gradually changing the keyboard layout towards better ergonomics for my usage. Now I can type for hours straight without busting my arms and hands. You can check out my custom layout [here](https://github.com/danielfm/ergodox-layout).

The keyboard is built like a tank. It will probably outlive every other piece of hardware I have, so the high price tag is definitely worth it!

##### Things to improve

Nothing so far.

#### Kensington Orbit Trackball

By using an external keyboard, I had to start using an external pointing device. I used an old Microsoft mouse for a while before getting myself a [Kensington Orbit](https://www.kensington.com/p/products/electronic-control-solutions/trackball-products/orbit-trackball-with-scroll-ring/) trackball.

At first, I considered buying myself a Magic Trackpad 2 but one of these is way too expensive here in Brazil. In the end I decided to try a trackball, which is something I was curious about and wanted to try for quite some time.

This was a nice ergonomics improvement, as I don't have to move my arm around in order to move the pointer. It took me a few weeks to regain the same precision I had when using a traditional mouse or trackpad device, but I feel much more comfortable now.

##### Things to improve

The Orbit build quality is also very good. The only downside for me was the scroll ring rubber cover, which sometimes gets in the way when spinning the scroll ring and builds up grease and dirt. I eventually removed the rubber, as you can see in the picture below.

{{< figure src="/images/my-setup/keyboard-trackpad.jpg" caption="The power duo." alt="ErgoDox EZ and Kensington Orbit trackpad" >}}

If a nice trackpad wasn't so damn expensive around here, I would give that a try.

#### Xiaomi Mi A2 Android Phone

After playing around with custom Android ROMs for a while in my old Samsung J7, I decided I wanted to try a more security and privacy oriented ROM, and [CalyxOS](https://calyxos.org/) caught my attention.

It's supposed to offer similar security features as [GrapheneOS](https://grapheneos.org/), at least for my threat model, but without compromising usability, so I would still be able to use apps for banking, food delivery, and others that require Google Services to work.

Since I was short on money, I decided to buy myself a Xiaomi Mi A2, which is the only budget phone supported by CalyxOS.

CalyxOS is very stable, and the fact it's not running Google bloatware makes the battery last longer, which is a plus in a device with more limited battery capacity like this.

##### Things to improve

I thought the lack of NFC and a headphone jack wouldn't be too much trouble, but I kind of regret that decision.

My next phone will be a second-hand Pixel, or whatever device CalyxOS will happen to support in the future.

#### YubiKey 5 NFC and Ledger Nano S

I use [YubiKey](https://www.yubico.com/br/product/yubikey-5-nfc/) as my main hardware token, and keep the [Ledger Nano S](https://shop.ledger.com/products/ledger-nano-s) in a safe place as a backup. I might buy myself another YubiKey in the future and keep the Ledger only for handling cryptocurrencies.

The YubiKey build quality is great. The performance is decent (much faster than in Leger Nano S), and I feel much safer using these devices than I felt when I had to rely on other methods for multi-factor verification. I also no longer have to keep private SSH and PGP keys available in my computer's file system, and the U2F / WebAuthn support is great.

The PGP support in the Series 5 key is nice and enables me to use these devices for a lot of different things, such as authenticating to remote machines, signing/encrypting messages, managing passwords, etc.

Aside from the obvious usage scenarios, I also use the hardware tokens in my local machine as a second factor and for authenticating `sudo`.

##### Things to improve

The only thing I wish is for more services to properly support hardware tokens and standards like WebAuthn. There are still a lot of sensitive services that still rely on TOTP as second factor (like ProtonMail) and this drives me crazy.

### Software

#### Desktop

I use [i3wm](https://i3wm.org/) as the window manager, which helps me spread editors, terminals, browsers and other apps across the different displays and navigate between them quickly without leaving the keyboard.

More details on how my desktop is configured can be found in [this Ansible configuration](https://github.com/danielfm/archlinux-workstation).

{{< figure src="https://github.com/danielfm/archlinux-workstation/raw/master/screenshot.png" caption="Desktop screenshot, possibly outdated." alt="My i3wm configuration with some windows" >}}

##### Things to improve

Nothing in particular, but I keep trying small changes to my workflow to see how that affects my productivity.

#### CalyxOS

I use the same device both for work and my personal life. In order to separate the two, I use a separate Work profile for work-related apps, such as Slack, [Bitwarden](https://bitwarden.com).

The work profile is also configured with always-on VPN to ensure all work related traffic flows through an encrypted tunnel. The VPN service I use also supports a kill switch, so that no traffic is allowed unless the VPN is up and running.

I keep social networks and other privacy-invasive apps in a separate user. The friction of swapping between users is enough to motivate me to use these applications as little as possible.

I don't keep a Google account signed in this device, and my personal profile also have an always-on VPN with a kill switch enabled.

Some of the apps I use regularly: [AntennaPod](https://f-droid.org/en/packages/de.danoeh.antennapod/), [DAVx5](https://f-droid.org/en/packages/at.bitfire.davdroid/), [Element](https://f-droid.org/en/packages/im.vector.app/), [Etesync](https://www.etesync.com/), [Infinity](https://f-droid.org/en/packages/ml.docilealligator.infinityforreddit/), [NewPipe](https://f-droid.org/en/packages/org.schabi.newpipe/), [OpenTasks](https://f-droid.org/en/packages/org.dmfs.tasks/), [Orgzly](https://f-droid.org/en/packages/com.orgzly/), [Password Store](https://f-droid.org/en/packages/dev.msfjarvis.aps/), [Signal](https://signal.org/android/apk/), [Yubico Authenticator](https://f-droid.org/en/packages/com.yubico.yubioath/).

##### Things to improve

Nothing. All apps I need work 100% in CalyxOS. I don't have to give up anything in order to have some privacy.

Actually, I only had to give up using Android Auto in my car console, but it seems CalyxOS team is working to support even that!

### VPN Services

#### Private Internet Access

[PIA](https://privateinternetaccess.com) offers good trade-off between privacy, security and price, at least for my threat model. Before that I used [Mullvad](https://mullvad.net), which is awesome, but a bit too expensive for someone who doesn't get paid in USD/EUR like me.

### Self-Hosted Services

#### Syncthing

I started self-hosting [Syncthing](https://syncthing.net/) from an old Raspberry Pi for syncing files across devices. It's surprising how well this works!

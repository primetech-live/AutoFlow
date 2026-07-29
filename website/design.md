# AutoFlow --- design.md

### Design system for the marketing website (single HTML file, no framework)

---

# 0. Brief (Pinned Down)

- **Product:** AutoFlow --- a local-first deployment orchestrator.
  Desktop app (Electron) + CLI sharing one deployment engine.
- **Audience:** Developers, freelancers, startups and small teams
  deploying to their own VPS.
- **Primary Goal:** Convince visitors that AutoFlow is a precision
  deployment tool, then drive them to install the desktop app or CLI.
- **Visual Philosophy:** Industrial. Mechanical. Purpose-built. Every
  visual element should feel engineered rather than decorative.

> **Important:** Keep the existing visual language.
>
> - Instrument panel aesthetic
> - Graphite + Brass + Signal palette
> - Hairline borders
> - Flat surfaces
> - IBM Plex Mono labels
> - Terminal-first identity
> - No glassmorphism
> - No colorful SaaS gradients
> - No floating blobs

The website is both a marketing page **and** a product showcase.

---

# 1. Design Language

## Keywords

- Precision
- Mechanical
- Local-first
- Secure
- Professional
- Engineering Hardware
- Mission Control
- Instrument Panel

Every section should look like another module inside one large control
console.

---

# 2. Color Palette

| Name         | Hex       | Usage                                                          |
| ------------ | --------- | -------------------------------------------------------------- |
| Graphite     | `#17181C` | Page background                                                |
| Panel        | `#1F2126` | Raised panels and surfaces                                     |
| Hairline     | `#33353C` | Borders, dividers and grid lines                               |
| Primary Blue | `#2563EB` | Primary accent, CTA, active states, section accents            |
| Signal Blue  | `#60A5FA` | Live status, deployment indicators, SSH states, success pulses |
| Bone         | `#EDE9E1` | Primary text                                                   |
| Slate        | `#8B8D93` | Secondary text, captions and timestamps                        |

## Color Rules

- **Primary Blue** is the primary brand accent and replaces the previous Brass color completely.
- **Signal Blue** is reserved for live system states, deployment progress, SSH connectivity and active indicators.
- Never use both blues on the same UI element.
  - **Primary Blue** = controls, buttons, active navigation, corner ticks, links and interactive elements.
  - **Signal Blue** = live status, deployment progress, success indicators and terminal activity.
- No gradients.
- Flat colors only.
- The only permitted gradient is an extremely subtle radial vignette behind the hero terminal (Graphite → Panel).
- No green success states.
- No orange or gold accents.
- Blue is the only accent color throughout the interface.

# 3. Typography

Keep exactly the existing typography system.

- Archivo
- Inter
- IBM Plex Mono

No changes.

---

# 4. Layout Philosophy

The page tells one story.

Visitor Flow

Hero ↓ Problem ↓ Solution ↓ Show the Product ↓ Explain the Workflow ↓
Build Trust ↓ CLI ↓ Pricing ↓ FAQ ↓ Install

Every section is separated using hairline dividers and mono section
labels.

---

# 5. Website Architecture

## 1. Header

- Logo
- Navigation
- Install button

Navigation

- Features
- Showcase
- CLI
- Pricing
- Docs

Sticky after scrolling.

---

## 2. Hero

Keep existing hero.

Includes

- Headline
- Description
- Primary CTA
- Secondary CTA
- Animated terminal

The animated terminal remains the visual centerpiece.

---

## 3. The Problem

Explain the real deployment pain.

Examples

- SSH keys everywhere
- Manual VPS setup
- Docker complexity
- Vendor lock-in
- Fear of breaking production

Visual

Split panel

Left Problem copy

Right Minimal engineering diagram

---

## 4. Features

Grid of 6--8 feature modules.

First three cards remain

- Local First
- Zero Config
- Zero Downtime

Additional cards

- Secure Vault
- Automatic SSL
- Docker Automation
- Rollback
- Deployment Logs

The old "Three Pillars" become premium feature cards.

---

## 5. Product Showcase

Large showcase section.

Purpose

Show that AutoFlow is a real desktop application.

Includes

Desktop App

CLI

Project Dashboard

Deployment History

Server Screen

Settings

Large screenshots inside instrument-style frames.

The previous "Two Surfaces" concept belongs here.

---

## 6. How It Works

Use the existing Deploy Sequence Strip.

This remains the signature animation.

The 13 deployment stages are preserved.

No changes to its visual design.

---

## 7. Supported Technologies

Grid

Laravel

Node.js

React

Next.js

Vue

Python

Go

Docker

Nginx

Each technology appears as a clean engraved badge.

---

## 8. CLI

Dedicated CLI section.

Contains

Installation command

Common commands

Copy button

Small terminal example

Keep mono styling.

---

## 9. Pricing

Simple pricing.

Free

Pro

Enterprise (Coming Soon)

No exaggerated pricing cards.

Remain industrial.

---

## 10. FAQ

Accordion.

Minimal animation.

Hairline separators only.

---

## 11. Final CTA

Large install panel.

Contains

Desktop Download

CLI Install

Documentation

GitHub

Keep existing CTA band style.

---

## 12. Footer

Specification plate aesthetic.

Links

Documentation

Changelog

Privacy

Terms

GitHub

PrimeTech

Version

Copyright

---

# 6. Existing Signature Components

The following existing designs MUST remain.

✓ Hero Terminal

✓ Three Pillars (inside Features)

✓ Deploy Sequence Strip (inside How It Works)

✓ Vault Spec Sheet (inside Security feature)

✓ Two Surfaces (inside Product Showcase)

✓ CTA Band

Only their placement changes.

---

# 7. Motion

Unchanged.

Hero terminal

Deploy strip

Hover underline

Reduced motion support

No unnecessary animation.

---

# 8. Copywriting

Technical.

Specific.

Honest.

Avoid hype.

Use engineering language.

---

# 9. Accessibility

Keep existing accessibility requirements.

---

# 10. Build Checklist

1.  Header
2.  Hero
3.  Problem
4.  Features
5.  Product Showcase
6.  How It Works
7.  Supported Technologies
8.  CLI
9.  Pricing
10. FAQ
11. Final CTA
12. Footer

---

# Final Principle

AutoFlow should feel less like a marketing website and more like the
documentation panel of an expensive engineering instrument.

Visitors should finish scrolling with two impressions:

1.  This software is trustworthy.
2.  This software was built by engineers for engineers.

Marketing exists only to explain the product.

The product itself remains the hero.

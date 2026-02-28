---
title: LaCAM (Lazy CBS)
description: A hybrid approach balancing optimality and scalability.
---

**LaCAM (Lazy CBS)** is natively supported in `src/solver/lacam.rs` as a middle-ground algorithmic approach.

## The Theory

While CBS tries to solve all conflicts globally (scaling poorly), and PIBT acts completely reactively (sacrificing optimal pathing for speed), LaCAM uses a "lazy" state space execution. 

LaCAM guarantees that it will eventually find a valid path while drastically pruning the search tree by only instantiating configuration nodes when absolutely required. It continuously verifies partial joint actions for validity instead of relying on a rigid conflict tree.

## Fault Recovery Under LaCAM

In MAFIS, LaCAM performs exceptionally well when small perturbations occur in low-density systems. It can "stitch" pathing holes left by a Breakdown Fault slightly faster than vanilla CBS, but still risks computation spikes if the stranded agent blocks a critical, one-way corridor.

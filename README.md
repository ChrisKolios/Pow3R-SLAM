# Pow3R-SLAM: Real-Time RGB-D SLAM with 3D Reconstruction Priors

**Christopher Kolios<sup>1</sup>, Ishaan Mehta<sup>1</sup>, Sasa Janjic<sup>2</sup>, Yeganeh Bahoo<sup>1</sup>, Sajad Saeedi<sup>3</sup>**

<sup>1</sup>Toronto Metropolitan University · <sup>2</sup>University of Windsor · <sup>3</sup>University College London

**[Project page](https://chriskolios.github.io/Pow3R-SLAM/)** · **[Paper](https://arxiv.org/abs/2609.38054)** · **[Video](https://chriskolios.github.io/Pow3R-SLAM/#primary-video)**

![Pow3R-SLAM pipeline](https://chriskolios.github.io/Pow3R-SLAM/Fig2_pipeline_website_1200.png)

Pow3R-SLAM is a real-time RGB-D SLAM system that uses [Pow3R](https://github.com/naver/pow3r)
for tracking and mapping. It builds on [MASt3R-SLAM](https://github.com/rmurai0610/MASt3R-SLAM),
a monocular system built on two-view 3D reconstruction priors, and extends it to RGB-D by using
the sensor depth as a **prior on the network's prediction, rather than as geometry to fuse**.
Where the depth image has holes, the network infers the missing depth from the two views. Where
it has readings, they condition the pointmap and make it metric.

## Results at a glance

Evaluated against MASt3R-SLAM, following its protocol, on 24 sequences from TUM RGB-D, 7-Scenes
and Replica:

| | Pow3R-SLAM vs. MASt3R-SLAM |
|---|---|
| Wall time | 1.6× faster |
| Mean trajectory error | 15% lower |
| Unscaled trajectory error | 3.1× lower |
| Chamfer distance | 30% lower, with denser maps |
| Hybrid variant | 2.1× faster, 25.3 FPS, with improved tracking and mapping accuracy |

Against ORB-SLAM3 in RGB-D mode, Pow3R-SLAM is more accurate on TUM, 7-Scenes and ETH3D-SLAM, and
completes every TUM sequence. It can struggle on a small set of self-similar scenes, and both the paper
and the project page show that case as well.

The [project page](https://chriskolios.github.io/Pow3R-SLAM/) has an interactive 3D comparison
of the maps and trajectories, a depth explorer showing how the prediction responds to sparse
and noisy sensor depth, and side-by-side videos.

## Code

The code will be released in this repository after the review process.

## Citation

```bibtex
@misc{kolios2026pow3rslam,
  title         = {{Pow3R-SLAM}: Real-Time {RGB-D} {SLAM} with {3D} Reconstruction Priors},
  author        = {Kolios, Christopher and Mehta, Ishaan and Janjic, Sasa and
                   Bahoo, Yeganeh and Saeedi, Sajad},
  year          = {2026},
  eprint        = {2609.38054},
  archivePrefix = {arXiv},
  primaryClass  = {cs.RO}
}
```

## Acknowledgment

We acknowledge the support of the Natural Sciences and Engineering Research Council of Canada
(NSERC).

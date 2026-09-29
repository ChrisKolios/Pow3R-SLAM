(function(){ var PS = window.PS = window.PS || {};
PS.depth = {
 "frames": [
  {
   "id": "gamepad",
   "label": "TUM RGB-D fr1/desk - black game controller on a mousepad",
   "rgb": "supplementary/depth/gamepad_rgb.png",
   "width": 512,
   "height": 384,
   "depth_range_m": [
    0.439,
    1.323
   ],
   "conditions": [
    {
     "id": "full",
     "label": "sensor depth as recorded",
     "sensor": "supplementary/depth/gamepad_full_sensor.png",
     "pred": "supplementary/depth/gamepad_full_pred.png",
     "valid_pct": 82.8,
     "pred_vs_sensor_cm": 0.2,
     "ate_mean_m": 0.0257,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel, shipping default (Table IV, L5)"
    },
    {
     "id": "k50",
     "label": "keep 50 % of depth pixels",
     "sensor": "supplementary/depth/gamepad_k50_sensor.png",
     "pred": "supplementary/depth/gamepad_k50_pred.png",
     "valid_pct": 41.4,
     "pred_vs_sensor_cm": 0.2,
     "ate_mean_m": 0.026,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "k10",
     "label": "keep 10 % of depth pixels",
     "sensor": "supplementary/depth/gamepad_k10_sensor.png",
     "pred": "supplementary/depth/gamepad_k10_pred.png",
     "valid_pct": 8.3,
     "pred_vs_sensor_cm": 0.1,
     "ate_mean_m": 0.028,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "k03",
     "label": "keep 3 % of depth pixels",
     "sensor": "supplementary/depth/gamepad_k03_sensor.png",
     "pred": "supplementary/depth/gamepad_k03_pred.png",
     "valid_pct": 2.5,
     "pred_vs_sensor_cm": 0.2,
     "ate_mean_m": 0.026,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "n005",
     "label": "noise sigma = 0.05",
     "sensor": "supplementary/depth/gamepad_n005_sensor.png",
     "pred": "supplementary/depth/gamepad_n005_pred.png",
     "valid_pct": 82.8,
     "pred_vs_sensor_cm": 0.3,
     "ate_mean_m": 0.034,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "n01",
     "label": "noise sigma = 0.1",
     "sensor": "supplementary/depth/gamepad_n01_sensor.png",
     "pred": "supplementary/depth/gamepad_n01_pred.png",
     "valid_pct": 82.8,
     "pred_vs_sensor_cm": 0.6,
     "ate_mean_m": 0.056,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "n02",
     "label": "noise sigma = 0.2",
     "sensor": "supplementary/depth/gamepad_n02_sensor.png",
     "pred": "supplementary/depth/gamepad_n02_pred.png",
     "valid_pct": 82.8,
     "pred_vs_sensor_cm": 1.5,
     "ate_mean_m": 0.197,
     "ate_note": "mean Sim(3) keyframe ATE with this perturbation applied to every frame. 23/24 sequences (one diverges at this noise level)"
    },
    {
     "id": "n04",
     "label": "noise sigma = 0.4",
     "sensor": "supplementary/depth/gamepad_n04_sensor.png",
     "pred": "supplementary/depth/gamepad_n04_pred.png",
     "valid_pct": 82.8,
     "pred_vs_sensor_cm": 6.3,
     "ate_mean_m": 0.609,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "none",
     "label": "no depth (RGB only)",
     "sensor": "supplementary/depth/gamepad_none_sensor.png",
     "pred": "supplementary/depth/gamepad_none_pred.png",
     "valid_pct": 0.0,
     "pred_vs_sensor_cm": 38.5,
     "ate_mean_m": 0.0711,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with no sensor depth anywhere, intrinsics still given (Table IV, L2)"
    }
   ]
  },
  {
   "id": "window",
   "label": "TUM RGB-D fr1/room - backlit windows",
   "rgb": "supplementary/depth/window_rgb.png",
   "width": 512,
   "height": 384,
   "depth_range_m": [
    1.244,
    3.233
   ],
   "conditions": [
    {
     "id": "full",
     "label": "sensor depth as recorded",
     "sensor": "supplementary/depth/window_full_sensor.png",
     "pred": "supplementary/depth/window_full_pred.png",
     "valid_pct": 66.8,
     "pred_vs_sensor_cm": 1.2,
     "ate_mean_m": 0.0257,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel, shipping default (Table IV, L5)"
    },
    {
     "id": "k50",
     "label": "keep 50 % of depth pixels",
     "sensor": "supplementary/depth/window_k50_sensor.png",
     "pred": "supplementary/depth/window_k50_pred.png",
     "valid_pct": 33.4,
     "pred_vs_sensor_cm": 1.2,
     "ate_mean_m": 0.026,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "k10",
     "label": "keep 10 % of depth pixels",
     "sensor": "supplementary/depth/window_k10_sensor.png",
     "pred": "supplementary/depth/window_k10_pred.png",
     "valid_pct": 6.7,
     "pred_vs_sensor_cm": 1.2,
     "ate_mean_m": 0.028,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "k03",
     "label": "keep 3 % of depth pixels",
     "sensor": "supplementary/depth/window_k03_sensor.png",
     "pred": "supplementary/depth/window_k03_pred.png",
     "valid_pct": 2.0,
     "pred_vs_sensor_cm": 1.2,
     "ate_mean_m": 0.026,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "n005",
     "label": "noise sigma = 0.05",
     "sensor": "supplementary/depth/window_n005_sensor.png",
     "pred": "supplementary/depth/window_n005_pred.png",
     "valid_pct": 66.8,
     "pred_vs_sensor_cm": 1.5,
     "ate_mean_m": 0.034,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "n01",
     "label": "noise sigma = 0.1",
     "sensor": "supplementary/depth/window_n01_sensor.png",
     "pred": "supplementary/depth/window_n01_pred.png",
     "valid_pct": 66.8,
     "pred_vs_sensor_cm": 2.3,
     "ate_mean_m": 0.056,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "n02",
     "label": "noise sigma = 0.2",
     "sensor": "supplementary/depth/window_n02_sensor.png",
     "pred": "supplementary/depth/window_n02_pred.png",
     "valid_pct": 66.8,
     "pred_vs_sensor_cm": 5.6,
     "ate_mean_m": 0.197,
     "ate_note": "mean Sim(3) keyframe ATE with this perturbation applied to every frame. 23/24 sequences (one diverges at this noise level)"
    },
    {
     "id": "n04",
     "label": "noise sigma = 0.4",
     "sensor": "supplementary/depth/window_n04_sensor.png",
     "pred": "supplementary/depth/window_n04_pred.png",
     "valid_pct": 66.8,
     "pred_vs_sensor_cm": 22.6,
     "ate_mean_m": 0.609,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "none",
     "label": "no depth (RGB only)",
     "sensor": "supplementary/depth/window_none_sensor.png",
     "pred": "supplementary/depth/window_none_pred.png",
     "valid_pct": 0.0,
     "pred_vs_sensor_cm": 154.5,
     "ate_mean_m": 0.0711,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with no sensor depth anywhere, intrinsics still given (Table IV, L2)"
    }
   ]
  },
  {
   "id": "prior",
   "label": "TUM RGB-D fr1/xyz - desk with two black LCD monitors",
   "rgb": "supplementary/depth/prior_rgb.png",
   "width": 512,
   "height": 384,
   "depth_range_m": [
    0.671,
    3.117
   ],
   "conditions": [
    {
     "id": "full",
     "label": "sensor depth as recorded",
     "sensor": "supplementary/depth/prior_full_sensor.png",
     "pred": "supplementary/depth/prior_full_pred.png",
     "valid_pct": 78.2,
     "pred_vs_sensor_cm": 0.5,
     "ate_mean_m": 0.0257,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel, shipping default (Table IV, L5)"
    },
    {
     "id": "k50",
     "label": "keep 50 % of depth pixels",
     "sensor": "supplementary/depth/prior_k50_sensor.png",
     "pred": "supplementary/depth/prior_k50_pred.png",
     "valid_pct": 39.1,
     "pred_vs_sensor_cm": 0.4,
     "ate_mean_m": 0.026,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "k10",
     "label": "keep 10 % of depth pixels",
     "sensor": "supplementary/depth/prior_k10_sensor.png",
     "pred": "supplementary/depth/prior_k10_pred.png",
     "valid_pct": 7.8,
     "pred_vs_sensor_cm": 0.5,
     "ate_mean_m": 0.028,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "k03",
     "label": "keep 3 % of depth pixels",
     "sensor": "supplementary/depth/prior_k03_sensor.png",
     "pred": "supplementary/depth/prior_k03_pred.png",
     "valid_pct": 2.3,
     "pred_vs_sensor_cm": 0.5,
     "ate_mean_m": 0.026,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "n005",
     "label": "noise sigma = 0.05",
     "sensor": "supplementary/depth/prior_n005_sensor.png",
     "pred": "supplementary/depth/prior_n005_pred.png",
     "valid_pct": 78.2,
     "pred_vs_sensor_cm": 0.7,
     "ate_mean_m": 0.034,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "n01",
     "label": "noise sigma = 0.1",
     "sensor": "supplementary/depth/prior_n01_sensor.png",
     "pred": "supplementary/depth/prior_n01_pred.png",
     "valid_pct": 78.2,
     "pred_vs_sensor_cm": 1.2,
     "ate_mean_m": 0.056,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "n02",
     "label": "noise sigma = 0.2",
     "sensor": "supplementary/depth/prior_n02_sensor.png",
     "pred": "supplementary/depth/prior_n02_pred.png",
     "valid_pct": 78.2,
     "pred_vs_sensor_cm": 3.0,
     "ate_mean_m": 0.197,
     "ate_note": "mean Sim(3) keyframe ATE with this perturbation applied to every frame. 23/24 sequences (one diverges at this noise level)"
    },
    {
     "id": "n04",
     "label": "noise sigma = 0.4",
     "sensor": "supplementary/depth/prior_n04_sensor.png",
     "pred": "supplementary/depth/prior_n04_pred.png",
     "valid_pct": 78.2,
     "pred_vs_sensor_cm": 11.7,
     "ate_mean_m": 0.609,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with this perturbation applied to every frame of every sequence"
    },
    {
     "id": "none",
     "label": "no depth (RGB only)",
     "sensor": "supplementary/depth/prior_none_sensor.png",
     "pred": "supplementary/depth/prior_none_pred.png",
     "valid_pct": 0.0,
     "pred_vs_sensor_cm": 27.7,
     "ate_mean_m": 0.0711,
     "ate_note": "mean Sim(3) keyframe ATE over the 24-scene panel with no sensor depth anywhere, intrinsics still given (Table IV, L2)"
    }
   ]
  }
 ],
 "colormap": {
  "name": "turbo",
  "invalid": "#000000",
  "bar": "supplementary/depth/colorbar.png"
 }
};
})();

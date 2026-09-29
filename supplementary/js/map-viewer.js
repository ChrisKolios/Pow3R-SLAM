/* map-viewer.js — side-by-side 3D map explorer.
 *
 * One WebGL canvas, one camera, two scissor passes: the left arm is drawn left
 * of the divider and the right arm right of it, so both maps are seen from
 * exactly the same viewpoint. Data arrives as classic scripts (see ps-loader).
 * Depends on THREE r147 + THREE.OrbitControls and the r147 fat-line example
 * classes (Line2 / LineMaterial), all classic builds under vendor/.
 */
(function () {
  'use strict';

  var PS = (window.PS = window.PS || {});
  var MOUNT = 'ps-map';

  /* ---------- ground-truth line ---------------------------------------
   * A 1-px THREE.Line for the ground truth vanished on the dark stage and,
   * worst of all, over the olive ETH3D maps. THREE.Line2 (the r147 "fat line"
   * example) draws a line as screen-space quads instead: its width is in
   * pixels, so it never thins out with distance, and it dashes in world units.
   * The bright dashes are backed by a wider dark line with the same dash
   * pattern, which keeps them readable over a white wall as well.
   */
  var GT_COLOR = '#ffe27a';       /* warm light yellow — see the legend swatch */
  var GT_HALO_COLOR = '#0b1220';  /* the stage background, used as an outline  */
  var GT_WIDTH_PX = 3;            /* screen-space width of the dashed line     */
  var GT_HALO_EXTRA_PX = 2.8;     /* how far the outline sticks out, in pixels */
  var TRAJ_WIDTH_PX = 2;          /* the two arm trajectories                  */

  function haveFatLines() {
    return typeof THREE !== 'undefined' &&
      !!(THREE.Line2 && THREE.LineGeometry && THREE.LineMaterial);
  }

  /* a touch thicker on a dense display, where a hairline reads thinner */
  function widthScale() {
    var pr = Math.min(window.devicePixelRatio || 1, 2);
    return 1 + 0.12 * (pr - 1);
  }

  /* ---------- palette ------------------------------------------------- */

  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      v = (v || '').trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  var COLORS = null;
  function colorFor(arm) {
    if (!COLORS) {
      COLORS = {
        pow3r: cssVar('--fig-depth', '#1f6fb5'),
        mast3r: cssVar('--fig-opt', '#b25e0e'),
        gt: GT_COLOR,
        hyb: '#3f7d58',
        L1: '#7c5aa6',
        L3: '#9a3b4b',
        L6: '#7a7f46',
        d10: '#2a7d8c',
        d03: '#8c5a2a',
        n01: '#6b5bd2',
        n02: '#a04d8a'
      };
    }
    return COLORS[arm] || '#64748b';
  }

  /* ---------- payload decoding ---------------------------------------- */

  var LITTLE_ENDIAN = (function () {
    var b = new ArrayBuffer(2);
    new DataView(b).setInt16(0, 1, true);
    return new Int16Array(b)[0] === 1;
  })();

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var n = bin.length;
    var out = new Uint8Array(n);
    for (var i = 0; i < n; i++) { out[i] = bin.charCodeAt(i); }
    return out;
  }

  /* xyz: Int16Array, little-endian, quantised to the payload's bbox:
     v = min + (q + 32768) / 65535 * (max - min)                             */
  function decodeXYZ(b64, bbox, n) {
    var bytes = b64ToBytes(b64);
    var count = n || Math.floor(bytes.length / 6);
    var q;
    if (LITTLE_ENDIAN) {
      q = new Int16Array(bytes.buffer, bytes.byteOffset, count * 3);
    } else {
      q = new Int16Array(count * 3);
      var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (var k = 0; k < q.length; k++) { q[k] = dv.getInt16(k * 2, true); }
    }
    var mn = bbox.min, mx = bbox.max;
    var sx = (mx[0] - mn[0]) / 65535, sy = (mx[1] - mn[1]) / 65535, sz = (mx[2] - mn[2]) / 65535;
    var pos = new Float32Array(count * 3);
    for (var i = 0, j = 0; i < count; i++, j += 3) {
      pos[j] = mn[0] + (q[j] + 32768) * sx;
      pos[j + 1] = mn[1] + (q[j + 1] + 32768) * sy;
      pos[j + 2] = mn[2] + (q[j + 2] + 32768) * sz;
    }
    return pos;
  }

  function matrixFrom(rows) {
    var m = new THREE.Matrix4();
    if (rows && rows.length === 16) {
      /* Matrix4.set() takes its arguments row-major, which is how the data
         files store the arm -> ground-truth transform. */
      m.set(rows[0], rows[1], rows[2], rows[3],
            rows[4], rows[5], rows[6], rows[7],
            rows[8], rows[9], rows[10], rows[11],
            rows[12], rows[13], rows[14], rows[15]);
    }
    return m;
  }

  function pointsToArray(list) {
    var n = list ? list.length : 0;
    var a = new Float32Array(n * 3);
    for (var i = 0, j = 0; i < n; i++, j += 3) {
      a[j] = list[i][0]; a[j + 1] = list[i][1]; a[j + 2] = list[i][2];
    }
    return a;
  }

  /* ---------- formatting ---------------------------------------------- */

  function num(v, digits, unit) {
    if (v == null || !isFinite(v)) { return '—'; }
    return v.toFixed(digits) + ' ' + unit;
  }

  function metricsLine(arm) {
    return 'ATE ' + num(arm.ate_sim3, 3, 'm') +
           ' · unscaled ' + num(arm.ate_se3, 3, 'm') +
           ' · Chamfer ' + num(arm.chamfer_cm, 2, 'cm');
  }

  /* ---------- component ------------------------------------------------ */

  function build(mount) {
    var U = PS.util;
    var el = U.el;

    var scenes = PS.scenes;
    if (!scenes || !Object.keys(scenes).length) {
      mount.appendChild(el('p', 'ps-empty',
        'The map data files are not part of this copy of the page.'));
      return;
    }

    var sceneIds = Object.keys(scenes).sort(function (a, b) {
      var oa = scenes[a].order == null ? 1e9 : scenes[a].order;
      var ob = scenes[b].order == null ? 1e9 : scenes[b].order;
      if (oa !== ob) { return oa - ob; }
      return a < b ? -1 : 1;
    });

    /* ---- toolbar ---- */
    var bar = el('div', 'ps-toolbar');

    function field(labelText, control, id) {
      var f = el('div', 'ps-field');
      var lab = el('label', null, labelText);
      lab.setAttribute('for', id);
      control.id = id;
      f.appendChild(lab);
      f.appendChild(control);
      return f;
    }

    var sceneSel = document.createElement('select');
    (function () {
      var byDataset = {}, dsOrder = [];
      sceneIds.forEach(function (sid) {
        var ds = scenes[sid].dataset || 'Sequences';
        if (!byDataset[ds]) { byDataset[ds] = []; dsOrder.push(ds); }
        byDataset[ds].push(sid);
      });
      dsOrder.forEach(function (ds) {
        var g = document.createElement('optgroup');
        g.label = ds;
        byDataset[ds].forEach(function (sid) {
          var o = document.createElement('option');
          o.value = sid;
          o.textContent = scenes[sid].label || sid;
          g.appendChild(o);
        });
        sceneSel.appendChild(g);
      });
    })();
    bar.appendChild(field('Sequence', sceneSel, 'ps-map-scene'));

    var leftSel = document.createElement('select');
    var rightSel = document.createElement('select');
    bar.appendChild(field('Left of the divider', leftSel, 'ps-map-left'));
    bar.appendChild(field('Right of the divider', rightSel, 'ps-map-right'));

    var alignWrap = el('div', 'ps-field');
    alignWrap.appendChild(el('span', null, 'Alignment to ground truth'));
    var alignBox = el('div', 'ps-segmented');
    alignBox.setAttribute('role', 'group');
    alignBox.setAttribute('aria-label', 'Alignment to ground truth');
    var btnSim = el('button', 'ps-btn', 'Sim(3)');
    var btnSe3 = el('button', 'ps-btn', 'SE(3) (unscaled)');
    [btnSim, btnSe3].forEach(function (b) { b.type = 'button'; b.setAttribute('aria-pressed', 'false'); });
    btnSim.setAttribute('aria-pressed', 'true');
    alignBox.appendChild(btnSim); alignBox.appendChild(btnSe3);
    alignWrap.appendChild(alignBox);
    bar.appendChild(alignWrap);

    var viewWrap = el('div', 'ps-field');
    viewWrap.appendChild(el('span', null, 'View'));
    var viewRow = el('div', 'ps-btnrow');
    var btnReset = el('button', 'ps-btn', 'Reset');
    var btnTop = el('button', 'ps-btn', 'Top view');
    var btnFit = el('button', 'ps-btn', 'Fit');
    [btnReset, btnTop, btnFit].forEach(function (b) { b.type = 'button'; viewRow.appendChild(b); });
    viewWrap.appendChild(viewRow);
    bar.appendChild(viewWrap);

    var sizeInput = document.createElement('input');
    sizeInput.type = 'range';
    sizeInput.min = '0.3'; sizeInput.max = '3'; sizeInput.step = '0.1'; sizeInput.value = '1';
    bar.appendChild(field('Point size', sizeInput, 'ps-map-size'));

    var checksWrap = el('div', 'ps-field');
    checksWrap.appendChild(el('span', null, 'Show'));
    var checks = el('div', 'ps-checks');
    function check(text, on) {
      var l = el('label', 'ps-check');
      var i = document.createElement('input');
      i.type = 'checkbox'; i.checked = !!on;
      l.appendChild(i);
      l.appendChild(document.createTextNode(text));
      checks.appendChild(l);
      return i;
    }
    var cbTraj = check('Trajectories', true);
    var cbGt = check('Ground truth', true);
    var cbKf = check('Keyframes', false);
    checksWrap.appendChild(checks);
    bar.appendChild(checksWrap);

    mount.appendChild(bar);

    var notes = el('div', 'ps-arm-notes');
    notes.hidden = true;
    mount.appendChild(notes);

    /* ---- stage ---- */
    var stage = el('div', 'ps-stage');
    var canvas = document.createElement('canvas');
    stage.appendChild(canvas);

    var divider = el('div', 'ps-divider');
    divider.setAttribute('role', 'slider');
    divider.setAttribute('tabindex', '0');
    divider.setAttribute('aria-label', 'Split position between the two maps');
    divider.setAttribute('aria-valuemin', '5');
    divider.setAttribute('aria-valuemax', '95');
    divider.setAttribute('aria-valuenow', '50');
    divider.setAttribute('aria-orientation', 'vertical');
    stage.appendChild(divider);

    var labL = el('div', 'ps-pane-label');
    var labR = el('div', 'ps-pane-label');
    var panes = el('div', 'ps-map-panes');
    panes.appendChild(labL); panes.appendChild(labR);

    var overlay = el('div', 'ps-overlay');
    var ovText = el('p', null, 'Loading the maps…');
    var ovBar = el('div', 'ps-bar');
    var ovBarFill = document.createElement('i');
    ovBar.appendChild(ovBarFill);
    var ovBtn = el('button', 'ps-btn', 'Try again');
    ovBtn.type = 'button';
    ovBtn.hidden = true;
    overlay.appendChild(ovText); overlay.appendChild(ovBar); overlay.appendChild(ovBtn);
    stage.appendChild(overlay);

    /* The pane labels live beside the stage, not inside it: on a wide screen
       they are positioned over the bottom of the view, on a phone they drop
       below it, where a 4:3 stage has no room to spare. */
    var stageWrap = el('div', 'ps-map-stagewrap');
    stageWrap.appendChild(stage);
    stageWrap.appendChild(panes);
    mount.appendChild(stageWrap);

    var legend = el('div', 'ps-legend');
    function legendItem(text, cls, color) {
      var s = el('span');
      var i = document.createElement('i');
      if (cls) { i.className = cls; }
      if (color) { i.style.borderTopColor = color; }
      s.appendChild(i);
      s.appendChild(document.createTextNode(text));
      legend.appendChild(s);
      return s;
    }
    var legL = legendItem('left arm', null, colorFor('pow3r'));
    var legR = legendItem('right arm', null, colorFor('mast3r'));
    legendItem('ground truth (dashed)', 'ps-gt');
    mount.appendChild(legend);

    var hint = el('p', 'ps-hint',
      'Drag inside the view to orbit, scroll or pinch to zoom, right-drag to pan. ' +
      'Drag the white divider (or focus it and use the left and right arrow keys) to move the split.');
    mount.appendChild(hint);

    /* ---- three.js ---- */
    var renderer, camera, controls, world;
    var gtLine = null, gtHalo = null;
    var fatMats = [];                      /* every LineMaterial in the scene */
    var lineRes = new THREE.Vector2(1, 1); /* canvas size, in CSS pixels      */
    var armNodes = {};           /* "<scene>/<arm>" -> {group, pts, traj, kf, sim3, se3} */
    var lruBuilt = [];
    var split = 0.5;
    var align = 'sim3';
    var needsRender = false;
    var rafId = 0;
    var disposed = false;
    var currentScene = null;
    var pending = [];
    var sceneDiag = 1;

    function requestRender() {
      if (disposed || needsRender) { return; }
      needsRender = true;
      rafId = requestAnimationFrame(function () {
        needsRender = false;
        draw();
      });
    }

    function initGL() {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x0b1220, 1);
      camera = new THREE.PerspectiveCamera(55, 16 / 10, 0.01, 2000);
      world = new THREE.Scene();
      controls = new THREE.OrbitControls(camera, stage);
      controls.enableDamping = false;      /* no idle animation loop */
      controls.rotateSpeed = 0.7;
      controls.zoomSpeed = 0.9;
      controls.addEventListener('change', requestRender);
      canvas.addEventListener('webglcontextlost', onContextLost, false);
      canvas.addEventListener('webglcontextrestored', onContextRestored, false);
      resize();
    }

    function onContextLost(e) {
      e.preventDefault();
      showOverlay('The graphics context was lost. Reload the page to continue.', true, function () {
        window.location.reload();
      }, 'Reload');
    }
    function onContextRestored() {
      hideOverlay();
      requestRender();
    }

    function resize() {
      if (!renderer) { return; }
      var w = Math.max(1, stage.clientWidth);
      var h = Math.max(1, stage.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      /* LineMaterial works in screen space, so every one of them needs the
         canvas size to turn a pixel width into a quad. */
      lineRes.set(w, h);
      fatMats.forEach(function (m) { m.resolution.copy(lineRes); });
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      requestRender();
    }

    function showOverlay(text, showBtn, handler, btnLabel) {
      ovText.textContent = text;
      ovBar.hidden = !!showBtn;
      ovBtn.hidden = !showBtn;
      ovBtn.textContent = btnLabel || 'Try again';
      ovBtn.onclick = handler || null;
      overlay.hidden = false;
    }
    function hideOverlay() { overlay.hidden = true; ovBtn.onclick = null; }

    /* ---- fat lines ---- */

    function fatMaterial(opts) {
      var m = new THREE.LineMaterial(opts);
      m.resolution.copy(lineRes);
      fatMats.push(m);
      return m;
    }

    function dropMaterial(m) {
      var i = fatMats.indexOf(m);
      if (i >= 0) { fatMats.splice(i, 1); }
    }

    /* `flat` is a flat Float32Array of x,y,z; LineGeometry turns it into the
       instanced start/end pairs Line2 draws. */
    function fatLine(flat, mat) {
      var g = new THREE.LineGeometry();
      g.setPositions(flat);
      var l = new THREE.Line2(g, mat);
      l.frustumCulled = false;
      l.computeLineDistances();   /* dashes need the distance along the line */
      return l;
    }

    function disposeLine(l) {
      if (!l) { return; }
      world.remove(l);
      if (l.parent) { l.parent.remove(l); }
      l.geometry.dispose();
      dropMaterial(l.material);
      l.material.dispose();
    }

    /* ---- geometry building ---- */

    function keyOf(sid, arm) { return sid + '/' + arm; }

    function buildArm(sid, armId) {
      var key = keyOf(sid, armId);
      if (armNodes[key]) { touchBuilt(key); return armNodes[key]; }
      var payload = PS.maps && PS.maps[key];
      if (!payload) { return null; }

      var group = new THREE.Group();
      group.matrixAutoUpdate = false;

      var pos = decodeXYZ(payload.xyz, payload.bbox, payload.n);
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var rgb = b64ToBytes(payload.rgb);
      if (rgb.length >= pos.length) {
        geo.setAttribute('color', new THREE.BufferAttribute(rgb.subarray(0, pos.length), 3, true));
      }
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      var mat = new THREE.PointsMaterial({
        size: 0.01, sizeAttenuation: true,
        vertexColors: !!geo.getAttribute('color')
      });
      if (!geo.getAttribute('color')) { mat.color = new THREE.Color(colorFor(armId)); }
      var pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      group.add(pts);

      var traj = null;
      if (payload.traj && payload.traj.length > 1) {
        var tp = pointsToArray(payload.traj);
        if (haveFatLines()) {
          /* drawn a little wider than a hairline so the comparison with the
             ground truth stays legible at the same time */
          traj = fatLine(tp, fatMaterial({
            color: new THREE.Color(colorFor(armId)),
            linewidth: TRAJ_WIDTH_PX * widthScale()
          }));
        } else {
          var tg = new THREE.BufferGeometry();
          tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
          traj = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(colorFor(armId)) }));
          traj.frustumCulled = false;
        }
        group.add(traj);
      }

      var kf = null;
      if (payload.kf && payload.kf.length) {
        var kg = new THREE.BufferGeometry();
        kg.setAttribute('position', new THREE.BufferAttribute(pointsToArray(payload.kf), 3));
        kf = new THREE.Points(kg, new THREE.PointsMaterial({
          size: 6, sizeAttenuation: false, color: new THREE.Color(colorFor(armId))
        }));
        kf.frustumCulled = false;
        group.add(kf);
      }

      var node = {
        key: key, arm: armId, group: group, pts: pts, mat: mat, traj: traj, kf: kf,
        sim3: matrixFrom(payload.T_sim3), se3: matrixFrom(payload.T_se3),
        localBox: geo.boundingBox.clone()
      };
      group.visible = false;
      world.add(group);
      armNodes[key] = node;
      touchBuilt(key);
      applyAlign(node);
      return node;
    }

    function touchBuilt(key) {
      var i = lruBuilt.indexOf(key);
      if (i >= 0) { lruBuilt.splice(i, 1); }
      lruBuilt.push(key);
      while (lruBuilt.length > 3) {
        var old = lruBuilt.shift();
        var n = armNodes[old];
        if (!n || old === keyOf(currentScene, leftSel.value) || old === keyOf(currentScene, rightSel.value)) {
          if (n) { lruBuilt.unshift(old); }
          break;
        }
        disposeNode(n);
        delete armNodes[old];
      }
      if (PS.touchMap) { PS.touchMap(key); }
    }

    function disposeNode(n) {
      world.remove(n.group);
      n.group.traverse(function (o) {
        if (o.geometry) { o.geometry.dispose(); }
        if (o.material) { dropMaterial(o.material); o.material.dispose(); }
      });
    }

    function applyAlign(node) {
      var m = (align === 'se3' ? node.se3 : node.sim3);
      node.group.matrix.copy(m);
      node.group.matrixWorldNeedsUpdate = true;
      node.group.updateMatrixWorld(true);
    }

    /* the radius of the ground-truth path, used to size the dashes */
    function pathRadius(flat) {
      var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (var i = 0; i < flat.length; i += 3) {
        for (var a = 0; a < 3; a++) {
          var v = flat[i + a];
          if (v < mn[a]) { mn[a] = v; }
          if (v > mx[a]) { mx[a] = v; }
        }
      }
      var dx = mx[0] - mn[0], dy = mx[1] - mn[1], dz = mx[2] - mn[2];
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return isFinite(d) && d > 0 ? d / 2 : 1;
    }

    function buildGT(sid) {
      disposeLine(gtHalo); gtHalo = null;
      disposeLine(gtLine); gtLine = null;
      var sc = scenes[sid];
      if (!sc.gt || sc.gt.length < 2) { return; }

      var flat = pointsToArray(sc.gt);
      var dashed = sc.gt_dashed !== false;
      var radius = pathRadius(flat);

      if (!haveFatLines()) {
        /* Fallback: a tube of the same colour, thin in world units. It is not
           dashed, but it is visible, which is the point. */
        var pts = [];
        for (var i = 0; i < flat.length; i += 3) {
          pts.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
        }
        var curve = new THREE.CatmullRomCurve3(pts);
        var tube = new THREE.TubeGeometry(curve, Math.min(1200, pts.length * 2),
                                          Math.max(radius / 400, 1e-5), 6, false);
        gtLine = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({
          color: new THREE.Color(colorFor('gt'))
        }));
        gtLine.frustumCulled = false;
        world.add(gtLine);
        return;
      }

      var ws = widthScale();
      var dash = Math.max(radius / 40, 1e-5);
      var dashOpts = dashed
        ? { dashed: true, dashSize: dash, gapSize: dash * 0.5 }
        : { dashed: false };

      function lineOpts(color, width) {
        var o = { color: new THREE.Color(color), linewidth: width };
        for (var k in dashOpts) { if (dashOpts.hasOwnProperty(k)) { o[k] = dashOpts[k]; } }
        return o;
      }

      /* the outline first, a shade behind, so the two coincident lines do not
         fight over the depth buffer */
      var haloOpts = lineOpts(GT_HALO_COLOR, (GT_WIDTH_PX + GT_HALO_EXTRA_PX) * ws);
      haloOpts.polygonOffset = true;
      haloOpts.polygonOffsetFactor = 1;
      haloOpts.polygonOffsetUnits = 1;
      gtHalo = fatLine(flat, fatMaterial(haloOpts));
      gtHalo.renderOrder = 1;
      world.add(gtHalo);

      gtLine = fatLine(flat, fatMaterial(lineOpts(colorFor('gt'), GT_WIDTH_PX * ws)));
      gtLine.renderOrder = 2;
      world.add(gtLine);
    }

    /* ---- camera framing ---- */

    var _box = new THREE.Box3();
    var _v = new THREE.Vector3();

    /* Two framings. The paths (ground truth + the two trajectories) bound the
       part of the scene the run actually visited and make a good default view;
       the full point box is what "Fit" shows, because a map can reach well
       beyond the path (through a window, down a corridor). */
    function worldBox(mode) {
      _box.makeEmpty();
      var keys = [keyOf(currentScene, leftSel.value), keyOf(currentScene, rightSel.value)];
      var i, n;
      if (mode === 'paths') {
        for (i = 0; i < keys.length; i++) {
          n = armNodes[keys[i]];
          if (!n || !n.traj) { continue; }
          n.traj.geometry.computeBoundingBox();
          _box.union(n.traj.geometry.boundingBox.clone().applyMatrix4(n.group.matrix));
        }
        if (gtLine) {
          gtLine.geometry.computeBoundingBox();
          _box.union(gtLine.geometry.boundingBox);
        }
        if (!_box.isEmpty()) {
          _box.expandByVector(_box.getSize(new THREE.Vector3()).multiplyScalar(0.45));
          return _box;
        }
      }
      for (i = 0; i < keys.length; i++) {
        n = armNodes[keys[i]];
        if (!n) { continue; }
        _box.union(n.localBox.clone().applyMatrix4(n.group.matrix));
      }
      if (gtLine) {
        gtLine.geometry.computeBoundingBox();
        _box.union(gtLine.geometry.boundingBox);
      }
      if (_box.isEmpty()) { _box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)); }
      return _box;
    }

    function upVector() {
      var u = (scenes[currentScene] && scenes[currentScene].up) || [0, 1, 0];
      var v = new THREE.Vector3(u[0], u[1], u[2]);
      if (v.lengthSq() < 1e-9) { v.set(0, 1, 0); }
      return v.normalize();
    }

    function frame(mode) {
      var b = worldBox(mode === 'fit' ? 'all' : 'paths');
      var c = b.getCenter(new THREE.Vector3());
      var size = b.getSize(new THREE.Vector3());
      var diag = Math.max(size.length(), 1e-3);
      /* the point size is keyed to the whole map, not to the framed part */
      var full = worldBox('all').getSize(new THREE.Vector3());
      sceneDiag = Math.max(full.length(), 1e-3);
      var dist = diag / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * 0.72;
      var up = upVector();
      camera.up.copy(up);
      controls.object.up.copy(up);

      var dir;
      if (mode === 'top') {
        dir = up.clone();
        /* keep a stable screen-up for the top view */
        var alt = Math.abs(up.z) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
        camera.up.copy(alt.sub(up.clone().multiplyScalar(alt.dot(up))).normalize());
        controls.object.up.copy(camera.up);
      } else {
        /* a three-quarter view: tilted off the up axis */
        var a = Math.abs(up.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        var side = new THREE.Vector3().crossVectors(up, a).normalize();
        var fwd = new THREE.Vector3().crossVectors(side, up).normalize();
        dir = up.clone().multiplyScalar(0.55).add(fwd.multiplyScalar(0.62)).add(side.multiplyScalar(0.55)).normalize();
      }
      camera.position.copy(c).add(dir.multiplyScalar(dist));
      camera.near = Math.max(sceneDiag / 5000, 0.002);
      camera.far = sceneDiag * 40;
      camera.updateProjectionMatrix();
      controls.target.copy(c);
      controls.update();
      applyPointSize();
      requestRender();
    }

    function applyPointSize() {
      var mult = parseFloat(sizeInput.value) || 1;
      var base = Math.max(sceneDiag / 900, 1e-4);
      Object.keys(armNodes).forEach(function (k) {
        armNodes[k].mat.size = base * mult * 2.2;
        armNodes[k].mat.needsUpdate = true;
      });
      requestRender();
    }

    /* ---- drawing ---- */

    function setVisible(armId) {
      Object.keys(armNodes).forEach(function (k) {
        var n = armNodes[k];
        var on = (k === keyOf(currentScene, armId));
        n.group.visible = on;
        if (n.traj) { n.traj.visible = on && cbTraj.checked; }
        if (n.kf) { n.kf.visible = on && cbKf.checked; }
        n.pts.visible = on;
      });
      if (gtLine) { gtLine.visible = cbGt.checked; }
      if (gtHalo) { gtHalo.visible = cbGt.checked; }
    }

    function draw() {
      if (!renderer || disposed) { return; }
      var w = Math.max(1, stage.clientWidth);
      var h = Math.max(1, stage.clientHeight);
      var x = Math.round(split * w);
      renderer.setViewport(0, 0, w, h);
      renderer.setScissorTest(true);

      setVisible(leftSel.value);
      renderer.setScissor(0, 0, x, h);
      renderer.render(world, camera);

      setVisible(rightSel.value);
      /* the canvas origin is bottom-left in WebGL, but x is measured from the
         left in both coordinate systems, so only the width changes */
      renderer.setScissor(x, 0, Math.max(0, w - x), h);
      renderer.render(world, camera);

      renderer.setScissorTest(false);
    }

    /* ---- labels ---- */

    function armInfo(sid, armId) {
      var sc = scenes[sid];
      return (sc && sc.arms && sc.arms[armId]) || null;
    }

    function paintLabels() {
      [[labL, leftSel.value, legL], [labR, rightSel.value, legR]].forEach(function (t) {
        var box = t[0], armId = t[1], leg = t[2];
        var info = armInfo(currentScene, armId) || {};
        box.className = 'ps-pane-label ps-arm-' + armId;
        box.innerHTML = '';
        box.appendChild(PS.util.el('span', 'ps-arm', info.label || armId));
        box.appendChild(PS.util.el('span', 'ps-gate', info.gate || ''));
        var metrics;
        if (!info.file) {
          metrics = info.diverged ? 'diverged \u2014 no map' : 'no map';
        } else if (info.diverged && info.ate_sim3 == null && info.ate_se3 == null) {
          metrics = 'diverged \u2014 no ATE reported';
        } else {
          metrics = metricsLine(info);
        }
        box.appendChild(PS.util.el('span', 'ps-metrics', metrics));
        var i = leg.querySelector('i');
        if (i) { i.style.borderTopColor = colorFor(armId); }
        leg.lastChild.nodeValue = info.label || armId;
      });
    }

    /* ---- arm selects ---- */

    function fillArms(sid) {
      var sc = scenes[sid];
      var all = Object.keys(sc.arms || {});
      /* An arm may be listed with no map: a run that diverged has no finite
         pose to align and nothing to draw. It stays in the list, disabled and
         labelled. An arm's note is printed under the toolbar only while that
         arm is selected on either side of the divider. */
      var ids = all.filter(function (a) { return sc.arms[a] && sc.arms[a].file; });
      [leftSel, rightSel].forEach(function (sel) {
        sel.innerHTML = '';
        all.forEach(function (a) {
          var info = sc.arms[a] || {};
          var o = document.createElement('option');
          o.value = a;
          o.textContent = (info.label || a) +
            (info.file ? (info.diverged ? ' \u2014 diverged' : '')
                       : (info.diverged ? ' \u2014 diverged, no map' : ' \u2014 no map'));
          o.disabled = !info.file;
          if (info.note) { o.title = info.note; }
          sel.appendChild(o);
        });
      });
      var pair = sc.default_pair || ids.slice(0, 2);
      leftSel.value = (ids.indexOf(pair[0]) >= 0 ? pair[0] : ids[0]);
      rightSel.value = (ids.indexOf(pair[1]) >= 0 ? pair[1] : ids[Math.min(1, ids.length - 1)]);
      paintNotes(sid, [leftSel.value, rightSel.value]);
    }

    function paintNotes(sid, selected) {
      var sc = scenes[sid];
      notes.innerHTML = '';
      var any = false;
      selected.filter(function (a, i, arr) { return a && arr.indexOf(a) === i; }).forEach(function (a) {
        var info = sc.arms[a] || {};
        /* anything the data flags: an arm with no map, or one that diverged
           and therefore carries a caveat about what is being drawn */
        if (info.file && !info.note && !info.diverged) { return; }
        any = true;
        var line = PS.util.el('p', 'ps-hint');
        line.appendChild(PS.util.el('b', null, (info.label || a) + ': '));
        line.appendChild(document.createTextNode(
          info.note || (info.diverged ? 'this run diverged, so there is no map to show.'
                                      : 'no map was exported for this arm.')));
        notes.appendChild(line);
      });
      notes.hidden = !any;
    }

    /* ---- loading ---- */

    var loadSeq = 0;

    function cancelPending() {
      pending.forEach(function (h) { if (h && h.cancel) { h.cancel(); } });
      pending = [];
    }

    function loadScene(sid, refit) {
      currentScene = sid;
      var seq = ++loadSeq;
      cancelPending();
      buildGT(sid);
      paintLabels();
      paintNotes(sid, [leftSel.value, rightSel.value]);

      var want = [leftSel.value, rightSel.value].filter(function (v, i, a) { return a.indexOf(v) === i; });
      var need = want.filter(function (a) { return !armNodes[keyOf(sid, a)]; });
      if (!need.length) {
        hideOverlay();
        finishLoad(refit);
        return;
      }

      showOverlay('Loading the maps…', false);
      ovBarFill.style.width = '2%';
      var left = need.length;
      var failed = null;

      need.forEach(function (armId) {
        var info = armInfo(sid, armId);
        if (!info || !info.file) { left--; failed = 'missing'; return; }
        var key = keyOf(sid, armId);
        var h = PS.load(info.file, {
          expect: 'maps.' + key,
          timeoutMs: 30000,
          onProgress: function (elapsed, total) {
            if (seq !== loadSeq) { return; }
            ovBarFill.style.width = Math.min(96, 3 + 93 * (elapsed / total)) + '%';
          },
          onDone: function () {
            if (seq !== loadSeq) { return; }
            buildArm(sid, armId);
            if (--left <= 0) { finishLoad(refit, failed); }
          },
          onError: function (why) {
            if (seq !== loadSeq || why === 'cancelled') { return; }
            failed = why;
            if (--left <= 0) { finishLoad(refit, failed); }
          }
        });
        pending.push(h);
      });

      if (left <= 0) { finishLoad(refit, failed); }
    }

    function finishLoad(refit, failed) {
      var ok = armNodes[keyOf(currentScene, leftSel.value)] || armNodes[keyOf(currentScene, rightSel.value)];
      if (!ok) {
        showOverlay(failed === 'timeout'
          ? 'The map data took too long to load.'
          : 'The map data for this sequence could not be loaded.', true, function () {
            loadScene(currentScene, true);
          });
        return;
      }
      Object.keys(armNodes).forEach(function (k) { applyAlign(armNodes[k]); });
      hideOverlay();
      paintLabels();
      if (refit) { frame('reset'); } else { applyPointSize(); requestRender(); }
      if (failed) {
        hint.classList.add('ps-error');
        hint.textContent = 'One of the two maps could not be loaded, so that side of the divider is empty.';
      } else {
        hint.classList.remove('ps-error');
      }
    }

    /* ---- divider ---- */

    function setSplit(frac) {
      split = Math.min(0.95, Math.max(0.05, frac));
      divider.style.left = (split * 100) + '%';
      divider.setAttribute('aria-valuenow', String(Math.round(split * 100)));
      divider.setAttribute('aria-valuetext', Math.round(split * 100) + ' per cent from the left');
      requestRender();
    }

    (function dividerDrag() {
      var dragging = false;
      function fracFromEvent(e) {
        var r = stage.getBoundingClientRect();
        return (e.clientX - r.left) / Math.max(1, r.width);
      }
      divider.addEventListener('pointerdown', function (e) {
        dragging = true;
        divider.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
      });
      divider.addEventListener('pointermove', function (e) {
        if (!dragging) { return; }
        setSplit(fracFromEvent(e));
        e.preventDefault();
      });
      function end(e) {
        if (!dragging) { return; }
        dragging = false;
        try { divider.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      divider.addEventListener('pointerup', end);
      divider.addEventListener('pointercancel', end);
      divider.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 0.1 : 0.02;
        if (e.key === 'ArrowLeft') { setSplit(split - step); }
        else if (e.key === 'ArrowRight') { setSplit(split + step); }
        else if (e.key === 'Home') { setSplit(0.05); }
        else if (e.key === 'End') { setSplit(0.95); }
        else { return; }
        e.preventDefault();
      });
    })();

    /* ---- wiring ---- */

    sceneSel.addEventListener('change', function () {
      fillArms(sceneSel.value);
      loadScene(sceneSel.value, true);
    });
    leftSel.addEventListener('change', function () { loadScene(currentScene, false); });
    rightSel.addEventListener('change', function () { loadScene(currentScene, false); });

    function setAlign(mode) {
      align = mode;
      btnSim.setAttribute('aria-pressed', String(mode === 'sim3'));
      btnSe3.setAttribute('aria-pressed', String(mode === 'se3'));
      Object.keys(armNodes).forEach(function (k) { applyAlign(armNodes[k]); });
      requestRender();
    }
    btnSim.addEventListener('click', function () { setAlign('sim3'); });
    btnSe3.addEventListener('click', function () { setAlign('se3'); });

    btnReset.addEventListener('click', function () { frame('reset'); });
    btnTop.addEventListener('click', function () { frame('top'); });
    btnFit.addEventListener('click', function () { frame('fit'); });
    sizeInput.addEventListener('input', applyPointSize);
    [cbTraj, cbGt, cbKf].forEach(function (c) { c.addEventListener('change', requestRender); });

    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(resize).observe(stage);
    } else {
      window.addEventListener('resize', resize);
    }

    /* ---- go ---- */
    initGL();
    setSplit(0.5);
    sceneSel.value = sceneIds[0];
    fillArms(sceneIds[0]);
    loadScene(sceneIds[0], true);
  }

  function boot() {
    var mount = document.getElementById(MOUNT);
    if (!mount) { return; }
    if (typeof THREE === 'undefined' || !THREE.OrbitControls) {
      mount.appendChild(PS.util
        ? PS.util.el('p', 'ps-empty', 'The 3D viewer could not start: its graphics library did not load.')
        : document.createTextNode('The 3D viewer could not start.'));
      return;
    }
    var start = function () {
      try {
        build(mount);
      } catch (err) {
        mount.innerHTML = '';
        var p = document.createElement('p');
        p.className = 'ps-empty';
        p.textContent = 'The 3D viewer could not start in this browser.';
        mount.appendChild(p);
        if (window.console) { console.error('[ps-map]', err); }
      }
    };
    if (PS.whenNear) { PS.whenNear(mount, start, { settleMs: 350 }); }
    else { start(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

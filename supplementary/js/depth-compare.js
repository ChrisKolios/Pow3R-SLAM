/* depth-compare.js — image comparison between the sensor depth that goes in
 * and the pointmap depth that comes out, under each depth condition.
 *
 * Left of the divider: the sensor depth as the network received it.
 * Right of the divider: the depth of the predicted pointmap.
 * Both use the frame's single colormap and range, so the two halves are
 * directly comparable across the divider.
 */
(function () {
  'use strict';

  var PS = (window.PS = window.PS || {});
  var MOUNT = 'ps-depth';

  /* The contract fixes the condition ids but not their grouping, so a
     condition may carry an explicit `group`; otherwise it is derived from the
     id: full -> as recorded, k* -> sparser, n* -> noisier, none -> none. */
  var GROUP_ORDER = ['as recorded', 'sparser', 'noisier', 'none'];

  function groupOf(cond) {
    if (cond.group) { return cond.group; }
    var id = String(cond.id || '');
    if (id === 'none') { return 'none'; }
    if (id === 'full') { return 'as recorded'; }
    if (/^k/i.test(id)) { return 'sparser'; }
    if (/^n/i.test(id)) { return 'noisier'; }
    return 'as recorded';
  }

  function num(v, digits, unit) {
    if (v == null || !isFinite(v)) { return '—'; }
    return v.toFixed(digits) + (unit ? ' ' + unit : '');
  }

  function build(mount) {
    var U = PS.util, el = U.el;
    var data = PS.depth;
    if (!data || !data.frames || !data.frames.length) {
      mount.appendChild(el('p', 'ps-empty',
        'The depth comparison images are not part of this copy of the page.'));
      return;
    }

    var frames = data.frames;
    var frame = frames[0];
    var cond = frame.conditions[0];
    var split = 0.5;

    /* ---- toolbar ---- */
    var bar = el('div', 'ps-toolbar');

    var frameSel = document.createElement('select');
    frameSel.id = 'ps-depth-frame';
    frames.forEach(function (f, i) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = f.label || f.id;
      frameSel.appendChild(o);
    });
    if (frames.length > 1) {
      var ff = el('div', 'ps-field');
      var fl = el('label', null, 'Frame');
      fl.setAttribute('for', 'ps-depth-frame');
      ff.appendChild(fl); ff.appendChild(frameSel);
      bar.appendChild(ff);
    }

    var groupsWrap = el('div', 'ps-depth-groups');
    bar.appendChild(groupsWrap);
    mount.appendChild(bar);

    /* ---- stage ---- */
    var layout = el('div', 'ps-depth-layout');

    var stage = el('div', 'ps-depth-stage');
    var imgPred = document.createElement('img');
    imgPred.className = 'ps-pred';
    imgPred.alt = 'Depth of the predicted pointmap for this frame.';
    var imgSensor = document.createElement('img');
    imgSensor.className = 'ps-sensor';
    imgSensor.alt = 'Sensor depth for this frame, as the network received it.';
    imgPred.draggable = false; imgSensor.draggable = false;
    stage.appendChild(imgPred);
    stage.appendChild(imgSensor);

    var tags = el('div', 'ps-pane-tags');
    tags.appendChild(el('span', null, 'sensor depth in'));
    tags.appendChild(el('span', null, 'predicted pointmap depth out'));
    stage.appendChild(tags);

    var divider = el('div', 'ps-divider');
    divider.setAttribute('role', 'slider');
    divider.setAttribute('tabindex', '0');
    divider.setAttribute('aria-label', 'Split between the sensor depth and the predicted depth');
    divider.setAttribute('aria-valuemin', '0');
    divider.setAttribute('aria-valuemax', '100');
    divider.setAttribute('aria-valuenow', '50');
    divider.setAttribute('aria-orientation', 'vertical');
    stage.appendChild(divider);

    layout.appendChild(stage);

    /* ---- side column ---- */
    var side = el('div', 'ps-side');
    var rgbFig = document.createElement('figure');
    var rgbImg = document.createElement('img');
    rgbImg.className = 'ps-rgb';
    rgbImg.alt = 'The colour image for this frame.';
    rgbImg.loading = 'lazy';
    rgbFig.appendChild(rgbImg);
    rgbFig.appendChild(el('figcaption', null, 'colour image'));
    side.appendChild(rgbFig);

    var cbWrap = el('div', 'ps-colorbar-wrap');
    var cbar = el('div', 'ps-colorbar');
    cbar.setAttribute('role', 'img');
    var cbarImg = null;
    var barSrc = (data.colormap && data.colormap.bar) || data.colorbar;
    if (barSrc) {
      cbarImg = document.createElement('img');
      cbarImg.src = barSrc;
      cbarImg.alt = '';
      cbarImg.className = 'ps-colorbar';
      cbWrap.appendChild(cbarImg);
    } else {
      cbWrap.appendChild(cbar);
    }
    var cbarLabels = el('div', 'ps-colorbar-labels');
    var cbMin = el('span', null, ''), cbMax = el('span', null, '');
    cbarLabels.appendChild(cbMin); cbarLabels.appendChild(cbMax);
    cbWrap.appendChild(cbarLabels);
    var invalid = el('div', 'ps-swatch-invalid');
    var invSw = document.createElement('i');
    if (data.colormap && data.colormap.invalid) { invSw.style.background = data.colormap.invalid; }
    invalid.appendChild(invSw);
    invalid.appendChild(document.createTextNode('no depth'));
    cbWrap.appendChild(invalid);
    side.appendChild(cbWrap);

    layout.appendChild(side);
    mount.appendChild(layout);

    var readout = el('div', 'ps-readout');
    readout.setAttribute('aria-live', 'polite');
    mount.appendChild(readout);

    var hint = el('p', 'ps-hint',
      'Drag the divider (or focus it and use the left and right arrow keys) to wipe between the ' +
      'depth that went in and the depth that came out.');
    mount.appendChild(hint);

    /* ---- behaviour ---- */

    function setSplit(frac) {
      split = Math.min(1, Math.max(0, frac));
      var pct = split * 100;
      divider.style.left = pct + '%';
      /* keep only the left part of the sensor image */
      imgSensor.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      imgSensor.style.webkitClipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      divider.setAttribute('aria-valuenow', String(Math.round(pct)));
      divider.setAttribute('aria-valuetext', Math.round(pct) + ' per cent sensor depth');
    }

    function buttonsFor(f) {
      groupsWrap.innerHTML = '';
      var byGroup = {}, order = [];
      f.conditions.forEach(function (c) {
        var g = groupOf(c);
        if (!byGroup[g]) { byGroup[g] = []; order.push(g); }
        byGroup[g].push(c);
      });
      order.sort(function (a, b) {
        var ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      order.forEach(function (g) {
        var box = el('div', 'ps-depth-group');
        box.appendChild(el('span', null, g));
        var row = el('div', 'ps-btnrow');
        row.setAttribute('role', 'group');
        row.setAttribute('aria-label', 'Depth conditions: ' + g);
        byGroup[g].forEach(function (c) {
          var b = el('button', 'ps-btn', c.label || c.id);
          b.type = 'button';
          b.setAttribute('aria-pressed', String(c === cond));
          b.addEventListener('click', function () { select(c); });
          c._btn = b;
          row.appendChild(b);
        });
        box.appendChild(row);
        groupsWrap.appendChild(box);
      });
    }

    function select(c) {
      cond = c;
      frame.conditions.forEach(function (k) {
        if (k._btn) { k._btn.setAttribute('aria-pressed', String(k === c)); }
      });
      /* preload only the pair that is on screen */
      imgSensor.src = c.sensor || '';
      imgPred.src = c.pred || '';
      imgSensor.alt = 'Sensor depth, ' + (c.label || c.id) + '.';
      imgPred.alt = 'Predicted pointmap depth, ' + (c.label || c.id) + '.';
      paintReadout();
    }

    function paintReadout() {
      readout.innerHTML = '';
      function item(label, value, note) {
        var s = el('span');
        s.appendChild(document.createTextNode(label + ' '));
        s.appendChild(el('b', null, value));
        if (note) { s.appendChild(el('span', 'ps-readout-note', ' ' + note)); }
        readout.appendChild(s);
      }
      item('Depth pixels the network saw:', num(cond.valid_pct, 1, '%'));
      var med = cond.pred_vs_sensor_cm;
      if (med == null) { med = cond.median_cm; }
      if (med == null) { med = cond.pred_vs_sensor_median_cm; }
      item('Prediction vs. sensor, median:', num(med, 1, 'cm'));
      item('Mean trajectory error:', num(cond.ate_mean_m, 4, 'm'),
           cond.ate_note ? '(' + cond.ate_note + ')' : '');
    }

    function setFrame(f) {
      frame = f;
      cond = f.conditions[0];
      var w = f.width || 512, h = f.height || 384;
      stage.style.aspectRatio = w + ' / ' + h;
      rgbImg.src = f.rgb || '';
      var r = f.depth_range_m || [0, 1];
      cbMin.textContent = num(r[0], 1, 'm');
      cbMax.textContent = num(r[1], 1, 'm');
      if (cbarImg) { cbarImg.alt = 'Depth colour bar from ' + cbMin.textContent + ' to ' + cbMax.textContent + '.'; }
      else { cbar.setAttribute('aria-label', 'Depth colour bar from ' + cbMin.textContent + ' to ' + cbMax.textContent + '.'); }
      buttonsFor(f);
      select(cond);
    }

    frameSel.addEventListener('change', function () {
      setFrame(frames[parseInt(frameSel.value, 10) || 0]);
    });

    (function dividerDrag() {
      var dragging = false;
      function frac(e) {
        var r = stage.getBoundingClientRect();
        return (e.clientX - r.left) / Math.max(1, r.width);
      }
      function down(e) {
        dragging = true;
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
        setSplit(frac(e));
        e.preventDefault();
      }
      stage.addEventListener('pointerdown', down);
      stage.addEventListener('pointermove', function (e) {
        if (!dragging) { return; }
        setSplit(frac(e));
        e.preventDefault();
      });
      function end(e) {
        if (!dragging) { return; }
        dragging = false;
        try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
      divider.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 0.1 : 0.02;
        if (e.key === 'ArrowLeft') { setSplit(split - step); }
        else if (e.key === 'ArrowRight') { setSplit(split + step); }
        else if (e.key === 'Home') { setSplit(0); }
        else if (e.key === 'End') { setSplit(1); }
        else { return; }
        e.preventDefault();
      });
    })();

    setSplit(0.5);
    setFrame(frames[0]);
  }

  function boot() {
    var mount = document.getElementById(MOUNT);
    if (!mount) { return; }
    var start = function () {
      try { build(mount); }
      catch (err) {
        mount.innerHTML = '';
        var p = document.createElement('p');
        p.className = 'ps-empty';
        p.textContent = 'The depth comparison could not start in this browser.';
        mount.appendChild(p);
        if (window.console) { console.error('[ps-depth]', err); }
      }
    };
    if (PS.whenNear) { PS.whenNear(mount, start, { settleMs: 250 }); }
    else { start(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();

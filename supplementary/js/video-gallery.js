/* video-gallery.js — supplementary video gallery.
 *
 * Nothing is fetched until the viewer asks for it: each clip shows its poster
 * as a still image with a Play button, and only that click sets the <video>
 * src. The clips are grouped by the `group` field of each entry; each group is
 * a collapsible header holding that group's clip buttons, and only the group
 * of the selected clip starts open.
 */
(function () {
  'use strict';

  var PS = (window.PS = window.PS || {});
  var MOUNT = 'ps-videos';

  function build(mount) {
    var U = PS.util, el = U.el;
    var list = PS.videos;
    if (!list || !list.length) {
      mount.appendChild(el('p', 'ps-empty',
        'The supplementary videos are not part of this copy of the page.'));
      return;
    }

    /* Groups come from the data. The real-time comparisons are the ones a
       reader should meet first, so that group leads when the data has it;
       everything else keeps the order it appears in. */
    var FIRST_GROUP = 'Real-time comparisons';
    var DEFAULT_ID = 'race_office2';

    var byGroup = {}, order = [];
    list.forEach(function (v) {
      var g = v.group || 'Videos';
      if (!byGroup[g]) { byGroup[g] = []; order.push(g); }
      byGroup[g].push(v);
    });
    if (order.indexOf(FIRST_GROUP) > 0) {
      order.splice(order.indexOf(FIRST_GROUP), 1);
      order.unshift(FIRST_GROUP);
    }

    /* the default clip: office2 in real time, else the first clip of the
       first group */
    var current = null;
    for (var i = 0; i < list.length && !current; i++) {
      if (list[i].id === DEFAULT_ID) { current = list[i]; }
    }
    if (!current) { current = byGroup[order[0]][0]; }

    var tabs = el('div', 'ps-video-tabs');
    order.forEach(function (g) {
      var set = document.createElement('details');
      set.className = 'ps-video-set';
      var head = document.createElement('summary');
      head.appendChild(el('span', 'ps-video-setname', g));
      head.appendChild(el('span', 'ps-video-setcount',
        byGroup[g].length + (byGroup[g].length === 1 ? ' clip' : ' clips')));
      set.appendChild(head);

      var btns = el('div', 'ps-btnrow');
      btns.setAttribute('role', 'group');
      btns.setAttribute('aria-label', g);
      byGroup[g].forEach(function (v) {
        var b = el('button', 'ps-btn', v.label || v.id);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(v === current));
        b.addEventListener('click', function () { select(v, true); });
        v._btn = b;
        v._set = set;
        btns.appendChild(b);
      });
      set.appendChild(btns);
      /* Only the selected clip's group is open. Opening another one shows its
         clips and changes nothing else until one of them is clicked. */
      set.open = byGroup[g].indexOf(current) >= 0;
      tabs.appendChild(set);
    });
    mount.appendChild(tabs);

    var stage = el('div', 'ps-video-stage');
    var video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'none';
    video.appendChild(document.createTextNode('Your browser does not support the video tag.'));
    stage.appendChild(video);

    var poster = document.createElement('button');
    poster.type = 'button';
    poster.className = 'ps-video-poster';
    var posterImg = document.createElement('img');
    posterImg.alt = '';
    poster.appendChild(posterImg);
    var play = el('span', 'ps-play', '▶ Play');
    poster.appendChild(play);
    stage.appendChild(poster);
    mount.appendChild(stage);

    var caption = el('p', 'ps-video-caption');
    caption.setAttribute('aria-live', 'polite');
    mount.appendChild(caption);

    var meta = el('div', 'ps-video-meta');
    var metaLen = el('span');
    var metaSize = el('span');
    var dl = document.createElement('a');
    dl.setAttribute('download', '');
    dl.textContent = 'Download this clip';
    meta.appendChild(metaLen);
    meta.appendChild(metaSize);
    meta.appendChild(dl);
    mount.appendChild(meta);

    function select(v, userAction) {
      current = v;
      /* keep the group of the selected clip open, whichever group it is in */
      if (v._set) { v._set.open = true; }
      list.forEach(function (k) {
        if (k._btn) { k._btn.setAttribute('aria-pressed', String(k === v)); }
      });
      video.pause();
      video.removeAttribute('src');
      video.load();
      posterImg.src = v.poster || '';
      posterImg.alt = v.label ? ('Still frame from: ' + v.label) : '';
      poster.hidden = false;
      poster.setAttribute('aria-label', 'Play the video: ' + (v.label || v.id));
      caption.textContent = v.caption || '';
      metaLen.textContent = v.seconds ? U.fmtDuration(v.seconds) + ' long' : '';
      metaSize.textContent = v.bytes ? U.fmtBytes(v.bytes) : '';
      dl.href = v.file;
      dl.setAttribute('aria-label', 'Download the video: ' + (v.label || v.id));
      if (userAction) { poster.focus(); }
    }

    poster.addEventListener('click', function () {
      if (!current || !current.file) { return; }
      video.src = current.file;          /* click-to-load: nothing before this */
      video.poster = current.poster || '';
      poster.hidden = true;
      video.load();
      var p = video.play();
      if (p && p.catch) { p.catch(function () { /* autoplay refused: controls remain */ }); }
      video.focus();
    });

    select(current, false);
  }

  function boot() {
    var mount = document.getElementById(MOUNT);
    if (!mount) { return; }
    try { build(mount); }
    catch (err) {
      mount.innerHTML = '';
      var p = document.createElement('p');
      p.className = 'ps-empty';
      p.textContent = 'The video gallery could not start in this browser.';
      mount.appendChild(p);
      if (window.console) { console.error('[ps-videos]', err); }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();

// =====================================================================
// THE WAYWARD COMPANY — VAELORAN LICH PROGRESSION TRACKER (Update 17b)
// ---------------------------------------------------------------------
// Firebase-synced state for Vaeloran's 10-stage lich transformation.
// Enhances the existing static stage cards in index.html with:
//   - Click-to-toggle stage completion
//   - Per-stage progress % for the in-progress stage
//   - Auto-update of the top-bar LICH STAGE indicator
//   - Clickable indicator → scrolls to Lich Progress section
//
// State shape at Firebase /lich-progression:
//   {
//     completedStages: { "1": true, "2": true },
//     currentStage: 3,
//     currentStageProgress: 30,   // 0-100
//     updatedAt: <ts>
//   }
// =====================================================================
(function() {
  'use strict';

  const PATH = 'lich-progression';
  const TOTAL_STAGES = 10;

  const LT = {
    _ref: null,
    _state: null,

    init: function() {
      this._initSync();
      this._wireHeaderIndicator();
    },

    _initSync: function() {
      if (typeof firebase === 'undefined' || !firebase.database) {
        // No Firebase — use defaults matching existing HTML.
        this._state = { completedStages: { 1: true, 2: true }, currentStage: 3, currentStageProgress: 30 };
        this._render();
        return;
      }
      const self = this;
      try {
        this._ref = firebase.database().ref(PATH);
        this._ref.on('value', function(snap) {
          const val = snap.val();
          self._state = val || { completedStages: { 1: true, 2: true }, currentStage: 3, currentStageProgress: 30 };
          self._render();
        });
      } catch (e) { console.warn('[LichTracker] Sync failed:', e); }
    },

    _wireHeaderIndicator: function() {
      const el = document.getElementById('status-lich');
      if (!el) return;
      el.style.cursor = 'pointer';
      el.title = 'Click to jump to Lich Progress';
      el.addEventListener('click', function() {
        // Ensure Clock panel is showing (that's where the stages live)
        if (typeof showPanel === 'function') showPanel('clock');
        setTimeout(function() {
          const heading = Array.from(document.querySelectorAll('.sec-title')).find(function(h) {
            return h.textContent.indexOf('Lich Progress') >= 0;
          });
          if (heading && heading.scrollIntoView) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      });
    },

    _render: function() {
      if (!this._state) return;
      const s = this._state;
      const completed = s.completedStages || {};
      const currentStage = s.currentStage || 3;
      const progress = Math.max(0, Math.min(100, s.currentStageProgress || 0));

      // Update header indicator
      const hdr = document.getElementById('status-lich');
      if (hdr) {
        const doneCount = Object.keys(completed).filter(function(k) { return completed[k]; }).length;
        hdr.textContent = 'Stage ' + currentStage + '/' + TOTAL_STAGES + ' (~' + progress + '%) · ' + doneCount + ' done';
      }

      // Update the summary counter
      const counter = document.querySelector('.lich-count');
      if (counter) counter.textContent = Object.keys(completed).filter(function(k) { return completed[k]; }).length;

      // Re-decorate the existing stage cards
      const cards = document.querySelectorAll('#panel-clock .grid-2 .card');
      cards.forEach(function(card, idx) {
        const stageNum = idx + 1;
        const isDone = !!completed[stageNum];
        const isCurrent = stageNum === currentStage;
        // Add a toggle button if not already present
        if (!card.querySelector('.lich-toggle')) {
          const btn = document.createElement('button');
          btn.className = 'lich-toggle';
          btn.style.cssText = 'position:absolute;top:6px;right:6px;background:transparent;border:1px solid var(--gold2);color:var(--gold2);padding:2px 8px;border-radius:3px;font-family:Cinzel,serif;font-size:10px;letter-spacing:.5px;cursor:pointer;z-index:2';
          btn.addEventListener('click', function(e) { e.stopPropagation(); LT._toggleStage(stageNum); });
          card.style.position = 'relative';
          card.appendChild(btn);
        }
        const btn = card.querySelector('.lich-toggle');
        btn.textContent = isDone ? '✓ done' : (isCurrent ? '● current' : 'mark done');
        btn.style.background = isDone ? 'rgba(168,64,64,0.25)' : (isCurrent ? 'rgba(201,168,76,0.25)' : 'transparent');
        // Add progress control on current stage
        if (isCurrent) {
          let prog = card.querySelector('.lich-progress-row');
          if (!prog) {
            prog = document.createElement('div');
            prog.className = 'lich-progress-row';
            prog.style.cssText = 'margin-top:.5rem;padding-top:.5rem;border-top:1px dashed var(--border);display:flex;gap:.4rem;align-items:center;font-size:11px';
            prog.innerHTML =
              '<label style="font-family:Cinzel,serif;font-size:10px;color:var(--gold);letter-spacing:1px">PROGRESS %:</label>' +
              '<input type="range" min="0" max="100" step="5" class="lich-progress-slider" style="flex:1">' +
              '<span class="lich-progress-value" style="min-width:36px;text-align:right;font-family:Cinzel,serif;color:var(--gold2)">0%</span>';
            card.appendChild(prog);
            const slider = prog.querySelector('.lich-progress-slider');
            slider.addEventListener('input', function() {
              prog.querySelector('.lich-progress-value').textContent = slider.value + '%';
            });
            slider.addEventListener('change', function() { LT._setProgress(parseInt(slider.value, 10)); });
          }
          const slider = prog.querySelector('.lich-progress-slider');
          slider.value = progress;
          prog.querySelector('.lich-progress-value').textContent = progress + '%';
        } else {
          const existing = card.querySelector('.lich-progress-row');
          if (existing) existing.remove();
        }
      });
    },

    _toggleStage: function(stageNum) {
      if (!this._state) return;
      const cur = JSON.parse(JSON.stringify(this._state));
      cur.completedStages = cur.completedStages || {};
      const wasDone = !!cur.completedStages[stageNum];
      if (wasDone) {
        delete cur.completedStages[stageNum];
        // If un-marking a stage before or equal to currentStage, roll currentStage back
        if (stageNum <= cur.currentStage) cur.currentStage = stageNum;
        cur.currentStageProgress = 0;
      } else {
        cur.completedStages[stageNum] = true;
        // If marking done, advance currentStage past this one
        if (stageNum >= cur.currentStage) {
          cur.currentStage = Math.min(TOTAL_STAGES, stageNum + 1);
          cur.currentStageProgress = 0;
        }
      }
      cur.updatedAt = Date.now();
      this._write(cur);
    },

    _setProgress: function(pct) {
      if (!this._state) return;
      const cur = JSON.parse(JSON.stringify(this._state));
      cur.currentStageProgress = Math.max(0, Math.min(100, pct));
      cur.updatedAt = Date.now();
      this._write(cur);
    },

    _write: function(state) {
      const clean = JSON.parse(JSON.stringify(state));
      if (!this._ref) { this._state = clean; this._render(); return; }
      this._ref.set(clean).catch(function(e) { console.warn('[LichTracker] Write failed:', e); });
    }
  };

  window.LichTracker = LT;

  // Self-init after DOM ready
  function trySelfInit() {
    if (document.getElementById('status-lich') || document.querySelector('.lich-clock-display')) {
      LT.init();
      return true;
    }
    return false;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(trySelfInit, 200);
      setTimeout(trySelfInit, 1500);
    });
  } else {
    setTimeout(trySelfInit, 200);
    setTimeout(trySelfInit, 1500);
  }
})();

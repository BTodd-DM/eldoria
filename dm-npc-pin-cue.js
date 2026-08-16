// =====================================================================
// THE WAYWARD COMPANY — NPC pin button + inline cue expansion
// ---------------------------------------------------------------------
// Merges the old standalone Cue Cards system into the existing DM NPC
// cards. Each card gets a 📌 pin button. Pinned cards get:
//   - a gold border (visual "on stage" indicator)
//   - a "🎭 SESSION ACTIVE" chip in the header
//   - if the NPC has cue frontmatter, an expanded cue block appended
//     (voice / opening / wants / secrets / exit)
//
// Pin state syncs across devices via Firebase /cue-active (unchanged
// from the standalone Cue Cards version).
//
// Public API:
//   attachDmNpcPinCue()
// =====================================================================

(function() {
  'use strict';

  const CUE_ACTIVE_PATH = 'cue-active';
  const CUES_JSON_URL = 'data/cues.json';

  let _activeRef = null;
  let _active = {};
  let _cuesById = {};
  let _cuesLoaded = false;
  let _wired = false;

  function ensureSync() {
    if (_activeRef) return true;
    if (typeof firebase === 'undefined' || !firebase.database) return false;
    try {
      _activeRef = firebase.database().ref(CUE_ACTIVE_PATH);
      _activeRef.on('value', function(snap) {
        _active = snap.val() || {};
        renderAll();
      });
      return true;
    } catch (e) {
      console.warn('[NPC pin/cue] Sync init failed:', e);
      return false;
    }
  }

  function ensureCues(cb) {
    if (_cuesLoaded) { cb(); return; }
    fetch(CUES_JSON_URL + '?_=' + Date.now())
      .then(function(r) { return r.ok ? r.json() : { cues: [] }; })
      .then(function(data) {
        (data.cues || []).forEach(function(c) { _cuesById[c.id] = c; });
        _cuesLoaded = true;
        cb();
      })
      .catch(function() { _cuesLoaded = true; cb(); });
  }

  function togglePin(npcId) {
    if (!_activeRef) { console.warn('[NPC pin/cue] Firebase not ready'); return; }
    const currently = !!_active[npcId];
    _activeRef.child(npcId).set(currently ? null : true).catch(function(e) {
      console.warn('[NPC pin/cue] Pin toggle failed:', e && e.message);
    });
  }

  function renderPinButton(card, npcId) {
    let btn = card.querySelector('.dm-npc-pin-btn');
    const pinned = !!_active[npcId];
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'dm-npc-pin-btn';
      btn.setAttribute('data-npc-id', npcId);
      btn.addEventListener('click', function() { togglePin(npcId); });
      // Anchor in the top-right of the card header (or the card itself).
      const header = card.querySelector('.npc-header') || card;
      header.style.position = header.style.position || 'relative';
      btn.style.cssText = 'position:absolute;top:6px;right:6px;background:transparent;border:1px solid rgba(160,128,64,0.4);color:var(--parch3);padding:2px 8px;border-radius:3px;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:.5px;cursor:pointer;transition:all .12s;z-index:2';
      header.appendChild(btn);
    }
    btn.textContent = pinned ? '📌 pinned' : '📌 pin';
    btn.style.background = pinned ? 'rgba(201,168,76,0.25)' : 'transparent';
    btn.style.color = pinned ? 'var(--gold2)' : 'var(--parch3)';
    btn.style.borderColor = pinned ? 'var(--gold2)' : 'rgba(160,128,64,0.4)';
    btn.title = pinned ? 'Unpin from Session Active' : 'Pin to Session Active';
  }

  function renderCueBlock(card, npcId) {
    // Only render/expand cue block if pinned AND the NPC has cue data.
    const pinned = !!_active[npcId];
    const cue = _cuesById[npcId];
    let block = card.querySelector('.dm-npc-cue-block');

    if (!pinned || !cue) {
      if (block) block.remove();
      return;
    }
    // Build/refresh cue block
    if (!block) {
      block = document.createElement('div');
      block.className = 'dm-npc-cue-block';
      // Insert BEFORE the DM notes <details> if present, else append at end
      const notes = card.querySelector('details');
      if (notes) card.insertBefore(block, notes);
      else card.appendChild(block);
    }
    const secrets = (cue.secrets || []).map(function(s) {
      return '<li>' + escapeHtml(s) + '</li>';
    }).join('');
    block.innerHTML =
      '<div style="margin-top:.75rem;padding:.6rem .75rem;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.4);border-left:3px solid var(--gold2);border-radius:3px">' +
        '<div style="font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:1.5px;color:var(--gold2);margin-bottom:.4rem">🎭 CUE — ON STAGE</div>' +
        (cue.voice   ? cueField('Voice',   cue.voice)   : '') +
        (cue.opening ? cueFieldItalic('Opening', '"' + cue.opening + '"') : '') +
        (cue.wants   ? cueField('Wants',   cue.wants)   : '') +
        (secrets     ? '<div style="margin-top:.35rem"><div style="font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:1.5px;color:var(--gold2);opacity:.85">SECRETS</div><ul style="margin:.15rem 0 0 1.15rem;padding:0;font-size:12px;line-height:1.5;color:var(--parch2)">' + secrets + '</ul></div>' : '') +
        (cue.exit    ? cueField('Exit',    cue.exit)    : '') +
      '</div>';
  }
  function cueField(label, val) {
    return '<div style="margin-top:.3rem"><span style="font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:1.5px;color:var(--gold2);opacity:.85">' + label + '</span> <span style="font-size:12.5px;color:var(--parch2);line-height:1.5">' + escapeHtml(val) + '</span></div>';
  }
  function cueFieldItalic(label, val) {
    return '<div style="margin-top:.3rem"><span style="font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:1.5px;color:var(--gold2);opacity:.85">' + label + '</span> <span style="font-size:12.5px;color:#f4e4a0;font-style:italic;line-height:1.5">' + escapeHtml(val) + '</span></div>';
  }

  function renderCardBorder(card, npcId) {
    const pinned = !!_active[npcId];
    if (pinned) {
      card.style.boxShadow = '0 0 0 2px var(--gold2), 0 0 16px rgba(201,168,76,0.2)';
      // Float pinned cards to the very top of the grid (before all location headers).
      card.style.order = '-1';
    } else {
      card.style.boxShadow = '';
      card.style.order = '';
    }
  }

  // Show/hide the "Session Active" strip above pinned cards.
  function renderSessionActiveStrip() {
    const grid = document.getElementById('npc-grid-root');
    if (!grid) return;
    let strip = document.getElementById('session-active-strip');
    const hasPinned = Object.keys(_active).some(function(k) { return _active[k]; });
    if (hasPinned) {
      if (!strip) {
        strip = document.createElement('div');
        strip.id = 'session-active-strip';
        strip.className = 'npc-location-header';
        strip.style.cssText = 'grid-column:1/-1;order:-2;color:var(--gold2);border-bottom:1px solid var(--gold2);cursor:default';
        strip.innerHTML = '🎭 Session Active <span class="npc-loc-count">pinned</span>';
        grid.insertBefore(strip, grid.firstChild);
      }
      strip.style.display = '';
    } else if (strip) {
      strip.style.display = 'none';
    }
  }

  function renderAll() {
    const panel = document.getElementById('panel-npcs');
    if (!panel) return;
    panel.querySelectorAll('[data-npc-id]').forEach(function(el) {
      const npcId = el.getAttribute('data-npc-id');
      const card = el.closest('.card') || el;
      if (!card) return;
      renderPinButton(card, npcId);
      renderCardBorder(card, npcId);
      renderCueBlock(card, npcId);
    });
    renderSessionActiveStrip();
  }

  function attach() {
    ensureSync();
    ensureCues(function() {
      renderAll();
      // Also run notes attach in the same pass — one enhancement flow for cards.
      if (typeof window.attachDmNpcNotes === 'function') {
        try { window.attachDmNpcNotes(); } catch (e) { console.warn('attachDmNpcNotes failed:', e); }
      }
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.attachDmNpcPinCue = attach;
})();

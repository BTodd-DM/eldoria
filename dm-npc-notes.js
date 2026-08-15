// =====================================================================
// THE WAYWARD COMPANY — DM per-NPC private notes (attach mode)
// ---------------------------------------------------------------------
// Scans the DM NPC panel for elements marked `data-npc-id="<id>"` and
// appends a collapsible <details> "📝 My notes" area to each.
//
// Notes save to Firebase /npc-notes/dm/<npcId> — same path the player
// site uses for its own identities. DM sees their own; players see
// their own; no crossover.
//
// Public API:
//   attachDmNpcNotes()
// =====================================================================

(function() {
  'use strict';

  const NPC_NOTES_PATH = 'npc-notes';
  const DM_ID = 'dm';
  const SAVE_DEBOUNCE_MS = 600;

  const _saveTimers = {};
  let _notesRef = null;
  let _notesCache = {};

  function ensureSync() {
    if (_notesRef) return true;
    if (typeof firebase === 'undefined' || !firebase.database) return false;
    try {
      _notesRef = firebase.database().ref(NPC_NOTES_PATH + '/' + DM_ID);
      _notesRef.on('value', function(snap) {
        _notesCache = snap.val() || {};
        // Refresh textareas that aren't focused
        Object.keys(_notesCache).forEach(function(npcId) {
          const ta = document.getElementById('dm-npc-note-' + npcId);
          if (ta && document.activeElement !== ta) {
            const entry = _notesCache[npcId] || {};
            ta.value = entry.body || '';
            updateSavedLabel(npcId, entry.updatedAt);
          }
        });
      });
      return true;
    } catch (e) {
      console.warn('[DmNpcNotes] Sync init failed:', e);
      return false;
    }
  }

  function updateSavedLabel(npcId, updatedAt) {
    const label = document.getElementById('dm-npc-note-saved-' + npcId);
    if (!label) return;
    if (!updatedAt) { label.textContent = ''; return; }
    const d = new Date(updatedAt);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    label.textContent = '✓ saved ' + (sameDay
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString());
  }

  function saveNote(npcId, body) {
    if (!ensureSync() || !_notesRef) return;
    clearTimeout(_saveTimers[npcId]);
    _saveTimers[npcId] = setTimeout(function() {
      _notesRef.child(npcId).set({
        body: String(body || ''),
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      }).catch(function(e) {
        console.warn('[DmNpcNotes] Save failed for', npcId, e && e.message);
      });
    }, SAVE_DEBOUNCE_MS);
  }

  function makeNotesBlock(npcId, currentBody, updatedAt) {
    const savedText = updatedAt ? ('✓ saved ' + new Date(updatedAt).toLocaleString()) : '';
    return '<details style="margin-top:.75rem;padding-top:.6rem;border-top:1px dashed rgba(160,128,64,0.25)">' +
      '<summary style="cursor:pointer;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1.5px;color:var(--gold2);text-transform:uppercase">📝 My DM notes</summary>' +
      '<textarea id="dm-npc-note-' + escapeAttr(npcId) + '" placeholder="Private DM notes on this NPC…" style="width:100%;min-height:80px;margin-top:.4rem;padding:.5rem .6rem;background:rgba(10,8,5,0.55);border:1px solid rgba(160,128,64,0.3);border-radius:2px;color:var(--parch1);font-family:\'Crimson Pro\',serif;font-size:13px;line-height:1.55;resize:vertical;outline:none">' + escapeHtml(currentBody) + '</textarea>' +
      '<div id="dm-npc-note-saved-' + escapeAttr(npcId) + '" style="font-size:11px;color:var(--teal2,#5a9080);font-style:italic;margin-top:.25rem;min-height:14px">' + escapeHtml(savedText) + '</div>' +
      '</details>';
  }

  function attach() {
    ensureSync();
    const panel = document.getElementById('panel-npcs');
    if (!panel) return;
    // Scan for any element with data-npc-id inside the panel — treat that
    // element (or its nearest .card ancestor) as the container to append into.
    const marked = panel.querySelectorAll('[data-npc-id]');
    marked.forEach(function(el) {
      const npcId = el.getAttribute('data-npc-id');
      if (!npcId) return;
      // Already attached? Skip.
      if (el.querySelector('#dm-npc-note-' + CSS.escape(npcId))) return;
      // Where to append: prefer .card ancestor, else the element itself
      const host = el.closest('.card') || el;
      // Don't double-append if a note area for this id already lives in this host
      if (host.querySelector('#dm-npc-note-' + CSS.escape(npcId))) return;
      const cached = _notesCache[npcId] || {};
      const wrapper = document.createElement('div');
      wrapper.innerHTML = makeNotesBlock(npcId, cached.body || '', cached.updatedAt || 0);
      host.appendChild(wrapper.firstChild);
      // Wire the textarea
      const ta = document.getElementById('dm-npc-note-' + npcId);
      if (ta) {
        ta.addEventListener('input', function() { saveNote(npcId, ta.value); });
      }
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

  window.attachDmNpcNotes = attach;
})();

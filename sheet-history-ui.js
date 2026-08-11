// =====================================================================
// THE WAYWARD COMPANY — SHEET HISTORY / RESTORE UI (Update 7)
// ---------------------------------------------------------------------
// DM-side panel for browsing the last 20 saved states per character and
// restoring any of them. History entries are written by firebase-sync.js
// on every push (previous state → /character-history/<charId>/<ts>).
//
// Public API:
//   SheetHistory.init(containerId)
//   SheetHistory.refresh()
// =====================================================================

(function() {
  'use strict';

  const CHARS = ['torren', 'sylas', 'orin'];
  const LABELS = { torren: 'Torren', sylas: 'Sylas', orin: 'Orin' };

  const SheetHistory = {
    _container: null,

    init: function(containerId) {
      this._container = document.getElementById(containerId);
      if (!this._container) return;
      this.refresh();
    },

    refresh: function() {
      const self = this;
      if (!this._container) return;
      if (!window.CharacterSync || !CharacterSync.ready) {
        this._container.innerHTML = '<div class="hist-empty">Firebase not ready yet. Refresh in a moment.</div>';
        return;
      }
      this._container.innerHTML = '<div class="hist-empty">Loading history…</div>';

      Promise.all(CHARS.map(function(id) {
        return CharacterSync.listHistory(id).then(function(entries) {
          return { id: id, entries: entries };
        }).catch(function() { return { id: id, entries: [] }; });
      })).then(function(results) {
        self._render(results);
      });
    },

    _render: function(results) {
      const self = this;
      const html = results.map(function(r) { return self._renderChar(r); }).join('');
      this._container.innerHTML = html;
      this._wire();
    },

    _renderChar: function(r) {
      const label = LABELS[r.id] || r.id;
      if (!r.entries.length) {
        return [
          '<div class="hist-char">',
            '<div class="hist-char-header">' + escapeHtml(label) + '</div>',
            '<div class="hist-empty-small">No history yet. First save will create a snapshot.</div>',
          '</div>'
        ].join('');
      }
      const rows = r.entries.map(function(e) {
        const s = e.state || {};
        const hp = s.hp || {};
        const hpText = (hp.current !== undefined ? hp.current : '?') + ' / ' + (hp.max !== undefined ? hp.max : '?');
        const tempHp = hp.temp ? ' (+' + hp.temp + ' temp)' : '';
        const slotSummary = summariseSlots(s.slots || {});
        const inspiration = s.inspiration ? ' · ✨' : '';
        const exhaustion = s.exhaustion ? ' · Exh ' + s.exhaustion : '';
        return [
          '<tr>',
            '<td class="hist-ts">' + escapeHtml(formatTime(e.savedAt)) + '</td>',
            '<td class="hist-hp">' + escapeHtml(hpText + tempHp) + '</td>',
            '<td class="hist-slots">' + escapeHtml(slotSummary) + '</td>',
            '<td class="hist-meta">' + escapeHtml((inspiration + exhaustion).replace(/^ · /, '')) + '</td>',
            '<td class="hist-actions">',
              '<button class="hist-restore" data-char="' + escapeAttr(r.id) + '" data-ts="' + e.ts + '">Restore</button>',
            '</td>',
          '</tr>'
        ].join('');
      }).join('');
      return [
        '<div class="hist-char">',
          '<div class="hist-char-header">' + escapeHtml(label) + ' — last ' + r.entries.length + ' saves</div>',
          '<table class="hist-table">',
            '<thead><tr><th>When</th><th>HP</th><th>Slots</th><th></th><th></th></tr></thead>',
            '<tbody>' + rows + '</tbody>',
          '</table>',
        '</div>'
      ].join('');
    },

    _wire: function() {
      const self = this;
      this._container.querySelectorAll('.hist-restore').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const charId = btn.getAttribute('data-char');
          const ts = Number(btn.getAttribute('data-ts'));
          const when = btn.closest('tr').querySelector('.hist-ts').textContent;
          const label = LABELS[charId] || charId;
          if (!confirm('Restore ' + label + ' to the state from ' + when + '?\n\nThe current state will be snapshotted into history first (so this is reversible).')) return;
          btn.disabled = true;
          btn.textContent = 'Restoring…';
          CharacterSync.restoreFromHistory(charId, ts).then(function() {
            self.refresh();
            // Also refresh the sheet if it's open in the modal
            try { if (typeof refreshSheet === 'function') refreshSheet(charId); } catch (e) {}
            alert(label + ' restored to ' + when + '. Sheet updated.');
          }).catch(function(e) {
            btn.disabled = false;
            btn.textContent = 'Restore';
            alert('Restore failed: ' + (e && e.message ? e.message : e));
          });
        });
      });
    }
  };

  function summariseSlots(slots) {
    // slots is like { l1: { current: 3, max: 4 }, l2: {...}, ... }
    // Produce "L1 3/4 · L2 2/3"
    const parts = [];
    Object.keys(slots).sort().forEach(function(k) {
      const s = slots[k] || {};
      const cur = s.current !== undefined ? s.current : (s.remaining !== undefined ? s.remaining : '?');
      const mx = s.max !== undefined ? s.max : (s.total !== undefined ? s.total : '?');
      if (mx === 0) return;
      const level = k.replace(/^l/i, '').toUpperCase();
      parts.push('L' + level + ' ' + cur + '/' + mx);
    });
    return parts.join(' · ') || '—';
  }

  function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d)) return '—';
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return 'Today ' + time;
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday ' + time;
    return d.toLocaleDateString() + ' ' + time;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

  // Inject CSS
  if (!document.getElementById('sheet-history-css')) {
    const style = document.createElement('style');
    style.id = 'sheet-history-css';
    style.textContent = `
      .hist-empty { padding:1.5rem; text-align:center; color:var(--parch3); font-style:italic; }
      .hist-empty-small { padding:.5rem .75rem; color:var(--parch3); font-style:italic; font-size:12px; }
      .hist-char { background:linear-gradient(135deg,rgba(26,18,8,0.9),rgba(13,10,6,0.98)); border:1px solid rgba(160,128,64,0.4); border-radius:4px; padding:1rem 1.15rem; margin-bottom:1rem; }
      .hist-char-header { font-family:'Cinzel',serif; color:var(--gold2); font-size:13px; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:.5rem; border-bottom:1px solid rgba(160,128,64,0.25); padding-bottom:.4rem; }
      .hist-table { width:100%; border-collapse:collapse; font-size:12px; }
      .hist-table th { text-align:left; padding:.4rem .5rem; color:var(--gold2); font-family:'Cinzel',serif; font-size:10px; letter-spacing:1px; text-transform:uppercase; border-bottom:1px solid rgba(160,128,64,0.2); }
      .hist-table td { padding:.45rem .5rem; border-bottom:1px solid rgba(160,128,64,0.1); color:var(--parch2); vertical-align:middle; }
      .hist-ts { font-family:'Cinzel',serif; font-size:11px; color:var(--parch1); white-space:nowrap; }
      .hist-hp { font-family:monospace; }
      .hist-slots { font-family:monospace; font-size:11px; color:var(--parch3); }
      .hist-meta { font-size:11px; color:var(--parch3); }
      .hist-actions { text-align:right; width:100px; }
      .hist-restore { background:transparent; color:var(--gold2); border:1px solid var(--gold2); padding:4px 12px; border-radius:2px; font-family:'Cinzel',serif; font-size:10px; letter-spacing:1px; cursor:pointer; transition:all .12s; }
      .hist-restore:hover { background:var(--gold2); color:#0a0805; }
      .hist-restore:disabled { opacity:.5; cursor:not-allowed; }
    `;
    document.head.appendChild(style);
  }

  window.SheetHistory = SheetHistory;
})();

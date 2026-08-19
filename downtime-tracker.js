// =====================================================================
// THE WAYWARD COMPANY — DOWNTIME TRACKER (Update 41)
// ---------------------------------------------------------------------
// Per-PC log of downtime activities between sessions.
// Firebase path /downtime-log:
//   {
//     <pcId>: {
//       entries: {
//         <pushId>: { activity, days, startDate, outcome, notes, when }
//       },
//       totalDays: <int>
//     }
//   }
// =====================================================================
(function() {
  'use strict';

  const PATH = 'downtime-log';
  const PC_IDS = ['torren', 'sylas', 'orin'];

  const DT = {
    _ref: null, _data: {},

    init: function() {
      if (typeof firebase === 'undefined' || !firebase.database) return;
      const self = this;
      try {
        this._ref = firebase.database().ref(PATH);
        this._ref.on('value', function(snap) { self._data = snap.val() || {}; });
      } catch (e) { console.warn('[DowntimeTracker] Sync failed:', e); }
    },

    open: function() {
      let dlg = document.getElementById('downtime-dialog');
      if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'downtime-dialog';
        dlg.style.cssText = 'max-width:720px;width:92vw;max-height:88vh;padding:0;border:1px solid var(--gold2);background:#0d0a06;color:var(--parch1);border-radius:6px';
        dlg.innerHTML =
          '<div style="padding:.75rem 1rem;border-bottom:1px solid var(--gold2);display:flex;justify-content:space-between;align-items:center">' +
            '<div style="font-family:Cinzel,serif;color:var(--gold2)">⏳ Downtime Tracker</div>' +
            '<div style="display:flex;gap:.4rem">' +
              '<button onclick="if(window.DowntimeTracker) DowntimeTracker.newEntry()" style="background:var(--gold);color:#0d0a06;border:none;padding:4px 12px;border-radius:2px;cursor:pointer;font-family:Cinzel,serif;font-size:11px;letter-spacing:1px">+ New entry</button>' +
              '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid var(--parch3);color:var(--parch3);padding:4px 10px;border-radius:2px;cursor:pointer;font-family:Cinzel,serif;font-size:11px">Close</button>' +
            '</div>' +
          '</div>' +
          '<div id="downtime-body" style="padding:1rem;overflow-y:auto;max-height:78vh"></div>';
        document.body.appendChild(dlg);
        dlg.addEventListener('click', function(e) { if (e.target === dlg) dlg.close(); });
      }
      this._render();
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    },

    _render: function() {
      const body = document.getElementById('downtime-body');
      if (!body) return;
      const self = this;
      let html = '';
      PC_IDS.forEach(function(pcId) {
        const pcData = self._data[pcId] || {};
        const entriesObj = pcData.entries || {};
        const entries = Object.keys(entriesObj).map(function(k) { return Object.assign({ _id: k }, entriesObj[k]); }).sort(function(a, b) { return (b.when || 0) - (a.when || 0); });
        const name = (typeof CHARACTERS !== 'undefined' && CHARACTERS[pcId] && CHARACTERS[pcId].name) || pcId;
        const total = pcData.totalDays || 0;
        html += '<div style="border:1px solid var(--gold2);border-radius:4px;padding:.6rem .75rem;margin-bottom:.75rem;background:rgba(20,14,6,0.4)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-family:Cinzel,serif;color:var(--gold2);font-size:14px">' + escapeHtml(name) + '</div>';
        html += '<div style="font-family:Cinzel,serif;color:var(--gold);font-size:13px">' + total + ' days total</div></div>';
        if (entries.length) {
          html += '<div style="margin-top:.5rem;font-size:11.5px">';
          entries.slice(0, 15).forEach(function(e) {
            const d = new Date(e.when || 0);
            const when = d.toLocaleDateString();
            html += '<div style="padding:.4rem 0;border-top:1px dashed rgba(160,128,64,0.2);display:flex;justify-content:space-between;gap:.5rem;align-items:flex-start">' +
              '<div style="flex:1"><div style="color:var(--gold)"><strong>' + escapeHtml(e.activity || '') + '</strong> · ' + (e.days || 0) + ' days</div>' +
              (e.startDate ? '<div style="color:var(--parch3);font-size:10.5px">Started ' + escapeHtml(e.startDate) + '</div>' : '') +
              (e.outcome ? '<div style="color:var(--parch1);font-style:italic;margin-top:.2rem">→ ' + escapeHtml(e.outcome) + '</div>' : '') +
              (e.notes ? '<div style="color:var(--parch2);font-size:11px;margin-top:.2rem">' + escapeHtml(e.notes) + '</div>' : '') +
              '<div style="color:var(--parch3);font-size:10px;margin-top:.2rem">logged ' + when + '</div></div>' +
              '<button onclick="if(window.DowntimeTracker) DowntimeTracker.deleteEntry(\'' + pcId + '\',\'' + e._id + '\',' + (e.days || 0) + ')" style="background:transparent;border:1px solid #a02020;color:#e0a0a0;padding:2px 8px;border-radius:2px;cursor:pointer;font-size:10px">✕</button>' +
              '</div>';
          });
          html += '</div>';
        } else {
          html += '<div style="margin-top:.4rem;font-size:11px;color:var(--parch3);font-style:italic">No downtime logged yet.</div>';
        }
        html += '</div>';
      });
      body.innerHTML = html;
    },

    newEntry: function() {
      // PC picker
      const opts = PC_IDS.map(function(id, i) {
        const name = (typeof CHARACTERS !== 'undefined' && CHARACTERS[id] && CHARACTERS[id].name) || id;
        return (i+1) + '. ' + name;
      }).join('\n');
      const pcRaw = prompt('Which PC?\n\n' + opts + '\n\nEnter number:');
      const pcIdx = parseInt(pcRaw, 10) - 1;
      if (isNaN(pcIdx) || pcIdx < 0 || pcIdx >= PC_IDS.length) return;
      const pcId = PC_IDS[pcIdx];
      const activity = prompt('Activity? (e.g. "Research Vaeloran", "Craft healing potions", "Train with Merric")');
      if (!activity) return;
      const daysRaw = prompt('How many days spent?', '7');
      const days = parseInt(daysRaw, 10);
      if (isNaN(days) || days < 1) return;
      const startDate = prompt('Start date (in-world, e.g. "15 Frostfall"):', '') || '';
      const outcome = prompt('Outcome? (leave blank if pending)', '') || '';
      const notes = prompt('Extra notes?', '') || '';
      if (!this._ref) { alert('Firebase unavailable.'); return; }
      const entry = { activity: activity, days: days, startDate: startDate, outcome: outcome, notes: notes, when: Date.now() };
      const pcRef = this._ref.child(pcId);
      pcRef.child('entries').push(entry);
      pcRef.child('totalDays').transaction(function(cur) { return (cur || 0) + days; });
    },

    deleteEntry: function(pcId, entryId, days) {
      if (!confirm('Delete this downtime entry? Removes ' + days + ' days from total.')) return;
      if (!this._ref) return;
      const pcRef = this._ref.child(pcId);
      pcRef.child('entries').child(entryId).remove();
      pcRef.child('totalDays').transaction(function(cur) { return Math.max(0, (cur || 0) - days); });
    }
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.DowntimeTracker = DT;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(function() { DT.init(); }, 400); });
  } else {
    setTimeout(function() { DT.init(); }, 400);
  }
})();

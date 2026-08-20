// =====================================================================
// THE WAYWARD COMPANY — HANDOUTS UI (Update 24)
// ---------------------------------------------------------------------
// Renders DM handouts panel (create/edit/delete) and player handouts
// panel (list + letter-styled reveal + arrival toast + tab-title flash).
// Depends on handouts.js.
// =====================================================================
(function() {
  'use strict';

  const PC_LIST = [
    { id: 'sylas',  label: 'Sylas'  },
    { id: 'orin',   label: 'Orin'   },
    { id: 'torren', label: 'Torren' }
  ];

  const HandoutsUI = {
    _identity: null,
    _container: null,
    _dmMode: false,
    _editingId: null,
    _creating: false,

    initDM: function(containerId) {
      this._identity = { id: 'dm', role: 'dm', label: 'DM' };
      this._container = document.getElementById(containerId);
      if (!this._container) return;
      this._dmMode = true;
      const self = this;
      window.HandoutsSync.subscribe(function() { self.render(); });
      this.render();
    },

    initPlayer: function(containerId, identity) {
      this._identity = identity;
      this._container = document.getElementById(containerId);
      if (!this._container) return;
      this._dmMode = false;
      const self = this;
      window.HandoutsSync.subscribe(function() { self.render(); self._updateNavBadge(); });
      window.HandoutsSync.onArrival(function(h) { self._flashArrival(h); });
      this.render();
      this._updateNavBadge();
    },

    render: function() {
      if (!this._container || !window.HandoutsSync) return;
      const identity = this._identity;
      const handouts = this._dmMode
        ? window.HandoutsSync.getAll()
        : window.HandoutsSync.filterForIdentity(identity);
      let html = '';
      html += this._renderHeader();
      if (this._creating || this._editingId) {
        html += this._renderForm();
      }
      if (this._dmMode && !handouts.length) {
        html += '<div class="handout-empty" style="padding:1rem;color:var(--parch3);font-style:italic;text-align:center">No handouts yet. Create one, or click the seed button in the header to add 8 starter handouts.</div>';
      } else if (!handouts.length) {
        html += '<div class="handout-empty" style="padding:1rem;color:var(--ink3);font-style:italic;text-align:center">Nothing to show yet. When the DM sends you a handout, it appears here.</div>';
      } else {
        html += '<div class="handout-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.75rem">';
        const self = this;
        handouts.forEach(function(h) { html += self._renderCard(h); });
        html += '</div>';
      }
      this._container.innerHTML = html;
      this._wireCardClicks();
    },

    _renderHeader: function() {
      if (this._dmMode) {
        const empty = window.HandoutsSync.getAll().length === 0;
        return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;gap:.5rem;flex-wrap:wrap">' +
          '<div class="card-body" style="margin:0;font-size:12.5px;color:var(--parch3);font-style:italic">Create letters, notes, images the party can view live during a session. Pick recipients per-PC or party-wide.</div>' +
          '<div style="display:flex;gap:.4rem">' +
            (empty ? '<button class="action-btn" onclick="HandoutsUI.seedStarters()">🌱 Seed 8 starter handouts</button>' : '') +
            '<button class="action-btn" style="background:var(--gold);color:var(--ink);border-color:var(--gold)" onclick="HandoutsUI.startCreate()">+ Create handout</button>' +
          '</div>' +
        '</div>';
      }
      return '<div class="card-body" style="margin-bottom:.75rem;font-size:13.5px;color:var(--ink3);font-style:italic">Letters, notes, and items the DM has passed to the party. Click any card to open the full handout.</div>';
    },

    _renderCard: function(h) {
      const isRead = window.HandoutsSync.isReadBy(h, this._identity.id);
      const isDraft = this._isDraft(h);
      const recips = isDraft ? 'DRAFT — not released' : this._recipientList(h);
      const readCount = h.readBy ? Object.keys(h.readBy).length : 0;
      const unreadBorder = (!isRead && !this._dmMode) ? ';box-shadow:inset 4px 0 0 var(--gold, #8a6a10)' : '';
      const draftBg = isDraft ? ';background:rgba(80,80,120,0.10);border-style:dashed' : '';
      const draftBadge = isDraft
        ? '<span style="display:inline-block;background:rgba(160,80,201,0.25);color:#c07adf;font-size:9px;padding:1px 6px;border-radius:2px;font-family:\'Cinzel\',serif;letter-spacing:1px;margin-right:.35rem">DRAFT</span>'
        : '';
      const dmActions = this._dmMode
        ? '<div style="display:flex;gap:.3rem;margin-top:.4rem">' +
            '<button class="action-btn" onclick="event.stopPropagation();HandoutsUI.startEdit(\'' + h.id + '\')" style="font-size:10px;padding:2px 8px">Edit</button>' +
            (isDraft ? '<button class="action-btn" onclick="event.stopPropagation();HandoutsUI.quickRelease(\'' + h.id + '\')" style="font-size:10px;padding:2px 8px;background:var(--gold);color:var(--ink);border-color:var(--gold)" title="Release to a recipient right now">📤 Release…</button>' : '') +
            '<button class="action-btn" onclick="event.stopPropagation();HandoutsUI.deleteHandout(\'' + h.id + '\')" style="font-size:10px;padding:2px 8px;border-color:#a02020;color:#e0a0a0">Delete</button>' +
            '<span style="font-size:10px;color:var(--parch3);margin-left:auto;align-self:center">' + (isDraft ? '—' : readCount + ' read') + '</span>' +
          '</div>'
        : '';
      const thumb = h.imageUrl
        ? '<img src="' + this._esc(h.imageUrl) + '" alt="" style="width:100%;max-height:120px;object-fit:cover;border-radius:2px;margin-bottom:.4rem" onerror="this.style.display=\'none\'">'
        : '';
      const unreadDot = (!isRead && !this._dmMode) ? '<span style="color:var(--gold);font-size:9px;margin-right:.3rem">●</span>' : '';
      const preview = String(h.body || '').replace(/[\r\n]+/g, ' ').slice(0, 120) + (String(h.body || '').length > 120 ? '…' : '');
      return '<div class="handout-card" data-handout-id="' + this._esc(h.id) + '" style="border:1px solid var(--border, var(--gold, #8a6a10));border-radius:4px;padding:.6rem .7rem;cursor:pointer;background:rgba(20,14,6,0.15)' + unreadBorder + draftBg + '">' +
        thumb +
        '<div style="font-family:\'Cinzel\',serif;color:var(--gold, #8a6a10);font-size:13px;margin-bottom:.15rem">' + draftBadge + unreadDot + this._esc(h.title) + '</div>' +
        '<div style="font-size:10.5px;color:var(--parch4, var(--ink3));letter-spacing:.5px;margin-bottom:.3rem">📮 ' + recips + '</div>' +
        '<div style="font-size:12px;color:var(--parch2, var(--ink));line-height:1.5">' + this._esc(preview) + '</div>' +
        dmActions +
      '</div>';
    },

    _recipientList: function(h) {
      const r = h.recipients || {};
      if (r.party) return 'Party (all)';
      const names = PC_LIST.filter(function(p) { return r[p.id]; }).map(function(p) { return p.label; });
      return names.length ? names.join(', ') : '(no recipients)';
    },

    _isDraft: function(h) {
      const r = (h && h.recipients) || {};
      return !r.party && !r.sylas && !r.orin && !r.torren;
    },

    quickRelease: function(id) {
      const opts = ['1. Party (all)', '2. Sylas only', '3. Orin only', '4. Torren only', '5. Sylas + Orin', '6. Custom (open the editor)'];
      const raw = prompt('Release this handout to:\n\n' + opts.join('\n') + '\n\nEnter number:');
      const n = parseInt(raw, 10);
      let recipients = null;
      if (n === 1) recipients = { party: true };
      else if (n === 2) recipients = { sylas: true };
      else if (n === 3) recipients = { orin: true };
      else if (n === 4) recipients = { torren: true };
      else if (n === 5) recipients = { sylas: true, orin: true };
      else if (n === 6) { this.startEdit(id); return; }
      else return;
      window.HandoutsSync.update(id, { recipients: recipients })
        .catch(function(e) { alert('Release failed: ' + (e && e.message || e)); });
    },

    _wireCardClicks: function() {
      const self = this;
      this._container.querySelectorAll('.handout-card').forEach(function(card) {
        card.addEventListener('click', function() {
          const id = card.getAttribute('data-handout-id');
          self.openReveal(id);
        });
      });
    },

    openReveal: function(id) {
      const all = window.HandoutsSync.getAll();
      const h = all.find(function(x) { return x.id === id; });
      if (!h) return;
      // Mark read (unless DM)
      if (!this._dmMode && this._identity && this._identity.id) {
        window.HandoutsSync.markRead(id, this._identity.id);
      }
      let dlg = document.getElementById('handout-reveal-dialog');
      if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'handout-reveal-dialog';
        dlg.style.cssText = 'max-width:640px;width:92vw;max-height:88vh;padding:0;border:none;border-radius:6px;background:transparent';
        dlg.innerHTML = '<div id="handout-reveal-body"></div>';
        document.body.appendChild(dlg);
        dlg.addEventListener('click', function(e) { if (e.target === dlg) dlg.close(); });
      }
      const body = document.getElementById('handout-reveal-body');
      const img = h.imageUrl ? '<img src="' + this._esc(h.imageUrl) + '" style="width:100%;max-height:360px;object-fit:contain;background:#0d0a06;border-bottom:1px solid #8a6a10" onerror="this.style.display=\'none\'">' : '';
      // Letter-styled reveal: parchment background, serif body
      body.innerHTML =
        '<div style="background:#f4ead4;color:#2a1a08;border:2px solid #8a6a10;border-radius:6px;overflow:hidden;box-shadow:0 0 40px rgba(0,0,0,0.5)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem 1rem;background:linear-gradient(180deg,#e8d9b8,#d4c49a);border-bottom:1px solid #8a6a10">' +
            '<div style="font-family:\'Cinzel Decorative\',\'Cinzel\',serif;color:#4a3018;font-size:16px;letter-spacing:1px">' + this._esc(h.title) + '</div>' +
            '<button onclick="this.closest(\'dialog\').close()" style="background:transparent;border:1px solid #8a6a10;color:#4a3018;padding:3px 12px;border-radius:2px;cursor:pointer;font-family:\'Cinzel\',serif;font-size:11px">Close</button>' +
          '</div>' +
          img +
          '<div style="padding:1.5rem 1.75rem;font-family:\'Crimson Pro\',serif;font-size:15px;line-height:1.75;color:#2a1a08;white-space:pre-wrap">' + this._esc(h.body) + '</div>' +
          '<div style="padding:.5rem 1rem;background:#e8d9b8;border-top:1px solid #a88240;font-size:10.5px;color:#5a4020;text-align:right;font-style:italic">📮 to: ' + this._esc(this._recipientList(h)) + '</div>' +
        '</div>';
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    },

    startCreate: function() { this._creating = true; this._editingId = null; this.render(); },
    startEdit: function(id) { this._creating = false; this._editingId = id; this.render(); },
    cancelForm: function() { this._creating = false; this._editingId = null; this.render(); },

    _renderForm: function() {
      // New handouts default to DRAFT (no recipients). DM chooses when to
      // release — either at creation, or later via the ✏ Edit or 📤 Release
      // buttons on the card.
      let cur = { title: '', body: '', imageUrl: '', recipients: {} };
      if (this._editingId) {
        const found = window.HandoutsSync.getAll().find(function(h) { return h.id === HandoutsUI._editingId; });
        if (found) cur = found;
      }
      const rec = cur.recipients || {};
      return '<div style="border:2px solid var(--gold, #8a6a10);border-radius:4px;padding:1rem;margin-bottom:1rem;background:rgba(20,14,6,0.25)">' +
        '<div style="font-family:\'Cinzel\',serif;color:var(--gold, #8a6a10);font-size:13px;letter-spacing:1px;margin-bottom:.75rem">' + (this._editingId ? 'EDIT HANDOUT' : 'NEW HANDOUT') + '</div>' +
        '<label style="display:block;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold, #8a6a10);letter-spacing:1.5px;margin-bottom:.15rem">TITLE</label>' +
        '<input id="ho-title" type="text" value="' + this._esc(cur.title) + '" style="width:100%;padding:.4rem .5rem;margin-bottom:.6rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.5);color:var(--parch, var(--ink));border-radius:2px">' +
        '<label style="display:block;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold, #8a6a10);letter-spacing:1.5px;margin-bottom:.15rem">BODY (use blank lines for paragraphs; preserved as-is)</label>' +
        '<textarea id="ho-body" style="width:100%;min-height:160px;padding:.5rem .6rem;margin-bottom:.6rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.5);color:var(--parch, var(--ink));border-radius:2px;font-family:\'Crimson Pro\',serif;font-size:13px;resize:vertical">' + this._esc(cur.body) + '</textarea>' +
        '<label style="display:block;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold, #8a6a10);letter-spacing:1.5px;margin-bottom:.15rem">IMAGE (URL, or upload a file below)</label>' +
        '<input id="ho-image-url" type="text" placeholder="https://…" value="' + this._esc(cur.imageUrl) + '" style="width:100%;padding:.4rem .5rem;margin-bottom:.3rem;background:rgba(10,8,5,0.6);border:1px solid rgba(160,128,64,0.5);color:var(--parch, var(--ink));border-radius:2px">' +
        '<input id="ho-image-file" type="file" accept="image/*" onchange="HandoutsUI._imageToBase64(this)" style="margin-bottom:.6rem;font-size:11px">' +
        '<label style="display:block;font-family:\'Cinzel\',serif;font-size:10px;color:var(--gold, #8a6a10);letter-spacing:1.5px;margin-bottom:.3rem">RECIPIENTS <span style="font-family:\'Crimson Pro\',serif;font-size:11px;letter-spacing:.5px;color:var(--parch3, var(--ink3));font-style:italic">— leave all unchecked to save as a DRAFT (only you can see it)</span></label>' +
        '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.75rem">' +
          '<label style="display:flex;gap:.3rem;align-items:center;font-size:12px;cursor:pointer"><input type="checkbox" id="ho-r-party" ' + (rec.party ? 'checked' : '') + '> Party (all)</label>' +
          PC_LIST.map(function(p) {
            return '<label style="display:flex;gap:.3rem;align-items:center;font-size:12px;cursor:pointer"><input type="checkbox" id="ho-r-' + p.id + '" ' + (rec[p.id] ? 'checked' : '') + '> ' + p.label + '</label>';
          }).join('') +
        '</div>' +
        '<div style="display:flex;gap:.4rem;justify-content:flex-end">' +
          '<button class="action-btn" onclick="HandoutsUI.cancelForm()">Cancel</button>' +
          '<button class="action-btn" style="background:var(--gold);color:var(--ink);border-color:var(--gold)" onclick="HandoutsUI.saveForm()">' + (this._editingId ? 'Save changes' : 'Create handout') + '</button>' +
        '</div>' +
      '</div>';
    },

    _imageToBase64: function(input) {
      const file = input && input.files && input.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) { alert('Image too large. Please pick something under 500 KB (or use a URL instead).'); input.value = ''; return; }
      const reader = new FileReader();
      reader.onload = function(e) {
        const url = document.getElementById('ho-image-url');
        if (url) url.value = e.target.result;
      };
      reader.readAsDataURL(file);
    },

    saveForm: function() {
      const get = function(id) { const el = document.getElementById(id); return el ? el.value : ''; };
      const chk = function(id) { const el = document.getElementById(id); return !!(el && el.checked); };
      const payload = {
        title: get('ho-title').trim(),
        body: get('ho-body'),
        imageUrl: get('ho-image-url').trim(),
        recipients: {
          party:  chk('ho-r-party'),
          sylas:  chk('ho-r-sylas'),
          orin:   chk('ho-r-orin'),
          torren: chk('ho-r-torren')
        }
      };
      if (!payload.title) { alert('Title required.'); return; }
      // No recipients checked → saved as a DRAFT (DM-only). This is fine
      // and intentional — DM prepares handouts in advance, releases later.
      const self = this;
      const op = this._editingId
        ? window.HandoutsSync.update(this._editingId, payload)
        : window.HandoutsSync.create(payload);
      op.then(function() {
        self._creating = false;
        self._editingId = null;
        self.render();
      }).catch(function(e) { alert('Save failed: ' + (e && e.message || e)); });
    },

    deleteHandout: function(id) {
      if (!confirm('Delete this handout? This cannot be undone.')) return;
      window.HandoutsSync.delete(id).catch(function(e) { alert('Delete failed: ' + (e && e.message || e)); });
    },

    _updateNavBadge: function() {
      if (this._dmMode) return;
      const identity = this._identity;
      if (!identity) return;
      const list = window.HandoutsSync.filterForIdentity(identity);
      const unread = list.filter(function(h) { return !window.HandoutsSync.isReadBy(h, identity.id); }).length;
      const btn = document.querySelector('[data-nav-handouts]');
      if (!btn) return;
      const existing = btn.querySelector('.handouts-badge');
      if (existing) existing.remove();
      if (unread > 0) {
        const b = document.createElement('span');
        b.className = 'handouts-badge';
        b.textContent = unread;
        b.style.cssText = 'display:inline-block;background:var(--red, #a02020);color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;margin-left:.35rem;font-family:\'Cinzel\',serif;letter-spacing:.5px';
        btn.appendChild(b);
      }
    },

    _flashArrival: function(h) {
      // Skip if this identity just created it (matches by very recent createdAt)
      if (this._dmMode) return;
      // Toast
      let toast = document.getElementById('handout-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'handout-toast';
        toast.style.cssText = 'position:fixed;top:1.5rem;right:1.5rem;z-index:10000;max-width:320px;background:#f4ead4;color:#2a1a08;border:2px solid #8a6a10;border-radius:4px;padding:.6rem .9rem;box-shadow:0 4px 20px rgba(0,0,0,0.4);font-family:\'Crimson Pro\',serif;cursor:pointer;animation:handoutSlideIn .3s ease';
        document.body.appendChild(toast);
      }
      toast.innerHTML =
        '<div style="font-family:\'Cinzel\',serif;color:#4a3018;font-size:11px;letter-spacing:1px;margin-bottom:.2rem">📮 NEW HANDOUT</div>' +
        '<div style="font-family:\'Cinzel Decorative\',\'Cinzel\',serif;color:#8a6a10;font-size:14px;margin-bottom:.15rem">' + this._esc(h.title) + '</div>' +
        '<div style="font-size:11.5px;color:#5a4020;font-style:italic">click to open</div>';
      toast.style.display = 'block';
      const self = this;
      toast.onclick = function() { toast.style.display = 'none'; self.openReveal(h.id); };
      setTimeout(function() { if (toast) toast.style.display = 'none'; }, 12000);
      // Tab title flash
      this._flashTitle(h.title);
    },

    _flashTitle: function(handoutTitle) {
      if (this._titleFlashTimer) clearInterval(this._titleFlashTimer);
      const orig = document.title;
      const alt = '📮 NEW: ' + handoutTitle;
      let on = false;
      this._titleFlashTimer = setInterval(function() {
        on = !on;
        document.title = on ? alt : orig;
      }, 1200);
      // Restore on visibility
      const self = this;
      const restore = function() {
        clearInterval(self._titleFlashTimer);
        self._titleFlashTimer = null;
        document.title = orig;
        document.removeEventListener('visibilitychange', restore);
        window.removeEventListener('focus', restore);
      };
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') restore();
      });
      window.addEventListener('focus', restore);
    },

    seedStarters: function() {
      if (!confirm('Insert 8 starter handouts?\n\n5 story-critical + 3 blank templates. You can edit or delete any afterward.')) return;
      SEED_HANDOUTS.forEach(function(h) {
        window.HandoutsSync.create(h).catch(function(e) { console.warn('seed failed for', h.title, e); });
      });
    },

    _esc: function(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  };

  // Seed content — Bradley's own Eldoria campaign material, drafted in-fiction
  // for release when the party earns them. Edit / delete via DM UI.
  const SEED_HANDOUTS = [
    {
      title: "K's Note (Pig's Head Inn access)",
      body: "Show this at the back door after the second bell. Ask for the mender.\n\nThey will let you through. Speak only to those who wear the moss-mark. No names.\n\nDo not come again if you are followed. Do not come at all if the sky is clear — cloud only.\n\n— K",
      imageUrl: '',
      recipients: {}  // DRAFT — release when the party physically obtains the note
    },
    {
      title: "Letter from Rulden Marr to Orin",
      body: "Orin,\n\nI have heard where you are and what you are asking after. Stop asking. The road you are walking leads to places I cannot follow, and to people who will not know the son I raised.\n\nI cannot tell you what I have become or why. I will not. But I can tell you this: nothing you find will bring back the man who taught you the morning prayer. He is gone. Only I remain, and I am not fit company for a cleric of Luminos.\n\nGo home. Find another road.\n\nAnd if you cannot — if you truly cannot — then keep to the light, Orin. Whatever else you do. Keep to the light.\n\n— R",
      imageUrl: '',
      recipients: { orin: true }
    },
    {
      title: "Sylas's Spellbook — Frontispiece",
      body: "For Sylas Duskrun, on the occasion of his graduation from the Circle.\n\nA scholar's tools should outlast the scholar. May this one serve you longer than it served me.\n\nRead every page. Then read them again. There are two kinds of knowledge in this book — the kind that fits in the words, and the kind that fits between them. Both are yours, if you are patient.\n\nYou will find, in time, that certain pages you do not remember writing. Do not be alarmed. The book is old, and it has habits.\n\n— V.D.",
      imageUrl: '',
      recipients: { sylas: true }
    },
    {
      title: "Coin Cipher — Scrap Found in Bag",
      body: "A folded slip of vellum, no bigger than a coin. Ink is fresh. The hand is not yours.\n\n    3 — 7 — 1 — 4 — 9 — 2\n    a debt owed at the eclipse\n    the third coin opens the fourth\n    do not spend the last\n\nThe rest of the page has been torn away.",
      imageUrl: '',
      recipients: {}  // DRAFT — release if/when Sylas finds a scrap in his bag
    },
    {
      title: "WANTED — By Order of the Compound",
      body: "By order of Master Halvor of the Ironhold Compound —\n\nThe following persons are wanted for questioning regarding recent trespass, assault, and the removal of protected property from Compound grounds.\n\nInquiries and any credible sighting to be brought directly to the Compound gate. A finder's fee applies.\n\nDo NOT approach if armed. Do NOT engage if in company of the Watch.\n\n[descriptions and sketches on the reverse]\n\nPosted this day in every guildhall, tavern, and gate-post of Ironhold. Copies to be sent to the northern roads and to Duskmere.\n\n— The Compound",
      imageUrl: '',
      recipients: {}  // DRAFT — release after the party publicly acts against Halvor
    },
    {
      title: "Template — Signed Contract",
      body: "(Replace with contract text. Blank template.)\n\nSigned this ___ day of ___, in the ___ Age, at ___.\n\n___________________          ___________________\n(first party)                (second party)\n\nWitnessed by ___________________________________.",
      imageUrl: '',
      recipients: {}
    },
    {
      title: "Template — Map Fragment",
      body: "(Replace with map description or attach an image via the URL / upload field. Blank template.)",
      imageUrl: '',
      recipients: {}
    },
    {
      title: "Template — Merchant's Ledger Page",
      body: "Ledger — [merchant name] — [month, year]\n\n  Day    Item                     Sold to           Price\n  ----   ----                     -------           -----\n  1      _______________          _______________   ___ gp\n  2      _______________          _______________   ___ gp\n  3      _______________          _______________   ___ gp\n  4      _______________          _______________   ___ gp\n  5      _______________          _______________   ___ gp\n\n(Blank template. Fill or duplicate rows as needed.)",
      imageUrl: '',
      recipients: {}
    }
  ];

  window.HandoutsUI = HandoutsUI;
})();

// =====================================================================
// THE WAYWARD COMPANY — HANDOUTS (Update 24)
// ---------------------------------------------------------------------
// Firebase-synced per-recipient handouts (letters, maps, notes the DM
// wants to deliver live during a session).
//
// Firebase path /handouts/<id>:
//   {
//     title, body, imageUrl,
//     recipients: { sylas:true, orin:true, torren:true, party:true },
//     createdAt, updatedAt,
//     readBy: { <identityId>: timestamp }
//   }
//
// Public API:
//   HandoutsSync.init()
//   HandoutsSync.ready
//   HandoutsSync.subscribe(cb)         cb receives array of all handouts
//   HandoutsSync.create(handout)       returns Promise<id>
//   HandoutsSync.update(id, patch)
//   HandoutsSync.delete(id)
//   HandoutsSync.markRead(id, identityId)
//   HandoutsSync.filterForIdentity(identity)  visible-to-that-identity subset
//   HandoutsSync.isReadBy(handout, identityId)
// =====================================================================
(function() {
  'use strict';

  const PATH = 'handouts';
  // Update 65c — unreleased drafts (no recipients) live in /handouts-drafts,
  // readable only by the signed-in DM. Releasing one moves it to /handouts.
  const DRAFTS_PATH = 'handouts-drafts';
  const isDraft = function(r) { r = r || {}; return !Object.keys(r).some(function(k) { return r[k]; }); };

  const HandoutsSync = {
    ready: false,
    _ref: null,
    _cache: {},
    _drafts: {},
    _draftsRef: null,
    _subs: [],

    init: function() {
      if (typeof firebase === 'undefined' || !firebase.database) {
        console.warn('[HandoutsSync] Firebase SDK not loaded — handouts disabled.');
        return false;
      }
      try {
        this._ref = firebase.database().ref(PATH);
        this._draftsRef = firebase.database().ref(DRAFTS_PATH);
        this.ready = true;
        const self = this;
        if (window.DMAuth) DMAuth.ready.then(function(signedIn) {
          if (!signedIn) return;
          self._draftsRef.on('value', function(snap) { self._drafts = snap.val() || {}; self._fire(); },
            function(err) { console.warn('[HandoutsSync] Drafts unavailable:', err && err.message); });
          // Any unreleased draft still sitting in the players' section (from
          // before Update 65c) is moved into the locked drafts section.
          self._ref.once('value').then(function(snap) {
            const all = snap.val() || {};
            Object.keys(all).forEach(function(id) {
              if (!isDraft(all[id].recipients)) return;
              self._draftsRef.child(id).set(all[id]).then(function() { return self._ref.child(id).remove(); })
                .then(function() { console.log('[HandoutsSync] Moved draft to locked section:', all[id].title); })
                .catch(function(e) { console.warn('[HandoutsSync] Could not move draft', id, e && e.message); });
            });
          });
        });
        this._ref.on('value', function(snap) {
          const prev = self._cache || {};
          self._cache = snap.val() || {};
          self._fire();
          self._detectNewArrivals(prev, self._cache);
        });
        console.log('[HandoutsSync] Connected to Firebase RTDB /handouts.');
        return true;
      } catch (e) {
        console.warn('[HandoutsSync] Init failed:', e);
        return false;
      }
    },

    subscribe: function(cb) {
      if (typeof cb !== 'function') return;
      this._subs.push(cb);
      if (this.ready) { try { cb(this.getAll()); } catch (e) {} }
    },

    _fire: function() {
      const arr = this.getAll();
      this._subs.forEach(function(cb) { try { cb(arr); } catch (e) {} });
    },

    getAll: function() {
      const raw = Object.assign({}, this._drafts || {}, this._cache || {});
      const arr = Object.keys(raw).map(function(id) {
        return Object.assign({ id: id }, raw[id]);
      });
      arr.sort(function(a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); });
      return arr;
    },

    create: function(h) {
      if (!this.ready) return Promise.reject(new Error('HandoutsSync not ready'));
      if (!h || !h.title) return Promise.reject(new Error('title required'));
      const now = firebase.database.ServerValue.TIMESTAMP;
      const payload = {
        title: String(h.title || '').slice(0, 200),
        body: String(h.body || ''),
        imageUrl: String(h.imageUrl || ''),
        recipients: h.recipients || { party: true },
        createdAt: now,
        updatedAt: now,
        readBy: {}
      };
      const newRef = (isDraft(payload.recipients) ? this._draftsRef : this._ref).push();
      return newRef.set(payload).then(function() { return newRef.key; });
    },

    update: function(id, patch) {
      if (!this.ready || !id || !patch) return Promise.reject(new Error('id + patch required'));
      const clean = {};
      if (patch.title !== undefined) clean.title = String(patch.title).slice(0, 200);
      if (patch.body !== undefined) clean.body = String(patch.body);
      if (patch.imageUrl !== undefined) clean.imageUrl = String(patch.imageUrl);
      if (patch.recipients !== undefined) clean.recipients = patch.recipients;
      clean.updatedAt = firebase.database.ServerValue.TIMESTAMP;
      const inDrafts = !!(this._drafts || {})[id];
      const cur = (inDrafts ? this._drafts : this._cache)[id] || {};
      const goesDraft = isDraft(clean.recipients !== undefined ? clean.recipients : cur.recipients);
      if (goesDraft !== inDrafts) {   // released or pulled back: move it
        const merged = JSON.parse(JSON.stringify(Object.assign({}, cur, clean, { updatedAt: Date.now() })));
        const from = inDrafts ? this._draftsRef : this._ref, to = goesDraft ? this._draftsRef : this._ref;
        return to.child(id).set(merged).then(function() { return from.child(id).remove(); });
      }
      return (inDrafts ? this._draftsRef : this._ref).child(id).update(clean);
    },

    delete: function(id) {
      if (!this.ready || !id) return Promise.reject(new Error('id required'));
      return ((this._drafts || {})[id] ? this._draftsRef : this._ref).child(id).remove();
    },

    markRead: function(id, identityId) {
      if (!this.ready || !id || !identityId) return Promise.resolve();
      return this._ref.child(id).child('readBy').child(identityId).set(firebase.database.ServerValue.TIMESTAMP);
    },

    isReadBy: function(h, identityId) {
      return !!(h && h.readBy && h.readBy[identityId]);
    },

    // A handout is visible to an identity if:
    //   - the identity IS the recipient (recipients[identityId] === true), OR
    //   - recipients.party === true, OR
    //   - the identity is the DM (sees everything, including drafts)
    // A "draft" (no recipients checked) is DM-only.
    filterForIdentity: function(identity) {
      if (!identity) return [];
      const arr = this.getAll();
      if (identity.role === 'dm') return arr;
      return arr.filter(function(h) {
        const r = h.recipients || {};
        return r.party || r[identity.id];
      });
    },

    _detectNewArrivals: function(prev, cur) {
      // Fire arrival callbacks for handouts the current identity can see
      // that weren't in the previous snapshot. Also fires when an existing
      // handout was previously a draft (no recipients) and now targets us —
      // that's the "released" moment.
      const identity = window._currentIdentity;
      if (!identity) return;
      const cbs = this._arrivalCbs || [];
      if (!cbs.length) return;
      function isVisibleTo(h, id) {
        const r = (h && h.recipients) || {};
        return (id.role === 'dm') || r.party || r[id.id];
      }
      Object.keys(cur).forEach(function(id) {
        const prevH = prev[id];
        const curH = Object.assign({ id: id }, cur[id]);
        const nowVisible = isVisibleTo(curH, identity);
        if (!nowVisible) return;
        // Was it visible before? If yes, no arrival. If no, fire.
        const wasVisible = prevH ? isVisibleTo(Object.assign({ id: id }, prevH), identity) : false;
        if (wasVisible) return;
        cbs.forEach(function(cb) { try { cb(curH); } catch (e) {} });
      });
    },

    onArrival: function(cb) {
      if (typeof cb !== 'function') return;
      this._arrivalCbs = this._arrivalCbs || [];
      this._arrivalCbs.push(cb);
    }
  };

  window.HandoutsSync = HandoutsSync;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { HandoutsSync.init(); });
  } else {
    setTimeout(function() { HandoutsSync.init(); }, 50);
  }
})();

// =====================================================================
// THE WAYWARD COMPANY — DM LOCK (Update 65b)
// ---------------------------------------------------------------------
// The public site serves DM pages, DM data and DM scripts ENCRYPTED with
// the DM passphrase (tools/build_public_site.py). This file unlocks them
// in the browser. It holds no secrets itself.
//
// Format of an encrypted file (.enc): JSON { v:1, iv, ct, mac } (base64).
//   key bits = PBKDF2-SHA256(passphrase, SHA-256(SALT_TEXT), ITER, 512 bits)
//   first 256 bits → AES-256-CBC key, last 256 bits → HMAC-SHA256 key
//   mac = HMAC(iv || ct) — checked before decrypting (wrong passphrase → fail)
//
// After a successful unlock the derived key (never the passphrase) is kept
// in this browser for 30 days so DM pages open without asking again.
// =====================================================================
(function() {
  'use strict';
  if (window.DMCrypt) return;

  var SALT_TEXT = 'wayward-company-dm-v1';
  var ITER = 600000;
  var LS_KEY = 'eldoria-dm-key-v1';
  var DAYS = 30;
  var te = new TextEncoder(), td = new TextDecoder();

  function b64to(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function b64from(str) { var bin = atob(str), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  function concat(a, b) { var o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }

  function deriveBits(pass) {
    return Promise.all([
      crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveBits']),
      crypto.subtle.digest('SHA-256', te.encode(SALT_TEXT))
    ]).then(function(r) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new Uint8Array(r[1]), iterations: ITER, hash: 'SHA-256' }, r[0], 512);
    }).then(function(bits) { return new Uint8Array(bits); });
  }
  function keysFromBits(bits) {
    return Promise.all([
      crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-CBC' }, false, ['decrypt']),
      crypto.subtle.importKey('raw', bits.slice(32, 64), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    ]).then(function(k) { return { enc: k[0], mac: k[1] }; });
  }
  function cachedBits() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.k || Date.now() > o.exp) { localStorage.removeItem(LS_KEY); return null; }
      return b64from(o.k);
    } catch (e) { return null; }
  }
  function cacheBits(bits) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ k: b64to(bits), exp: Date.now() + DAYS * 864e5 })); } catch (e) {}
  }

  var _keys = null;
  function getKeys() {
    if (_keys) return Promise.resolve(_keys);
    var b = cachedBits();
    if (!b) return Promise.resolve(null);
    return keysFromBits(b).then(function(k) { _keys = k; return k; });
  }
  function decryptBlob(keys, blob) {
    var iv = b64from(blob.iv), ct = b64from(blob.ct), mac = b64from(blob.mac);
    return crypto.subtle.verify('HMAC', keys.mac, mac, concat(iv, ct)).then(function(ok) {
      if (!ok) throw new Error('wrong-passphrase');
      return crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv }, keys.enc, ct);
    }).then(function(buf) { return new Uint8Array(buf); });
  }
  function fetchBlob(url) {
    return fetch(url, { cache: 'no-store' }).then(function(r) {
      if (!r.ok) { var e = new Error('missing'); e.status = r.status; throw e; }
      return r.json();
    });
  }

  var DMCrypt = {
    isUnlocked: function() { return !!cachedBits(); },
    lock: function() { try { localStorage.removeItem(LS_KEY); } catch (e) {} _keys = null; },

    // Decrypt an .enc file to text with the remembered key.
    decryptText: function(url) {
      return getKeys().then(function(keys) {
        if (!keys) throw new Error('locked');
        return fetchBlob(url).then(function(blob) { return decryptBlob(keys, blob); });
      }).then(function(bytes) { return td.decode(bytes); });
    },

    // Make fetch('data/<name>.json') transparently read data/<name>.json.enc.
    installFetch: function(names) {
      if (window.__dmFetchInstalled) return;
      window.__dmFetchInstalled = true;
      var orig = window.fetch.bind(window);
      window.fetch = function(input, init) {
        var url = (typeof input === 'string') ? input : (input && input.url) || '';
        var m = url.match(/(^|\/)data\/([a-z0-9-]+)\.json(\?.*)?$/);
        if (m && names.indexOf(m[2]) !== -1) {
          var encUrl = url.replace(/\.json(\?.*)?$/, '.json.enc');
          return DMCrypt.decryptText(encUrl).then(function(text) {
            return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
          }, function() { return new Response('{}', { status: 404 }); });
        }
        return orig(input, init);
      };
    },

    // Load a DM-only script: the encrypted copy if this device is unlocked,
    // or the plain file when running from the private source (no .enc).
    // Resolves true if loaded, false if locked/unavailable. Never rejects.
    loadScript: function(name) {
      function run(code) { var s = document.createElement('script'); s.textContent = code; document.head.appendChild(s); return true; }
      return fetch(name + '.enc', { cache: 'no-store' }).then(function(r) {
        if (r.ok) {
          return DMCrypt.isUnlocked() ? DMCrypt.decryptText(name + '.enc').then(run) : false;
        }
        return fetch(name, { cache: 'no-store' }).then(function(p) { return p.ok ? p.text().then(run) : false; });
      }).catch(function() { return false; });
    },

    // Lock screen for an encrypted page: decrypt <encUrl> and replace this
    // document with it. Asks for the passphrase if this device isn't unlocked.
    openLockedPage: function(encUrl) {
      function show(html) { document.open(); document.write(html); document.close(); }
      function tryRemembered() {
        return getKeys().then(function(keys) {
          if (!keys) return false;
          return fetchBlob(encUrl).then(function(blob) { return decryptBlob(keys, blob); })
            .then(function(bytes) { show(td.decode(bytes)); return true; })
            .catch(function() { DMCrypt.lock(); return false; });
        });
      }
      tryRemembered().then(function(done) {
        if (done) return;
        var box = document.getElementById('dm-lock');
        if (box) box.style.display = 'block';
        var form = document.getElementById('dm-lock-form');
        var input = document.getElementById('dm-lock-pass');
        var msg = document.getElementById('dm-lock-msg');
        var btn = document.getElementById('dm-lock-btn');
        if (input) input.focus();
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          var pass = (input.value || '').trim().toLowerCase().replace(/\s+/g, ' ');
          if (!pass) return;
          btn.disabled = true; msg.textContent = 'Unlocking…'; msg.style.color = '#d4c49a';
          var bits;
          deriveBits(pass).then(function(b) { bits = b; return keysFromBits(b); })
            .then(function(keys) { return fetchBlob(encUrl).then(function(blob) { return decryptBlob(keys, blob); }).then(function(bytes) { _keys = keys; return bytes; }); })
            .then(function(bytes) { cacheBits(bits); show(td.decode(bytes)); })
            .catch(function(err) {
              btn.disabled = false;
              msg.style.color = '#e08080';
              msg.textContent = (err && err.message === 'wrong-passphrase') ? 'That passphrase didn\'t work. Try again.' : 'Could not load this page. Check your connection.';
              input.select();
            });
        });
      });
    }
  };

  window.DMCrypt = DMCrypt;
})();

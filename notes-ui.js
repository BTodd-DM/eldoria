// =====================================================================
// THE WAYWARD COMPANY — NOTES UI (Phase 6)
// ---------------------------------------------------------------------
// Renderable notes widget. Embeds into any container div.
//
// Usage:
//   initNotesWidget('notes-container');                      // reads window.WAYWARD_IDENTITY
//   initNotesWidget('notes-container', { id: 'dm', role: 'dm', label: 'DM' });  // explicit identity (DM dashboard)
//
// Depends on notes-sync.js.
// =====================================================================

const NOTES_SCOPES = [
  { id: 'private',    label: 'Private',       hint: 'Only you can see this',                    color: '#8a5a1a' },
  { id: 'dm-only',    label: 'DM-only',       hint: 'You and the DM can see this',              color: '#7a1a1a' },
  { id: 'dm-party',   label: 'DM + Party',    hint: 'Everyone in the group can see this',       color: '#0d4a2a' },
  { id: 'party-only', label: 'Party-only',    hint: 'Other players can see this — hidden from DM', color: '#2d5a7a' },
  { id: 'to-player',  label: '📮 To Player',  hint: 'DM handout to one specific player (letter, evidence, dream)', color: '#4a2d7a' }
];
const NOTES_SCOPES_BY_ID = NOTES_SCOPES.reduce(function(m, s) { m[s.id] = s; return m; }, {});

// Player identities available as handout recipients. Extend if a new player joins.
const NOTES_PLAYER_RECIPIENTS = [
  { id: 'torren', label: 'Torren' },
  { id: 'sylas',  label: 'Sylas' },
  { id: 'orin',   label: 'Orin' }
];

// Author labels (fall back to id if unknown).
const NOTES_AUTHOR_LABELS = {
  torren: 'Torren',
  sylas:  'Sylas',
  orin:   'Orin',
  dm:     'DM'
};

function _notesEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _notesEscapeBody(s) {
  return _notesEscape(s).replace(/\n/g, '<br>');
}
function _notesFmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const opts = sameYear
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleString(undefined, opts);
}

let _notesWidgetState = {
  containerId: null,
  identity: null,
  activeScope: 'all',    // 'all' | scope id
  authorFilter: 'all',   // 'all' | author id
  editingNoteId: null,   // if non-null, edit form is showing for this note
  creating: false        // if true, create form is showing
};

function initNotesWidget(containerId, identityOverride) {
  const container = document.getElementById(containerId);
  if (!container) return;
  _injectNotesCSS();
  const identity = identityOverride || window.WAYWARD_IDENTITY;
  if (!identity) {
    container.innerHTML = '<div style="padding:1rem;color:#888;font-style:italic;text-align:center">Notes require login.</div>';
    return;
  }
  _notesWidgetState.containerId = containerId;
  _notesWidgetState.identity = identity;
  _notesWidgetState.activeScope = 'all';
  _notesWidgetState.authorFilter = 'all';
  _notesWidgetState.editingNoteId = null;
  _notesWidgetState.creating = false;

  container.innerHTML = '<div style="padding:1rem;color:#888;font-style:italic;text-align:center">Loading notes…</div>';

  // Subscribe once. NotesSync will fire immediately with current state.
  if (typeof NotesSync === 'undefined' || !NotesSync) {
    container.innerHTML = '<div style="padding:1rem;color:#a02020;font-style:italic;text-align:center">Notes sync not loaded.</div>';
    return;
  }
  NotesSync.subscribe(function(allNotes) {
    _renderNotesWidget(allNotes);
  });
}

function _renderNotesWidget(allNotes) {
  const state = _notesWidgetState;
  const container = document.getElementById(state.containerId);
  if (!container) return;
  const identity = state.identity;
  if (!identity) return;

  const visible = NotesSync.filterVisible(allNotes, identity);
  // Apply scope + author + tag + unread filters
  const filtered = visible.filter(function(n) {
    if (state.activeScope !== 'all' && n.scope !== state.activeScope) return false;
    if (state.authorFilter !== 'all' && n.author !== state.authorFilter) return false;
    if (state.tagFilter && (!n.tags || n.tags.indexOf(state.tagFilter) < 0)) return false;
    if (state.unreadOnly && NotesSync.isReadBy && NotesSync.isReadBy(n, identity.id)) return false;
    return true;
  });
  // Build tag chip bar from all visible notes
  const tagSet = {};
  visible.forEach(function(n) { (n.tags || []).forEach(function(t) { if (t) tagSet[t] = (tagSet[t] || 0) + 1; }); });
  const tagList = Object.keys(tagSet).sort();
  const unreadCount = visible.filter(function(n) { return !NotesSync.isReadBy(n, identity.id); }).length;
  const chipBar = (tagList.length || unreadCount > 0) ?
    '<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin:.4rem 0;font-size:11px;align-items:center">' +
      '<button onclick="notesWidgetToggleUnreadOnly()" style="background:' + (state.unreadOnly ? 'var(--gold,#8a6a10)' : 'transparent') + ';color:' + (state.unreadOnly ? '#fff' : 'var(--gold,#8a6a10)') + ';border:1px solid var(--gold,#8a6a10);border-radius:10px;padding:2px 8px;cursor:pointer;font-family:Cinzel,serif;font-size:10px;letter-spacing:.5px">' + (state.unreadOnly ? '● unread only ✓' : '● unread (' + unreadCount + ')') + '</button>' +
      tagList.map(function(t) {
        const active = state.tagFilter === t;
        return '<button onclick="notesWidgetFilterByTag(\'' + t + '\')" style="background:' + (active ? 'var(--gold,#8a6a10)' : 'transparent') + ';color:' + (active ? '#fff' : 'var(--gold,#8a6a10)') + ';border:1px solid var(--gold,#8a6a10);border-radius:10px;padding:2px 8px;cursor:pointer;font-family:Cinzel,serif;font-size:10px;letter-spacing:.5px">#' + t + ' (' + tagSet[t] + ')</button>';
      }).join('') +
      (state.tagFilter ? '<button onclick="notesWidgetClearTagFilter()" style="background:transparent;color:var(--ink3,#5a4020);border:1px dashed var(--ink3,#5a4020);border-radius:10px;padding:2px 8px;cursor:pointer;font-size:10px">✕ clear tag</button>' : '') +
    '</div>' : '';

  // Which scopes can this identity CREATE?
  const canCreate = _createableScopes(identity);

  // Unique author list from visible notes for the filter dropdown
  const authorSet = {};
  visible.forEach(function(n) { authorSet[n.author] = true; });
  const authorList = Object.keys(authorSet).sort();

  let html = '';
  html += _renderNotesHeader(canCreate);
  html += _renderScopeTabs(state.activeScope);
  html += _renderAuthorFilter(state.authorFilter, authorList);
  html += chipBar;

  if (state.creating) {
    html += _renderCreateForm(canCreate);
  }

  html += '<div class="wc-notes-list">';
  if (filtered.length === 0) {
    html += '<div class="wc-notes-empty">' + _emptyMessage(state, allNotes.length, visible.length) + '</div>';
  } else {
    filtered.forEach(function(note) {
      if (state.editingNoteId === note.id) {
        html += _renderEditForm(note, canCreate);
      } else {
        html += _renderNoteCard(note, identity);
      }
    });
  }
  html += '</div>';

  container.innerHTML = html;
}

function _createableScopes(identity) {
  if (identity.role === 'dm') {
    // DM: private, dm-only, dm-party, to-player (NOT party-only — hidden from DM).
    return NOTES_SCOPES.filter(function(s) { return s.id !== 'party-only'; });
  }
  // Player: everything except to-player (DM-only handout scope).
  return NOTES_SCOPES.filter(function(s) { return s.id !== 'to-player'; });
}

function _emptyMessage(state, totalCount, visibleCount) {
  if (visibleCount === 0) {
    return 'No notes yet. Click <em>+ New Note</em> above.';
  }
  return 'No notes match the current filter.';
}

function _renderNotesHeader(canCreate) {
  return '<div class="wc-notes-header">' +
    '<div class="wc-notes-title">Notes</div>' +
    '<button class="wc-notes-newbtn" onclick="notesWidgetStartCreate()">＋ New Note</button>' +
    '</div>';
}

function _renderScopeTabs(active) {
  let html = '<div class="wc-notes-scope-tabs">';
  const tabs = [{ id: 'all', label: 'All', color: '#555' }].concat(NOTES_SCOPES);
  tabs.forEach(function(t) {
    const isActive = t.id === active;
    html += '<button class="wc-notes-scope-tab ' + (isActive ? 'on' : '') + '" ' +
      'style="' + (isActive ? 'background:' + t.color + ';color:#fff;' : 'color:' + t.color + ';border-color:' + t.color + ';') + '" ' +
      'onclick="notesWidgetSetScope(\'' + t.id + '\')">' + _notesEscape(t.label) + '</button>';
  });
  html += '</div>';
  return html;
}

function _renderAuthorFilter(active, authors) {
  if (authors.length === 0) return '';
  let html = '<div class="wc-notes-author-filter">Author: ' +
    '<select onchange="notesWidgetSetAuthor(this.value)">' +
    '<option value="all"' + (active === 'all' ? ' selected' : '') + '>All</option>';
  authors.forEach(function(a) {
    const label = NOTES_AUTHOR_LABELS[a] || a;
    html += '<option value="' + _notesEscape(a) + '"' + (active === a ? ' selected' : '') + '>' + _notesEscape(label) + '</option>';
  });
  html += '</select></div>';
  return html;
}

function _renderNoteCard(note, identity) {
  const scope = NOTES_SCOPES_BY_ID[note.scope] || { label: note.scope, color: '#555' };
  const authorLabel = NOTES_AUTHOR_LABELS[note.author] || note.author;
  const isAuthor = note.author === identity.id;
  const bodyHtml = _notesEscapeBody(note.body || '');
  const titleHtml = note.title ? '<div class="wc-note-title">' + _notesEscape(note.title) + '</div>' : '';
  const isRead = NotesSync.isReadBy ? NotesSync.isReadBy(note, identity.id) : false;
  const readBtn = '<button class="wc-note-read" onclick="notesWidgetToggleRead(\'' + note.id + '\')" title="Toggle read/unread">' + (isRead ? '✓ read' : '● unread') + '</button>';
  const actions = (isAuthor
    ? '<button class="wc-note-edit" onclick="notesWidgetStartEdit(\'' + note.id + '\')">Edit</button>' +
      '<button class="wc-note-del" onclick="notesWidgetDelete(\'' + note.id + '\')">Delete</button>'
    : '') + readBtn;
  const tagsHtml = (note.tags && note.tags.length)
    ? '<div class="wc-note-tags" style="margin-top:.35rem;display:flex;flex-wrap:wrap;gap:.25rem">' +
      note.tags.map(function(t) {
        return '<span onclick="notesWidgetFilterByTag(\'' + _notesEscape(t) + '\')" style="background:rgba(160,128,64,0.18);color:var(--gold,#8a6a10);padding:1px 6px;border-radius:8px;font-size:10px;font-family:Cinzel,serif;letter-spacing:.5px;cursor:pointer" title="Filter by #' + _notesEscape(t) + '">#' + _notesEscape(t) + '</span>';
      }).join('') + '</div>'
    : '';
  const unreadBorder = isRead ? '' : ';box-shadow:inset 3px 0 0 rgba(201,168,76,0.6)';
  // Handout-specific decoration
  let recipientBadge = '';
  let handoutBanner = '';
  if (note.scope === 'to-player' && note.recipient) {
    const recLabel = NOTES_AUTHOR_LABELS[note.recipient] || note.recipient;
    if (isAuthor) {
      // DM viewing their own handout — show "→ To: <player>" badge
      recipientBadge = '<span style="background:rgba(74,45,122,0.6);color:#fff;padding:2px 8px;border-radius:10px;font-size:9.5px;letter-spacing:1px;font-weight:600;margin-left:.3rem">→ To: ' + _notesEscape(recLabel) + '</span>';
    } else if (identity.id === note.recipient) {
      // Player viewing a handout addressed to them — prominent "From DM" banner
      handoutBanner = '<div style="background:rgba(74,45,122,0.15);border:1px dashed rgba(74,45,122,0.6);border-radius:3px;padding:.35rem .5rem;margin-bottom:.4rem;color:#a48bd6;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px">📮 <strong>From the DM — for your eyes only</strong></div>';
    }
  }
  return '<div class="wc-note-card" data-note-id="' + note.id + '" data-tags="' + _notesEscape((note.tags || []).join(',')) + '" data-read="' + (isRead ? '1' : '0') + '" style="border-left-color:' + scope.color + unreadBorder + '">' +
    handoutBanner +
    '<div class="wc-note-head">' +
      '<span class="wc-note-scope" style="background:' + scope.color + '">' + _notesEscape(scope.label) + '</span>' +
      recipientBadge +
      '<span class="wc-note-author">' + _notesEscape(authorLabel) + '</span>' +
      '<span class="wc-note-time">' + _notesFmtTime(note.updatedAt || note.createdAt) + '</span>' +
      '<span class="wc-note-actions">' + actions + '</span>' +
    '</div>' +
    titleHtml +
    '<div class="wc-note-body">' + bodyHtml + '</div>' +
    tagsHtml +
    '</div>';
}

function _renderCreateForm(canCreate) {
  return _renderNoteForm({
    id: null,
    scope: canCreate[0] ? canCreate[0].id : 'private',
    title: '',
    body: ''
  }, canCreate, 'Create note', 'notesWidgetSaveCreate', 'notesWidgetCancelCreate');
}
function _renderEditForm(note, canCreate) {
  return _renderNoteForm(note, canCreate, 'Edit note', 'notesWidgetSaveEdit', 'notesWidgetCancelEdit');
}
function _renderNoteForm(note, canCreate, label, saveHandler, cancelHandler) {
  let scopeOpts = '';
  canCreate.forEach(function(s) {
    const sel = s.id === note.scope ? ' selected' : '';
    scopeOpts += '<option value="' + s.id + '"' + sel + '>' + s.label + ' — ' + s.hint + '</option>';
  });
  const recipientOptsArr = NOTES_PLAYER_RECIPIENTS.map(function(r) {
    const sel = (note.recipient === r.id) ? ' selected' : '';
    return '<option value="' + r.id + '"' + sel + '>' + r.label + '</option>';
  });
  const recipientOpts = recipientOptsArr.join('');
  const recipientRowStyle = (note.scope === 'to-player') ? '' : 'display:none';
  return '<div class="wc-note-form">' +
    '<div class="wc-note-form-label">' + label + '</div>' +
    '<label>Scope: <select id="wc-note-form-scope" onchange="_notesUpdateRecipientVisibility()">' + scopeOpts + '</select></label>' +
    '<label id="wc-note-form-recipient-row" style="' + recipientRowStyle + '">📮 Send to: <select id="wc-note-form-recipient">' + recipientOpts + '</select></label>' +
    '<input type="text" id="wc-note-form-title" placeholder="Title (optional)" value="' + _notesEscape(note.title || '') + '" maxlength="200">' +
    '<input type="text" id="wc-note-form-tags" placeholder="Tags (comma-separated, e.g. session-6, ironhold, mira)" value="' + _notesEscape((note.tags || []).join(', ')) + '">' +
    '<textarea id="wc-note-form-body" placeholder="Write your note…" rows="6">' + _notesEscape(note.body || '') + '</textarea>' +
    '<div class="wc-note-form-actions">' +
      '<button class="wc-note-form-save" onclick="' + saveHandler + '(' + (note.id ? '\'' + note.id + '\'' : '') + ')">Save</button>' +
      '<button class="wc-note-form-cancel" onclick="' + cancelHandler + '()">Cancel</button>' +
    '</div>' +
    '</div>';
}

function _notesUpdateRecipientVisibility() {
  const scope = document.getElementById('wc-note-form-scope');
  const row = document.getElementById('wc-note-form-recipient-row');
  if (!scope || !row) return;
  row.style.display = (scope.value === 'to-player') ? '' : 'none';
}

// -------- Handler functions (called from onclick) --------
function notesWidgetSetScope(scope)      { _notesWidgetState.activeScope = scope; _notesWidgetState.creating = false; _notesWidgetState.editingNoteId = null; _rerender(); }
function notesWidgetSetAuthor(author)    { _notesWidgetState.authorFilter = author; _rerender(); }
function notesWidgetStartCreate()        { _notesWidgetState.creating = true; _notesWidgetState.editingNoteId = null; _rerender(); }
function notesWidgetCancelCreate()       { _notesWidgetState.creating = false; _rerender(); }
function notesWidgetSaveCreate() {
  const scope = document.getElementById('wc-note-form-scope').value;
  const title = document.getElementById('wc-note-form-title').value;
  const body = document.getElementById('wc-note-form-body').value;
  const tagsRaw = (document.getElementById('wc-note-form-tags') || {}).value || '';
  const tags = tagsRaw.split(',').map(function(t) { return t.trim().toLowerCase().replace(/^#/, ''); }).filter(Boolean);
  if (!body.trim()) { alert('Note body is empty.'); return; }
  const identity = _notesWidgetState.identity;
  const payload = { author: identity.id, scope: scope, title: title, body: body, tags: tags };
  if (scope === 'to-player') {
    const rec = document.getElementById('wc-note-form-recipient');
    if (!rec || !rec.value) { alert('Pick a recipient.'); return; }
    payload.recipient = rec.value;
  }
  NotesSync.create(payload).then(function() {
    _notesWidgetState.creating = false;
    _rerender();
  }).catch(function(e) { alert('Create failed: ' + (e && e.message || e)); });
}
function notesWidgetStartEdit(noteId)    { _notesWidgetState.editingNoteId = noteId; _notesWidgetState.creating = false; _rerender(); }
function notesWidgetCancelEdit()         { _notesWidgetState.editingNoteId = null; _rerender(); }
function notesWidgetSaveEdit(noteId) {
  const scope = document.getElementById('wc-note-form-scope').value;
  const title = document.getElementById('wc-note-form-title').value;
  const body = document.getElementById('wc-note-form-body').value;
  const tagsRaw = (document.getElementById('wc-note-form-tags') || {}).value || '';
  const tags = tagsRaw.split(',').map(function(t) { return t.trim().toLowerCase().replace(/^#/, ''); }).filter(Boolean);
  if (!body.trim()) { alert('Note body is empty.'); return; }
  const patch = { scope: scope, title: title, body: body, tags: tags };
  if (scope === 'to-player') {
    const rec = document.getElementById('wc-note-form-recipient');
    if (!rec || !rec.value) { alert('Pick a recipient.'); return; }
    patch.recipient = rec.value;
  } else {
    patch.recipient = null; // clear if scope changed away from to-player
  }
  NotesSync.update(noteId, patch).then(function() {
    _notesWidgetState.editingNoteId = null;
    _rerender();
  }).catch(function(e) { alert('Update failed: ' + (e && e.message || e)); });
}
function notesWidgetDelete(noteId) {
  if (!confirm('Delete this note? This cannot be undone.')) return;
  NotesSync.delete(noteId).catch(function(e) { alert('Delete failed: ' + (e && e.message || e)); });
}
function notesWidgetToggleRead(noteId) {
  const identity = _notesWidgetState.identity;
  if (!identity || !NotesSync.markRead) return;
  const notes = NotesSync.getAllNotes();
  const note = notes.find(function(n) { return n.id === noteId; });
  const isRead = NotesSync.isReadBy(note, identity.id);
  NotesSync.markRead(noteId, identity.id, !isRead);
}
function notesWidgetFilterByTag(tag) {
  _notesWidgetState.tagFilter = (_notesWidgetState.tagFilter === tag) ? null : tag;
  _rerender();
}
function notesWidgetClearTagFilter() { _notesWidgetState.tagFilter = null; _rerender(); }
function notesWidgetToggleUnreadOnly() { _notesWidgetState.unreadOnly = !_notesWidgetState.unreadOnly; _rerender(); }
function _rerender() {
  if (!_notesWidgetState.containerId) return;
  const all = NotesSync.getAllNotes();
  _renderNotesWidget(all);
}

// Self-contained CSS injected once. Neutral palette that works on the
// parchment player site and the dark DM dashboard alike.
function _injectNotesCSS() {
  if (document.getElementById('wc-notes-styles')) return;
  const style = document.createElement('style');
  style.id = 'wc-notes-styles';
  style.textContent = [
    '.wc-notes-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;padding-bottom:.4rem;border-bottom:1px solid rgba(160,128,64,0.3)}',
    '.wc-notes-title{font-family:\'Cinzel Decorative\',\'Cinzel\',serif;font-size:18px;letter-spacing:2px;color:#c09030}',
    '.wc-notes-newbtn{background:#8a6a10;color:#fff;border:none;border-radius:3px;padding:.4rem .9rem;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1.5px;cursor:pointer}',
    '.wc-notes-newbtn:hover{background:#c09030}',
    '.wc-notes-scope-tabs{display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.5rem}',
    '.wc-notes-scope-tab{background:transparent;border:1px solid;border-radius:3px;padding:.25rem .6rem;font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:1px;cursor:pointer;transition:background .12s}',
    '.wc-notes-scope-tab.on{color:#fff!important}',
    '.wc-notes-author-filter{font-size:11px;color:rgba(120,100,60,0.85);margin-bottom:.5rem;font-family:\'Cinzel\',serif;letter-spacing:.5px}',
    '.wc-notes-author-filter select{background:rgba(255,255,255,0.08);border:1px solid rgba(160,128,64,0.4);color:inherit;padding:.15rem .3rem;border-radius:2px;font-family:inherit;font-size:11px;margin-left:.3rem}',
    '.wc-notes-list{display:flex;flex-direction:column;gap:.5rem}',
    '.wc-notes-empty{padding:1.5rem;text-align:center;font-style:italic;color:rgba(140,120,80,0.75);border:1px dashed rgba(160,128,64,0.3);border-radius:3px}',
    '.wc-note-card{background:rgba(255,255,255,0.04);border:1px solid rgba(160,128,64,0.25);border-left:4px solid #555;border-radius:3px;padding:.6rem .8rem}',
    '.wc-note-head{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;font-size:10.5px;font-family:\'Cinzel\',serif;letter-spacing:.5px;margin-bottom:.3rem}',
    '.wc-note-scope{color:#fff;padding:2px 8px;border-radius:10px;font-size:9.5px;letter-spacing:1px;font-weight:600}',
    '.wc-note-author{color:rgba(140,120,80,0.9);font-weight:600}',
    '.wc-note-time{color:rgba(140,120,80,0.7);font-style:italic;font-size:10px;letter-spacing:.5px;margin-left:auto}',
    '.wc-note-actions{margin-left:.4rem;display:inline-flex;gap:.25rem}',
    '.wc-note-edit,.wc-note-del{background:transparent;border:1px solid rgba(160,128,64,0.5);color:rgba(160,128,64,0.9);border-radius:2px;padding:1px 8px;cursor:pointer;font-size:9.5px;font-family:\'Cinzel\',serif;letter-spacing:.5px}',
    '.wc-note-del{border-color:rgba(160,32,32,0.6);color:rgba(160,32,32,0.9)}',
    '.wc-note-edit:hover{background:rgba(160,128,64,0.15)}',
    '.wc-note-del:hover{background:rgba(160,32,32,0.15)}',
    '.wc-note-title{font-family:\'Cinzel\',serif;font-size:13px;color:inherit;margin-bottom:.2rem;font-weight:700;letter-spacing:.5px}',
    '.wc-note-body{font-size:12.5px;line-height:1.5;color:inherit;white-space:pre-wrap;word-break:break-word}',
    '.wc-note-form{background:rgba(160,128,64,0.08);border:1px solid rgba(160,128,64,0.5);border-radius:3px;padding:.7rem .8rem;margin-bottom:.5rem;display:flex;flex-direction:column;gap:.4rem}',
    '.wc-note-form-label{font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1.5px;color:#8a6a10;text-transform:uppercase;margin-bottom:.2rem}',
    '.wc-note-form label{font-size:11px;color:rgba(140,120,80,0.85);font-family:\'Cinzel\',serif;letter-spacing:.5px}',
    '.wc-note-form select,.wc-note-form input,.wc-note-form textarea{background:rgba(255,255,255,0.06);border:1px solid rgba(160,128,64,0.4);color:inherit;padding:.35rem .5rem;border-radius:2px;font-family:inherit;font-size:12.5px;outline:none;width:100%;box-sizing:border-box}',
    '.wc-note-form textarea{resize:vertical;min-height:100px;font-family:inherit;line-height:1.5}',
    '.wc-note-form select:focus,.wc-note-form input:focus,.wc-note-form textarea:focus{border-color:#c09030;box-shadow:0 0 0 2px rgba(192,144,48,0.15)}',
    '.wc-note-form-actions{display:flex;gap:.4rem;justify-content:flex-end}',
    '.wc-note-form-save{background:#8a6a10;color:#fff;border:none;padding:.4rem 1rem;border-radius:2px;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1.5px;cursor:pointer}',
    '.wc-note-form-save:hover{background:#c09030}',
    '.wc-note-form-cancel{background:transparent;border:1px solid rgba(160,128,64,0.4);color:inherit;padding:.4rem 1rem;border-radius:2px;font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1.5px;cursor:pointer}'
  ].join('\n');
  document.head.appendChild(style);
}

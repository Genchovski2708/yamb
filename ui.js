// Yamb UI — renders the scoresheet + dice from a local GameState, handles clicks.
// Fully client-side port of web/static/app.js (no server needed).
import {
    GameState, calculate_score, can_write_to, can_call_cell, can_roll, is_dead_end,
} from './game.js';

const $ = sel => document.querySelector(sel);
const sheetEl = $('#sheet');
const diceEl = $('#dice-row');
const messageEl = $('#message');

const ROW_LABELS = ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes',
                    'Max', 'Min',
                    'Triling', 'Skala', 'Ful', 'Kare', 'Jamb'];
const COL_LABELS = ['Down', 'Free', 'Up', 'Call', 'Manual'];

// ---------- Persistence ----------

const STORAGE_KEY = 'yamb_game_v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return GameState.fromJSON(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not restore saved game:', e);
  }
  return new GameState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save game:', e);
  }
}

let state = loadState();

let messageTimer = null;
function showMessage(text, kind = 'ok') {
  messageEl.textContent = text;
  messageEl.className = `message ${kind}`;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => messageEl.classList.add('hidden'), 3000);
  messageEl.classList.remove('hidden');
}

// ---------- Rendering ----------

function render() {
  $('#score').textContent = state.total_score;
  $('#throws').textContent = state.throws_left;
  renderDice();
  renderSheet();
  $('#btn-roll').disabled = !can_roll(state);
  $('#btn-undo').disabled = state.past_states.length === 0;
  if (state.game_over) showMessage(`Game over — final score: ${state.total_score}`, 'ok');
}

function renderDice() {
  diceEl.innerHTML = '';
  const canToggle = state.throws_left > 0 && !state.game_over;
  state.current_dice.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'die' + (state.selected_dice[i] ? ' kept' : '') + (canToggle ? '' : ' disabled');
    el.textContent = d;
    el.onclick = () => { if (canToggle) toggleKeep(i); };
    diceEl.appendChild(el);
  });
}

function tableFor(name) {
  return name === 'top' ? state.top_table
       : name === 'middle' ? state.middle_table
       : state.bottom_table;
}

function starsFor(name) {
  return name === 'top' ? state.top_table_stars
       : name === 'middle' ? state.middle_table_stars
       : null;
}

function renderSheet() {
  const s = state;
  const html = [];
  html.push('<table>');
  html.push('<thead><tr><th class="row-label">Row</th>');
  COL_LABELS.forEach(c => html.push(`<th>${c}</th>`));
  html.push('</tr></thead>');
  html.push('<tbody>');

  const sectionBreaks = new Set([6, 8]);
  for (let rowIdx = 0; rowIdx < 13; rowIdx++) {
    const table = rowIdx < 6 ? 'top' : (rowIdx < 8 ? 'middle' : 'bottom');
    const row = rowIdx - (table === 'top' ? 0 : (table === 'middle' ? 6 : 8));

    if (rowIdx === 6) renderSumsRow(html, 'Top sum', topSums(), 'top');
    if (rowIdx === 8) renderMiddleSumsRow(html, middleSums());
    if (sectionBreaks.has(rowIdx)) {
      html.push('<tr class="section-divider"><td colspan="6"></td></tr>');
    }

    html.push('<tr>');
    html.push(`<th class="row-label">${ROW_LABELS[rowIdx]}</th>`);
    for (let col = 0; col < 5; col++) {
      const value = tableFor(table)[row][col];
      const stars = starsFor(table);
      const star = stars ? stars[row][col] : false;
      const isCalled = (s.called_cell !== null
                        && s.called_cell.table === table
                        && s.called_cell.row === row
                        && s.called_cell.col === col);
      const legalWrite = can_write_to(s, table, row, col, s.current_dice).canWrite;
      const canCall = can_call_cell(s, table, row, col, s.current_dice);
      // Preview for legal writes AND callable cells: for callable cells this is
      // "what you'd score if you called and stopped right now".
      const preview = (legalWrite || canCall) ? calculate_score(s.current_dice, table, row) : null;

      let classes = ['cell'];
      let content = '';
      if (value !== null && value !== undefined) {
        classes.push('filled');
        if (star) classes.push('star');
        content = value;
      } else if (legalWrite) {
        classes.push('empty', 'legal');
        content = `<span style="opacity:0.85">${preview}</span>`;
      } else if (canCall) {
        classes.push('empty');
        content = `<span class="call-preview">${preview ?? '·'}</span>`;
      } else {
        classes.push('empty');
        content = '·';
      }
      if (isCalled) classes.push('called');
      if (canCall) classes.push('can-call');
      const dataAttr = `data-table="${table}" data-row="${row}" data-col="${col}"`;
      html.push(`<td class="${classes.join(' ')}" ${dataAttr}>${content}</td>`);
    }
    html.push('</tr>');
  }
  renderSumsRow(html, 'Bot sum', bottomSums(), 'bottom');
  html.push('</tbody></table>');
  sheetEl.innerHTML = html.join('');

  sheetEl.querySelectorAll('td.cell').forEach(td => {
    td.addEventListener('click', () => {
      const { table, row, col } = td.dataset;
      if (td.classList.contains('legal')) {
        writeCell(table, +row, +col);
      } else if (td.classList.contains('can-call')) {
        callCell(table, +row);
      } else if (td.classList.contains('empty') && !state.game_over) {
        // Tapping an unavailable cell: explain why it can't be written.
        const { reason } = can_write_to(state, table, +row, +col, state.current_dice);
        if (reason) showMessage(reason, 'error');
      }
    });
  });
}

function topSums() {
  return [0, 1, 2, 3, 4].map(c =>
    state.top_table.reduce((acc, r) => acc + (r[c] || 0), 0));
}

function bottomSums() {
  return [0, 1, 2, 3, 4].map(c =>
    state.bottom_table.reduce((acc, r) => acc + (r[c] || 0), 0));
}

// For middle, show (max-min)*ones when all three are filled, else just max+min so far.
function middleSums() {
  return [0, 1, 2, 3, 4].map(c => {
    const mx = state.middle_table[0][c], mn = state.middle_table[1][c];
    const ones = state.top_table[0][c];
    if (mx !== null && mn !== null && ones !== null && ones > 0) {
      return { realized: (mx - mn) * ones, partial: null };
    }
    return { realized: null, partial: (mx || 0) + (mn || 0) };
  });
}

// Sum-row footer for the top/bottom sections. kind='top' highlights the 60 bonus.
function renderSumsRow(html, label, sums, kind) {
  html.push('<tr class="sum-row">');
  html.push(`<th class="row-label sum-label">${label}</th>`);
  sums.forEach(s => {
    let cls = 'cell sum';
    if (kind === 'top' && s >= 60) cls += ' bonus-met';
    else if (kind === 'top' && s > 0) cls += ' bonus-pending';
    html.push(`<td class="${cls}">${s}</td>`);
  });
  html.push('</tr>');
}

// Middle section sum: shows realized (max-min)*ones if all set, else partial sum.
function renderMiddleSumsRow(html, sums) {
  html.push('<tr class="sum-row">');
  html.push('<th class="row-label sum-label">Mid sum</th>');
  sums.forEach(s => {
    let cls = 'cell sum';
    let text;
    if (s.realized !== null) {
      cls += ' mid-realized';
      text = s.realized;
    } else {
      text = s.partial > 0 ? `(${s.partial})` : '·';
    }
    html.push(`<td class="${cls}">${text}</td>`);
  });
  html.push('</tr>');
}

// ---------- Actions ----------

function afterAction() {
  // Stranded with no legal move (only Call/Manual cells left, no throws):
  // the game ends and the remaining cells score 0, same as the RL env.
  const deadEnd = is_dead_end(state);
  if (deadEnd) {
    state.game_over = true;
    state.throws_left = 0;
  }
  saveState();
  render();
  if (deadEnd) {
    showMessage(`No legal moves left — game over with ${state.total_score} points. Unfilled cells score 0. (Undo to rescue!)`, 'warn');
  }
}

function toggleKeep(idx) {
  state.toggle_dice_selection_action(idx);
  afterAction();
}

function rollDice() {
  if (!can_roll(state)) return;
  state.roll_dice_action();
  afterAction();
}

function writeCell(table, row, col) {
  state.write_to_cell_action(table, row, col);
  afterAction();
}

function callCell(table, row) {
  state.call_cell_action(table, row, 3);
  afterAction();
}

function undo() {
  state.undo_action();
  afterAction();
}

function newGame() {
  if (!state.game_over && state.current_turn > 1) {
    if (!confirm('Start a new game? The current game will be lost.')) return;
  }
  state = new GameState();
  afterAction();
}

// ---------- Init ----------

$('#btn-roll').onclick = rollDice;
$('#btn-undo').onclick = undo;
$('#btn-new').onclick = newGame;

render();

// Offline support: the service worker caches all assets after first load.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

/**
 * Engine unit tests. Run with: node test.js
 * Exits non-zero on failure.
 */
import {
    GameState, calculate_score, can_write_to, can_call_cell, can_roll, is_dead_end,
    cell_to_idx, idx_to_cell, table_row_to_call_row, call_row_to_table_row,
    check_for_five_of_a_kind,
} from './game.js';

let failures = 0;
let passed = 0;

function eq(actual, expected, name) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) {
        passed++;
    } else {
        failures++;
        console.error(`FAIL ${name}: expected ${e}, got ${a}`);
    }
}

// ---------- calculate_score: top ----------
eq(calculate_score([1, 1, 1, 2, 2], 'top', 0), 3, 'top ones counts threes');
eq(calculate_score([6, 6, 6, 6, 6, 6], 'top', 5), 30, 'top sixes capped at 5 dice');
eq(calculate_score([2, 3, 4, 5, 6], 'top', 0), 0, 'top ones none present');

// ---------- calculate_score: middle ----------
eq(calculate_score([1, 2, 3, 4, 5, 6], 'middle', 0), 20, 'max takes best 5 of 6');
eq(calculate_score([1, 2, 3, 4, 5, 6], 'middle', 1), 15, 'min takes worst 5 of 6');
eq(calculate_score([2, 2, 3], 'middle', 0), 7, 'middle with <5 dice sums all');

// ---------- calculate_score: bottom ----------
eq(calculate_score([4, 4, 4, 1, 2], 'bottom', 0), 32, 'triling 3x4+20');
eq(calculate_score([5, 5, 6, 6, 6, 6], 'bottom', 0), 38, 'triling picks highest triple');
eq(calculate_score([1, 2, 3, 4, 5, 1], 'bottom', 1), 45, 'small straight 45');
eq(calculate_score([2, 3, 4, 5, 6, 6], 'bottom', 1), 50, 'large straight 50');
eq(calculate_score([1, 2, 3, 4, 6], 'bottom', 1), 0, 'no straight');
eq(calculate_score([3, 3, 3, 2, 2], 'bottom', 2), 53, 'ful 3x3+2x2+40');
eq(calculate_score([2, 2, 2, 3, 3, 3], 'bottom', 2), 53, 'ful two triples picks higher as triple');
eq(calculate_score([5, 5, 5, 5, 5], 'bottom', 2), 65, 'ful from five of a kind 5x3+5x2+40');
eq(calculate_score([4, 4, 4, 1, 2], 'bottom', 2), 0, 'no ful without pair');
eq(calculate_score([6, 6, 6, 6, 1], 'bottom', 3), 74, 'kare 4x6+50');
eq(calculate_score([6, 6, 6, 6, 6], 'bottom', 4), 90, 'jamb 5x6+60');
eq(calculate_score([1, 1, 1, 1, 1], 'bottom', 4), 100, 'jamb of ones special 100');
eq(calculate_score([], 'bottom', 4), 0, 'empty dice scores 0');

// ---------- five of a kind ----------
eq(check_for_five_of_a_kind([3, 3, 3, 3, 3, 1]), true, 'five of a kind detected');
eq(check_for_five_of_a_kind([3, 3, 3, 3, 2, 1]), false, 'four is not five');

// ---------- index helpers round-trip ----------
for (let i = 0; i < 65; i++) {
    const [t, r, c] = idx_to_cell(i);
    eq(cell_to_idx(t, r, c), i, `cell idx round-trip ${i}`);
}
for (let cr = 0; cr < 13; cr++) {
    const [t, r] = call_row_to_table_row(cr);
    eq(table_row_to_call_row(t, r), cr, `call row round-trip ${cr}`);
}

// ---------- column write rules ----------
function freshState(dice = [1, 2, 3, 4, 5, 6]) {
    const s = new GameState();
    s.current_dice = dice;
    s.throws_left = 2;
    return s;
}

{
    const s = freshState();
    eq(can_write_to(s, 'top', 0, 1, s.current_dice).canWrite, true, 'free column always writable');
    eq(can_write_to(s, 'top', 0, 0, s.current_dice).canWrite, true, 'down column starts at Ones');
    eq(can_write_to(s, 'top', 1, 0, s.current_dice).canWrite, false, 'down column blocks Twos before Ones');
    eq(can_write_to(s, 'bottom', 4, 2, s.current_dice).canWrite, true, 'up column starts at Jamb');
    eq(can_write_to(s, 'bottom', 3, 2, s.current_dice).canWrite, false, 'up column blocks Kare before Jamb');
    eq(can_write_to(s, 'top', 0, 3, s.current_dice).canWrite, false, 'call column needs a call first');
    eq(can_write_to(s, 'top', 0, 4, s.current_dice).canWrite, false, 'manual column needs all-six roll');
    s.has_rolled_all_six_this_turn = true;
    eq(can_write_to(s, 'top', 0, 4, s.current_dice).canWrite, true, 'manual column ok after all-six roll');
}

{
    // Down column reaching the middle table: Max must be writable once top is full,
    // Min requires Max first (regression test for the row_idx===0 bug).
    const s = freshState();
    for (let r = 0; r < 6; r++) s.top_table[r][0] = 1;
    eq(can_write_to(s, 'middle', 0, 0, s.current_dice).canWrite, true, 'down column: Max writable after top done');
    eq(can_write_to(s, 'middle', 1, 0, s.current_dice).canWrite, false, 'down column: Min blocked before Max');
    s.middle_table[0][0] = 20;
    eq(can_write_to(s, 'middle', 1, 0, s.current_dice).canWrite, true, 'down column: Min writable after Max');
}

{
    // Up column reaching the middle table: Min before Max.
    const s = freshState();
    for (let r = 0; r < 5; r++) s.bottom_table[r][2] = 10;
    eq(can_write_to(s, 'middle', 1, 2, s.current_dice).canWrite, true, 'up column: Min writable after bottom done');
    eq(can_write_to(s, 'middle', 0, 2, s.current_dice).canWrite, false, 'up column: Max blocked before Min');
    s.middle_table[1][2] = 6;
    eq(can_write_to(s, 'middle', 0, 2, s.current_dice).canWrite, true, 'up column: Max writable after Min');
}

// ---------- call rules ----------
{
    const s = freshState();
    s.has_rolled_all_six_this_turn = true;
    eq(can_call_cell(s, 'bottom', 4, 3, s.current_dice), true, 'can call jamb after all-six roll');
    eq(can_call_cell(s, 'bottom', 4, 2, s.current_dice), false, 'call only in column 3');
    s.call_cell_action('bottom', 4, 3);
    eq(can_call_cell(s, 'top', 0, 3, s.current_dice), false, 'no second call');
    eq(can_write_to(s, 'bottom', 4, 3, s.current_dice).canWrite, true, 'called cell is writable');
    eq(can_write_to(s, 'top', 0, 1, s.current_dice).canWrite, false, 'called cell forces the write target');
}

// ---------- can_roll ----------
{
    const s = new GameState();
    eq(can_roll(s), true, 'first roll allowed');
    s.current_dice = [1, 1, 1, 1, 1, 1];
    s.selected_dice = [true, true, true, true, true, true];
    eq(can_roll(s), false, 'rolling with all six kept is illegal');
    s.selected_dice[0] = false;
    eq(can_roll(s), true, 'rolling with one die free is legal');
    s.throws_left = 0;
    eq(can_roll(s), false, 'no throws left');
}

// ---------- scoring totals ----------
{
    const s = new GameState();
    // Top column 0 sums to exactly 60 → +30 bonus.
    const topVals = [4, 8, 12, 12, 12, 12]; // 60
    for (let r = 0; r < 6; r++) s.top_table[r][0] = topVals[r];
    s._recalculate_total_score();
    eq(s.total_score, 90, 'top bonus +30 at 60');

    // 75 → +30 and +10 for the full 10 over 60.
    s.top_table[5][0] = 27; // sum 75
    s._recalculate_total_score();
    eq(s.total_score, 115, 'top bonus +10 per full 10 over 60');
}

{
    const s = new GameState();
    s.top_table[0][1] = 4;       // ones = 4
    s.middle_table[0][1] = 28;   // max
    s.middle_table[1][1] = 8;    // min
    s._recalculate_total_score();
    eq(s.total_score, 4 + (28 - 8) * 4, 'middle (max-min)*ones');
}

{
    const s = new GameState();
    for (let i = 0; i < 5; i++) s.top_table_stars[0][i] = true;
    s._recalculate_total_score();
    eq(s.total_score, 200, 'five stars give +200');
    eq(s.star_bonus_applied, true, 'star bonus flag set');
}

// ---------- write action side effects ----------
{
    const s = new GameState();
    s.current_dice = [5, 5, 5, 5, 5];
    s.throws_left = 1;
    s.write_to_cell_action('top', 4, 1);
    eq(s.top_table[4][1], 25, 'write stores score');
    eq(s.top_table_stars[4][1], true, 'five matching dice in top earns star');
    eq(s.current_dice, [], 'dice cleared after write');
    eq(s.throws_left, 3, 'throws reset to 3');
    eq(s.called_cell, null, 'call cleared after write');
}

{
    // Last empty cell → 5 throws; filling it → game over.
    const s = new GameState();
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) s.top_table[r][c] = 1;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) s.middle_table[r][c] = 5;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) s.bottom_table[r][c] = 10;
    s.bottom_table[4][4] = null;
    s.bottom_table[3][4] = null;
    s.current_dice = [1, 2, 3, 4, 5, 6];
    s.write_to_cell_action('bottom', 3, 4);
    eq(s.throws_left, 5, 'last turn gets 5 throws');
    eq(s.game_over, false, 'not over with one cell left');
    s.current_dice = [6, 6, 6, 6, 6];
    s.write_to_cell_action('bottom', 4, 4);
    eq(s.game_over, true, 'game over when sheet full');
    eq(s.throws_left, 0, 'no throws after game over');
}

// ---------- undo / redo ----------
{
    const s = new GameState();
    s.current_dice = [3, 3, 3, 3, 3];
    s.write_to_cell_action('top', 2, 1);
    const afterWrite = s.total_score;
    s.undo_action();
    eq(s.top_table[2][1], null, 'undo restores empty cell');
    eq(s.current_dice, [3, 3, 3, 3, 3], 'undo restores dice');
    s.redo_action();
    eq(s.top_table[2][1], 15, 'redo reapplies write');
    eq(s.total_score, afterWrite, 'redo restores score');
}

// ---------- dead end detection ----------
{
    // Everything filled except one Call-column cell; no throws left and the
    // last roll wasn't all-six → no legal move anywhere.
    const s = new GameState();
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) s.top_table[r][c] = 1;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) s.middle_table[r][c] = 5;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) s.bottom_table[r][c] = 10;
    s.top_table[0][3] = null;
    s.current_dice = [1, 2, 3, 4, 5, 6];
    s.throws_left = 0;
    s.has_rolled_all_six_this_turn = false;
    eq(is_dead_end(s), true, 'dead end: only call cell left, no call made');
    s.throws_left = 1;
    eq(is_dead_end(s), false, 'not dead end while throws remain');
    s.throws_left = 0;
    s.has_rolled_all_six_this_turn = true;
    eq(is_dead_end(s), false, 'not dead end if call still possible');
    s.called_cell = { table: 'top', row: 0, col: 3 };
    eq(is_dead_end(s), false, 'not dead end if called cell writable');
}

// ---------- save / load round-trip ----------
{
    const s = new GameState();
    s.current_dice = [1, 2, 3, 4, 5, 6];
    s.throws_left = 1;
    s.has_rolled_all_six_this_turn = true;
    s.call_cell_action('bottom', 4, 3);
    const restored = GameState.fromJSON(JSON.parse(JSON.stringify(s)));
    eq(restored.current_dice, s.current_dice, 'load restores dice');
    eq(restored.called_cell, s.called_cell, 'load restores called cell');
    eq(restored.throws_left, 1, 'load restores throws');
    // Restored state must behave: write to the called cell.
    restored.write_to_cell_action('bottom', 4, 3);
    eq(restored.bottom_table[4][3] !== null, true, 'restored state accepts actions');
}

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

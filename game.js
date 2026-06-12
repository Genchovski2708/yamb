/**
 * Yamb Game Engine (JS Version)
 * Ported from Python implementation.
 */

// ---- Layout constants ----
const NUM_TOP_ROWS = 6;
const NUM_MIDDLE_ROWS = 2;
const NUM_BOTTOM_ROWS = 5;
const NUM_COLS = 5;
const TOTAL_ROWS = NUM_TOP_ROWS + NUM_MIDDLE_ROWS + NUM_BOTTOM_ROWS; // 13
const TOTAL_CELLS = TOTAL_ROWS * NUM_COLS; // 65

// ---- Action layout ----
const N_KEEP_ACTIONS = 64;
const N_WRITE_ACTIONS = TOTAL_CELLS;
const N_CALL_ACTIONS = TOTAL_ROWS;
const ACTION_SIZE = N_KEEP_ACTIONS + N_WRITE_ACTIONS + N_CALL_ACTIONS; // 142

const WRITE_OFFSET = N_KEEP_ACTIONS;
const CALL_OFFSET = N_KEEP_ACTIONS + N_WRITE_ACTIONS;

// ---- Helpers ----

/**
 * Convert table name, row, and column into a flat cell index.
 */
export function cell_to_idx(table, row, col) {
    let ro;
    if (table === 'top') {
        ro = row;
    } else if (table === 'middle') {
        ro = NUM_TOP_ROWS + row;
    } else { // bottom
        ro = NUM_TOP_ROWS + NUM_MIDDLE_ROWS + row;
    }
    return ro * NUM_COLS + col;
}

/**
 * Convert a flat cell index into table, row, and column.
 */
export function idx_to_cell(idx) {
    const ro = Math.floor(idx / NUM_COLS);
    const col = idx % NUM_COLS;
    if (ro < NUM_TOP_ROWS) {
        return ['top', ro, col];
    } else if (ro < NUM_TOP_ROWS + NUM_MIDDLE_ROWS) {
        return ['middle', ro - NUM_TOP_ROWS, col];
    } else {
        return ['bottom', ro - NUM_TOP_ROWS - NUM_MIDDLE_ROWS, col];
    }
}

/**
 * Convert call row index to table and row.
 */
export function call_row_to_table_row(crow) {
    if (crow < NUM_TOP_ROWS) {
        return ['top', crow];
    } else if (crow < NUM_TOP_ROWS + NUM_MIDDLE_ROWS) {
        return ['middle', crow - NUM_TOP_ROWS];
    } else {
        return ['bottom', crow - NUM_TOP_ROWS - NUM_MIDDLE_ROWS];
    }
}

/**
 * Convert table and row to call row index.
 */
export function table_row_to_call_row(table, row) {
    if (table === 'top') {
        return row;
    } else if (table === 'middle') {
        return NUM_TOP_ROWS + row;
    } else {
        return NUM_TOP_ROWS + NUM_MIDDLE_ROWS + row;
    }
}

/**
 * Get dice counts.
 */
export function get_dice_counts(dice) {
    const counts = {};
    for (let i = 1; i <= 6; i++) counts[i] = 0;
    if (dice.length === 0) return counts;
    for (const d of dice) {
        counts[d]++;
    }
    return counts;
}

/**
 * Check for five of a kind.
 */
export function check_for_five_of_a_kind(dice) {
    if (dice.length === 0) return false;
    const counts = get_dice_counts(dice);
    return Object.values(counts).some(count => count >= 5);
}

/**
 * Calculate score for a given dice set and target cell.
 */
export function calculate_score(dice, table_name, row_index) {
    if (dice.length === 0) return 0;
    const counts = get_dice_counts(dice);
    const sorted_dice = [...dice].sort((a, b) => a - b);

    if (table_name === 'top') {
        const target_number = row_index + 1;
        const count_of_target = counts[target_number] || 0;
        const effective_count = Math.min(count_of_target, 5);
        return effective_count * target_number;
    }

    if (table_name === 'middle') {
        let dice_to_consider_for_sum;
        if (dice.length < 5) {
            dice_to_consider_for_sum = sorted_dice;
        } else {
            if (row_index === 0) {
                dice_to_consider_for_sum = [...sorted_dice].sort((a, b) => b - a).slice(0, 5);
            } else {
                dice_to_consider_for_sum = sorted_dice.slice(0, 5);
            }
        }
        return dice_to_consider_for_sum.reduce((a, b) => a + b, 0);
    }

    if (table_name === 'bottom') {
        const unique_sorted_dice_values = [...new Set(dice)].sort((a, b) => a - b);
        if (row_index === 0) {
            let trilling_value = 0;
            for (let i = 6; i >= 1; i--) {
                if (counts[i] >= 3) { trilling_value = i; break; }
            }
            if (trilling_value > 0) return (trilling_value * 3) + 20;
            return 0;
        } else if (row_index === 1) {
            const unique_set = new Set(unique_sorted_dice_values);
            const is_small_straight = [1, 2, 3, 4, 5].every(v => unique_set.has(v));
            const is_large_straight = [2, 3, 4, 5, 6].every(v => unique_set.has(v));
            if (is_large_straight) return 50;
            if (is_small_straight) return 45;
            return 0;
        } else if (row_index === 2) {
            let three_of_a_kind_val_fh = 0;
            let two_of_a_kind_val_fh = 0;
            // Descending by (count, val), matching Python's sorted(..., reverse=True)
            const sorted_counts_items = Object.entries(counts)
                .map(([val, count]) => ({val: parseInt(val), count}))
                .sort((a, b) => (b.count - a.count) || (b.val - a.val));

            for (const {val, count} of sorted_counts_items) {
                if (count >= 3) { three_of_a_kind_val_fh = val; break; }
            }
            if (three_of_a_kind_val_fh > 0) {
                for (const {val, count} of sorted_counts_items) {
                    if (val == three_of_a_kind_val_fh && count >= 5) { two_of_a_kind_val_fh = val; break; }
                    if (val != three_of_a_kind_val_fh && count >= 2) { two_of_a_kind_val_fh = val; break; }
                }
                if (!two_of_a_kind_val_fh) {
                    const other_threes = sorted_counts_items
                        .filter(item => item.val != three_of_a_kind_val_fh && item.count >= 3)
                        .map(item => item.val);
                    if (other_threes.length > 0) two_of_a_kind_val_fh = other_threes[0];
                }
                if (three_of_a_kind_val_fh > 0 && two_of_a_kind_val_fh > 0) {
                    return (three_of_a_kind_val_fh * 3) + (two_of_a_kind_val_fh * 2) + 40;
                }
            }
            return 0;
        } else if (row_index === 3) {
            let kare_value = 0;
            for (let i = 6; i >= 1; i--) {
                if (counts[i] >= 4) { kare_value = i; break; }
            }
            if (kare_value > 0) return (kare_value * 4) + 50;
            return 0;
        } else if (row_index === 4) {
            let jamp_value = 0;
            for (let i = 6; i >= 1; i--) {
                if (counts[i] >= 5) { jamp_value = i; break; }
            }
            if (jamp_value > 0) {
                if (jamp_value === 1) return 100;
                return (jamp_value * 5) + 60;
            }
            return 0;
        }
        return 0;
    }
    return 0;
}

/**
 * Helper to get cell value from state.
 */
export function get_cell_value(state, table_name, row_idx, col_idx) {
    if (table_name === 'top') {
        return state.top_table[row_idx][col_idx];
    } else if (table_name === 'middle') {
        return state.middle_table[row_idx][col_idx];
    } else if (table_name === 'bottom') {
        return state.bottom_table[row_idx][col_idx];
    }
    return null;
}

/**
 * Check if can write to a cell.
 */
export function can_write_to(state, table_name, row_idx, col_idx, dice) {
    const cell_value = get_cell_value(state, table_name, row_idx, col_idx);
    if (cell_value !== null) return { canWrite: false, reason: 'Poleto e vekje popolneto' };
    if (dice.length === 0) return { canWrite: false, reason: 'Nema frleni kocki' };

    if (state.called_cell) {
        const called_match = (state.called_cell.table === table_name &&
                               state.called_cell.row === row_idx &&
                               state.called_cell.col === col_idx);
        if (!called_match) return { canWrite: false, reason: 'Mora da se zapise vo najavenoto pole' };
        if (col_idx === 3 && called_match) return { canWrite: true, reason: null };
    }

    if (col_idx === 0) {
        const [canWrite, reason] = _can_write_down_column(state, table_name, row_idx, col_idx);
        return { canWrite, reason };
    }
    if (col_idx === 1) return { canWrite: true, reason: null };
    if (col_idx === 2) {
        const [canWrite, reason] = _can_write_up_column(state, table_name, row_idx, col_idx);
        return { canWrite, reason };
    }
    if (col_idx === 3) return { canWrite: false, reason: 'Mora prvo da se najavi poleto' };
    if (col_idx === 4) {
        if (!state.has_rolled_all_six_this_turn) {
            return { canWrite: false, reason: 'Poslednoto frlanje mora da bide so site 6 neizbrani kocki' };
        }
        return { canWrite: true, reason: null };
    }

    return { canWrite: false, reason: 'Nepoznato pravilo za kolona' };
}

/**
 * Check if can call a cell.
 */
export function can_call_cell(state, table_name, row_idx, col_idx, dice) {
    if (col_idx !== 3) return false;
    if (dice.length === 0) return false;
    if (state.called_cell) return false;
    if (get_cell_value(state, table_name, row_idx, col_idx) !== null) return false;
    if (!state.has_rolled_all_six_this_turn) return false;
    return true;
}

function _get_bottom_row_name_js(row_idx) {
    const names = ['Triling', 'Skala', 'Ful', 'Kare', 'Jamb'];
    return names[row_idx] || "Nepoznat Red";
}

function _can_write_down_column(state, table_name, row_idx, col_idx) {
    if (table_name === 'top') {
        for (let i = 0; i < row_idx; i++) {
            if (get_cell_value(state, table_name, i, col_idx) === null) return [false, `Popolni go red ${i + 1} prvo`];
        }
        return [true, null];
    }
    if (table_name === 'middle') {
        for (let i = 0; i < NUM_TOP_ROWS; i++) {
            if (get_cell_value(state, 'top', i, col_idx) === null) return [false, "Kompletiraj Gorna tabela prvo"];
        }
        if (row_idx === 1 && get_cell_value(state, table_name, 0, col_idx) === null) return [false, "Popolni Maksimum prvo"];
        return [true, null];
    }
    if (table_name === 'bottom') {
        for (let i = 0; i < NUM_MIDDLE_ROWS; i++) {
            if (get_cell_value(state, 'middle', i, col_idx) === null) return [false, "Kompletiraj Sredna tabela prvo"];
        }
        for (let i = 0; i < row_idx; i++) {
            if (get_cell_value(state, table_name, i, col_idx) === null) return [false, `Popolni ${_get_bottom_row_name_js(i)} prvo`];
        }
        return [true, null];
    }
    return [false, "Nepoznata tabela za 'nadole' kolona"];
}

function _can_write_up_column(state, table_name, row_idx, col_idx) {
    if (table_name === 'bottom') {
        for (let i = 4; i > row_idx; i--) {
            if (get_cell_value(state, table_name, i, col_idx) === null) return [false, `Popolni ${_get_bottom_row_name_js(i)} prvo`];
        }
        return [true, null];
    }
    if (table_name === 'middle') {
        for (let i = 0; i < NUM_BOTTOM_ROWS; i++) {
            if (get_cell_value(state, 'bottom', i, col_idx) === null) return [false, "Kompletiraj Dolna tabela prvo"];
        }
        if (row_idx === 0 && get_cell_value(state, table_name, 1, col_idx) === null) return [false, "Popolni Minimum prvo"];
        return [true, null];
    }
    if (table_name === 'top') {
        for (let i = 0; i < NUM_MIDDLE_ROWS; i++) {
            if (get_cell_value(state, 'middle', i, col_idx) === null) return [false, "Kompletiraj Sredna tabela prvo"];
        }
        for (let i = 5; i > row_idx; i--) {
            if (get_cell_value(state, table_name, i, col_idx) === null) return [false, `Popolni go redot za ${i + 1}-ki prvo`];
        }
        return [true, null];
    }
    return [false, "Nepoznata tabela za 'nagore' kolona"];
}

/**
 * Roll dice helper.
 * @param {number[]} currentDice 
 * @param {boolean[]} selectedDice 
 * @returns {number[]}
 */
export function roll_dice_helper(currentDice, selectedDice) {
    if (currentDice.length === 0) {
        return Array.from({length: 6}, () => Math.floor(Math.random() * 6) + 1);
    }
    const newDice = [...currentDice];
    for (let i = 0; i < newDice.length; i++) {
        if (!selectedDice[i]) {
            newDice[i] = Math.floor(Math.random() * 6) + 1;
        }
    }
    return newDice;
}

/**
 * Check if rolling all six dice.
 */
export function is_rolling_all_six_dice(currentDice, selectedDice) {
    if (currentDice.length === 0) return true;
    return selectedDice.every(s => !s);
}

/**
 * Whether rolling is currently allowed. Re-rolling with all six dice kept
 * would change nothing, so it is treated as illegal (mirrors the RL env's
 * keep-mask restriction).
 */
export function can_roll(state) {
    if (state.game_over || state.throws_left <= 0) return false;
    if (state.current_dice.length > 0 && state.selected_dice.every(s => s)) return false;
    return true;
}

/**
 * True if the player has stranded themselves: no legal write, no legal call,
 * and no throws left. Happens when only Call/Manual-column cells remain but
 * `has_rolled_all_six_this_turn` is false and can never be re-enabled.
 * Matches the RL env's dead-end guard: the game ends, remaining cells score 0.
 */
export function is_dead_end(state) {
    if (state.game_over) return false;
    // throws_left > 0 means the player can still roll (un-keeping dice if needed).
    if (state.throws_left > 0) return false;
    if (state.current_dice.length === 0) return false; // turn not started yet
    for (const [table, nRows] of [['top', NUM_TOP_ROWS], ['middle', NUM_MIDDLE_ROWS], ['bottom', NUM_BOTTOM_ROWS]]) {
        for (let r = 0; r < nRows; r++) {
            for (let c = 0; c < NUM_COLS; c++) {
                if (can_write_to(state, table, r, c, state.current_dice).canWrite) return false;
            }
            if (can_call_cell(state, table, r, 3, state.current_dice)) return false;
        }
    }
    return true;
}

/**
 * Game State Class
 */
export class GameState {
    constructor() {
        this.top_table = Array.from({length: NUM_TOP_ROWS}, () => Array(NUM_COLS).fill(null));
        this.middle_table = Array.from({length: NUM_MIDDLE_ROWS}, () => Array(NUM_COLS).fill(null));
        this.bottom_table = Array.from({length: NUM_BOTTOM_ROWS}, () => Array(NUM_COLS).fill(null));
        this.top_table_stars = Array.from({length: NUM_TOP_ROWS}, () => Array(NUM_COLS).fill(false));
        this.middle_table_stars = Array.from({length: NUM_MIDDLE_ROWS}, () => Array(NUM_COLS).fill(false));
        this.current_dice = [];
        this.selected_dice = Array(6).fill(false);
        this.throws_left = 3;
        this.current_turn = 1;
        this.has_rolled_all_six_this_turn = false;
        this.called_cell = null;
        this.game_over = false;
        this.total_score = 0;
        this.star_bonus_applied = false;
        this.past_states = [];
        this.future_states = [];
        this.MAX_HISTORY_SIZE = 20;
    }

    _get_current_state_for_history() {
        const excluded_attrs = new Set(['past_states', 'future_states', 'MAX_HISTORY_SIZE']);
        const savable_state = {};
        for (const key in this) {
            if (!excluded_attrs.has(key) && !key.startsWith('_')) {
                savable_state[key] = JSON.parse(JSON.stringify(this[key]));
            }
        }
        return savable_state;
    }

    _load_from_snapshot(snapshot) {
        for (const key in snapshot) {
            if (Object.prototype.hasOwnProperty.call(this, key)) {
                this[key] = snapshot[key];
            }
        }
    }

    _push_to_past_states() {
        this.past_states.push(this._get_current_state_for_history());
        if (this.past_states.length > this.MAX_HISTORY_SIZE) {
            this.past_states.shift();
        }
        this.future_states = [];
    }

    reset_game_action() {
        const new_initial_state = new GameState();
        for (const key in new_initial_state) {
            if (!key.startsWith('_')) {
                this[key] = new_initial_state[key];
            }
        }
    }

    roll_dice_action() {
        if (this.throws_left > 0 && !this.game_over) {
            const is_pure_all_six_roll = is_rolling_all_six_dice(this.current_dice, this.selected_dice);
            this.current_dice = roll_dice_helper(this.current_dice, this.selected_dice);
            this.throws_left -= 1;
            this.has_rolled_all_six_this_turn = is_pure_all_six_roll;
        }
    }

    toggle_dice_selection_action(die_index) {
        if (die_index >= 0 && die_index < this.selected_dice.length && this.current_dice.length > 0 && !this.game_over) {
            this.selected_dice[die_index] = !this.selected_dice[die_index];
        }
    }

    call_cell_action(table_name, row_idx, col_idx) {
        if (!this.game_over) {
            if (col_idx === 3) {
                this._push_to_past_states();
                this.called_cell = { table: table_name, row: row_idx, col: col_idx };
            }
        }
    }

    _recalculate_total_score() {
        let base_score = 0;
        for (let c = 0; c < NUM_COLS; c++) {
            let col_sum = 0;
            for (let r = 0; r < NUM_TOP_ROWS; r++) {
                if (this.top_table[r][c] !== null) col_sum += this.top_table[r][c];
            }
            if (col_sum >= 60) {
                const original_sum = col_sum;
                col_sum += 30;
                const points_over_sixty = original_sum - 60;
                if (points_over_sixty > 0) col_sum += Math.floor(points_over_sixty / 10) * 10;
            }
            base_score += col_sum;
        }
        for (let c = 0; c < NUM_COLS; c++) {
            const max_v = this.middle_table[0][c];
            const min_v = this.middle_table[1][c];
            const ones_v = this.top_table[0][c];
            if (max_v !== null && min_v !== null && ones_v !== null && ones_v > 0) {
                base_score += (max_v - min_v) * (ones_v / 1);
            }
        }
        for (let r_idx = 0; r_idx < NUM_BOTTOM_ROWS; r_idx++) {
            for (let c_idx = 0; c_idx < NUM_COLS; c_idx++) {
                if (this.bottom_table[r_idx][c_idx] !== null) {
                    base_score += this.bottom_table[r_idx][c_idx];
                }
            }
        }
        this.total_score = base_score;
        // 5-star bonus: must be re-added on every recalc once earned, otherwise the next
        // write recomputes base_score and the +200 is lost. `star_bonus_applied` is kept
        // as an informational flag (useful for the heuristic / star_value logic).
        let total_stars = 0;
        for (let r = 0; r < NUM_TOP_ROWS; r++) {
            for (let c = 0; c < NUM_COLS; c++) {
                if (this.top_table_stars[r][c]) total_stars++;
            }
        }
        for (let r = 0; r < NUM_MIDDLE_ROWS; r++) {
            for (let c = 0; c < NUM_COLS; c++) {
                if (this.middle_table_stars[r][c]) total_stars++;
            }
        }
        if (total_stars >= 5) {
            this.total_score += 200;
            this.star_bonus_applied = true;
        }
    }

    write_to_cell_action(table_name, row_idx, col_idx) {
        if (this.game_over) return;

        this._push_to_past_states();
        const score = calculate_score(this.current_dice, table_name, row_idx);

        if (table_name === 'top') {
            this.top_table[row_idx][col_idx] = score;
            if (check_for_five_of_a_kind(this.current_dice)) {
                const target_number_for_row = row_idx + 1;
                const counts = get_dice_counts(this.current_dice);
                if (counts[target_number_for_row] >= 5) {
                    this.top_table_stars[row_idx][col_idx] = true;
                }
            }
        } else if (table_name === 'middle') {
            this.middle_table[row_idx][col_idx] = score;
            if (check_for_five_of_a_kind(this.current_dice)) {
                this.middle_table_stars[row_idx][col_idx] = true;
            }
        } else if (table_name === 'bottom') {
            this.bottom_table[row_idx][col_idx] = score;
        }

        this._recalculate_total_score();

        let empty_cells_remaining = 0;
        const tables = [this.top_table, this.middle_table, this.bottom_table];
        for (const t of tables) {
            for (const r of t) {
                for (const cell of r) {
                    if (cell === null) empty_cells_remaining++;
                }
            }
        }

        this.current_dice = [];
        this.selected_dice = Array(6).fill(false);
        this.current_turn += 1;
        this.has_rolled_all_six_this_turn = false;
        this.called_cell = null;

        if (empty_cells_remaining === 0) {
            this.game_over = true;
            this.throws_left = 0;
        } else if (empty_cells_remaining === 1) {
            this.throws_left = 5;
            this.game_over = false;
        } else {
            this.throws_left = 3;
            this.game_over = false;
        }
    }

    // Plain-object snapshot for localStorage. Undo/redo history is not persisted.
    toJSON() {
        return this._get_current_state_for_history();
    }

    static fromJSON(snapshot) {
        const s = new GameState();
        s._load_from_snapshot(snapshot);
        return s;
    }

    undo_action() {
        if (this.past_states.length > 0) {
            const current_savable_state = this._get_current_state_for_history();
            this.future_states.unshift(current_savable_state);
            const previous_snapshot = this.past_states.pop();
            this._load_from_snapshot(previous_snapshot);
        }
    }

    redo_action() {
        if (this.future_states.length > 0) {
            const current_savable_state = this._get_current_state_for_history();
            this.past_states.push(current_savable_state);
            const next_snapshot = this.future_states.shift();
            this._load_from_snapshot(next_snapshot);
        }
    }
}

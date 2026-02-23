// src/ai/AILog.ts
// Ported from AiLog.lua — learning AI that tracks which tactic is most effective.

/** Number of tactic slots (indices 0-20, matches original Lua 1-20). */
const TABLE_SIZE = 21;

/**
 * Tracks hit/miss statistics per tactic for online learning.
 * The AI periodically replays its most successful tactic.
 */
export class AILearning {
  /** Count of AI hits on opponent while using each attack tactic */
  hittingInAttackTable: number[] = new Array(TABLE_SIZE).fill(0);
  /** Count of AI hits on opponent while using each defense tactic */
  hittingInDefenseTable: number[] = new Array(TABLE_SIZE).fill(0);
  /** Count of AI getting hit while using each attack tactic */
  gotHitInAttackTable: number[] = new Array(TABLE_SIZE).fill(0);
  /** Count of AI getting hit while using each defense tactic */
  gotHitInDefenseTable: number[] = new Array(TABLE_SIZE).fill(0);

  /** Best attack tactic index (most hits landed) */
  attackMaxTactic = 0;
  /** Highest hit count in attack table */
  attackMax = 0;
  /** Best defense tactic index */
  defenseMaxTactic = 0;
  /** Highest hit count in defense table */
  defenseMax = 0;

  /**
   * Update the learning tables when a hit occurs.
   * Matches AiLog.lua:updateTacticsTable().
   *
   * @param mode - 'attack' or 'defense'
   * @param tactic - tactic index (0-20)
   * @param aiHit - true if AI hit the opponent, false if AI got hit
   */
  updateTacticsTable(mode: 'attack' | 'defense', tactic: number, aiHit: boolean): void {
    if (aiHit) {
      if (mode === 'attack') {
        this.hittingInAttackTable[tactic]++;
        if (this.hittingInAttackTable[tactic] > this.attackMax) {
          this.attackMax = this.hittingInAttackTable[tactic];
          this.attackMaxTactic = tactic;
        }
      } else {
        this.hittingInDefenseTable[tactic]++;
        if (this.hittingInDefenseTable[tactic] > this.defenseMax) {
          this.defenseMax = this.hittingInDefenseTable[tactic];
          this.defenseMaxTactic = tactic;
        }
      }
    } else {
      // AI got hit
      if (mode === 'attack') {
        this.gotHitInAttackTable[tactic]++;
      } else {
        this.gotHitInDefenseTable[tactic]++;
      }
    }
  }
}

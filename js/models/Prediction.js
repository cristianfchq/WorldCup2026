import { SCORING_RULES } from '../config/scoring-config.js';

/**
 * Pronóstico de un participante para un partido puntual.
 * El id del documento en Firestore es siempre `${matchId}_${participantId}`,
 * así que solo puede existir UN pronóstico por persona y partido.
 * Si el participante marcó "va a penales", wentToPenalties queda en true y
 * penaltyWinner indica a quién eligió como clasificado ('teamA' | 'teamB').
 */
export class Prediction {
  constructor({
    id,
    matchId,
    participantId,
    participantName,
    scoreA,
    scoreB,
    locked = false,
    points = null,
    wentToPenalties = false,
    penaltyWinner = null,
  }) {
    this.id = id;
    this.matchId = matchId;
    this.participantId = participantId;
    this.participantName = participantName;
    this.scoreA = scoreA;
    this.scoreB = scoreB;
    this.locked = locked;
    this.points = points;
    this.wentToPenalties = wentToPenalties;
    this.penaltyWinner = penaltyWinner;
  }

  static buildId(matchId, participantId) {
    return `${matchId}_${participantId}`;
  }

  static fromFirestore(id, data) {
    return new Prediction({ id, ...data });
  }

  toFirestore() {
    return {
      matchId: this.matchId,
      participantId: this.participantId,
      participantName: this.participantName,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      locked: this.locked,
      points: this.points,
      wentToPenalties: this.wentToPenalties,
      penaltyWinner: this.penaltyWinner,
    };
  }

  /**
   * Calcula los puntos ganados comparando este pronóstico contra el
   * resultado real de un partido. No muta el objeto, devuelve el número.
   */
  computePoints(match) {
    if (!match.hasRealResult) return null;

    const exactScoreMatch = this.scoreA === match.realScoreA && this.scoreB === match.realScoreB;

    // El partido real se definió por penales: para ganar puntos hay que
    // acertar el marcador del empate Y a quién eligió como clasificado.
    // No hay premio parcial por acertar solo una de las dos cosas.
    if (match.wentToPenalties) {
      const guessedPenaltyWinner = this.wentToPenalties && this.penaltyWinner === match.penaltyWinner;
      return exactScoreMatch && guessedPenaltyWinner ? SCORING_RULES.EXACT_SCORE_POINTS : SCORING_RULES.WRONG_POINTS;
    }

    if (exactScoreMatch) return SCORING_RULES.EXACT_SCORE_POINTS;

    const predictedWinner = Math.sign(this.scoreA - this.scoreB);
    const realWinner = Math.sign(match.realScoreA - match.realScoreB);
    if (predictedWinner === realWinner) return SCORING_RULES.CORRECT_WINNER_POINTS;

    return SCORING_RULES.WRONG_POINTS;
  }

  /**
   * A diferencia de computePoints() (que reparte puntos para la tabla de
   * posiciones general, incluyendo acertar solo el ganador), esto es
   * específicamente para saber quién se gana el DINERO de la apuesta de un
   * partido: solo cuenta como ganador quien acertó el marcador exacto (y,
   * si el partido fue a penales, también a quién eligió como clasificado).
   */
  guessedExactResult(match) {
    if (!match.hasRealResult) return false;

    const exactScoreMatch = this.scoreA === match.realScoreA && this.scoreB === match.realScoreB;
    if (!exactScoreMatch) return false;

    if (match.wentToPenalties) {
      return this.wentToPenalties && this.penaltyWinner === match.penaltyWinner;
    }

    return true;
  }
}

/**
 * Representa un partido del torneo, con su resultado real una vez que el
 * admin lo carga (realScoreA/realScoreB quedan en null hasta entonces).
 * Si el resultado real fue un empate definido por penales, wentToPenalties
 * queda en true y penaltyWinner indica quién clasificó ('teamA' | 'teamB').
 */
export class Match {
  constructor({
    id,
    phase,
    matchNumber,
    date,
    time,
    teamA,
    teamB,
    venue,
    realScoreA = null,
    realScoreB = null,
    bettingClosed = false,
    wentToPenalties = false,
    penaltyWinner = null,
  }) {
    this.id = id;
    this.phase = phase;
    this.matchNumber = matchNumber;
    this.date = date; // 'YYYY-MM-DD'
    this.time = time; // 'HH:mm'
    this.teamA = teamA;
    this.teamB = teamB;
    this.venue = venue || '';
    this.realScoreA = realScoreA;
    this.realScoreB = realScoreB;
    this.bettingClosed = bettingClosed; // el admin lo cierra manualmente por partido
    this.wentToPenalties = wentToPenalties;
    this.penaltyWinner = penaltyWinner;
  }

  static fromFirestore(id, data) {
    return new Match({ id, ...data });
  }

  toFirestore() {
    return {
      phase: this.phase,
      matchNumber: this.matchNumber,
      date: this.date,
      time: this.time,
      teamA: this.teamA,
      teamB: this.teamB,
      venue: this.venue,
      realScoreA: this.realScoreA,
      realScoreB: this.realScoreB,
      bettingClosed: this.bettingClosed,
      wentToPenalties: this.wentToPenalties,
      penaltyWinner: this.penaltyWinner,
    };
  }

  get hasRealResult() {
    return this.realScoreA !== null && this.realScoreB !== null;
  }

  isSameCalendarDate(otherDate) {
    return this.date === otherDate;
  }
}

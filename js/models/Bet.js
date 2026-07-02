/**
 * Registra si un participante ya pagó su apuesta de un partido puntual
 * (independiente de si ya envió su pronóstico o no). Un documento por
 * participante+partido, igual que Prediction.
 */
export class Bet {
  constructor({ id, matchId, participantId, participantName, paid = false }) {
    this.id = id;
    this.matchId = matchId;
    this.participantId = participantId;
    this.participantName = participantName;
    this.paid = paid;
  }

  static buildId(matchId, participantId) {
    return `${matchId}_${participantId}`;
  }

  static fromFirestore(id, data) {
    return new Bet({ id, ...data });
  }

  toFirestore() {
    return {
      matchId: this.matchId,
      participantId: this.participantId,
      participantName: this.participantName,
      paid: this.paid,
    };
  }
}

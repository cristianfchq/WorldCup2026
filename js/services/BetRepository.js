import { FirebaseService } from './FirebaseService.js';
import { Bet } from '../models/Bet.js';

const COLLECTION = 'bets';

/** Encapsula todo el acceso a datos de pago de apuestas (solo lo usa el admin). */
export class BetRepository {
  async getAll() {
    const docs = await FirebaseService.getAll(COLLECTION);
    return docs.map((d) => Bet.fromFirestore(d.id, d.data));
  }

  async getByMatch(matchId) {
    const docs = await FirebaseService.getWhere(COLLECTION, 'matchId', '==', matchId);
    return docs.map((d) => Bet.fromFirestore(d.id, d.data));
  }

  /** Marca (o desmarca) el pago de un participante para un partido puntual. */
  async setPaid(matchId, participant, paid) {
    const bet = new Bet({
      id: Bet.buildId(matchId, participant.id),
      matchId,
      participantId: participant.id,
      participantName: participant.name,
      paid,
    });
    await FirebaseService.save(COLLECTION, bet.id, bet.toFirestore());
    return bet;
  }
}

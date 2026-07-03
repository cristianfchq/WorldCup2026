import { FirebaseService } from './FirebaseService.js';
import { Match } from '../models/Match.js';

const COLLECTION = 'matches';

/** Encapsula todo el acceso a datos de partidos. */
export class MatchRepository {
  async getAll() {
    const docs = await FirebaseService.getAll(COLLECTION);
    return docs
      .map((d) => Match.fromFirestore(d.id, d.data))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }

  async getById(id) {
    const doc = await FirebaseService.getById(COLLECTION, id);
    return doc ? Match.fromFirestore(doc.id, doc.data) : null;
  }

  async save(match) {
    await FirebaseService.save(COLLECTION, match.id, match.toFirestore());
  }

  /**
   * Alta a partir de los campos crudos del JSON de importación. Si YA existe
   * un partido con ese id (misma fase + número de partido), NO lo toca —
   * así se puede volver a importar un archivo con partidos viejos y nuevos
   * mezclados sin perder resultados, penales o apuestas cerradas que el
   * admin ya haya cargado para los partidos existentes.
   * @returns {Promise<boolean>} true si se creó un partido nuevo, false si ya existía y se dejó igual.
   */
  async createIfNotExists(raw) {
    const id = `${raw.phase}-${raw.matchNumber}`;
    const existing = await this.getById(id);
    if (existing) return false;

    const match = new Match({ id, ...raw });
    await this.save(match);
    return true;
  }

  /**
   * Guarda el resultado real cargado por el admin. Si wentToPenalties es
   * true, penaltyWinner ('teamA' | 'teamB') indica quién clasificó; el
   * marcador de penales en sí no se guarda, solo quién ganó la serie.
   */
  async saveRealResult(matchId, realScoreA, realScoreB, wentToPenalties = false, penaltyWinner = null) {
    const match = await this.getById(matchId);
    if (!match) throw new Error(`Partido ${matchId} no encontrado`);
    match.realScoreA = realScoreA;
    match.realScoreB = realScoreB;
    match.wentToPenalties = wentToPenalties;
    match.penaltyWinner = wentToPenalties ? penaltyWinner : null;
    await this.save(match);
    return match;
  }

  /**
   * Cierra o reabre las apuestas de un partido puntual. Con las apuestas
   * cerradas, nadie puede guardar/editar su pronóstico para ese partido
   * desde la web pública (ver MatchCard.js), sin importar si ya empezó o no.
   */
  async setBettingClosed(matchId, bettingClosed) {
    const match = await this.getById(matchId);
    if (!match) throw new Error(`Partido ${matchId} no encontrado`);
    match.bettingClosed = bettingClosed;
    await this.save(match);
    return match;
  }
}

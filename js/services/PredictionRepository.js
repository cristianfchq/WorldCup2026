import { FirebaseService } from './FirebaseService.js';
import { Prediction } from '../models/Prediction.js';

const COLLECTION = 'predictions';

/** Encapsula todo el acceso a datos de pronósticos. */
export class PredictionRepository {
  async getAll() {
    const docs = await FirebaseService.getAll(COLLECTION);
    return docs.map((d) => Prediction.fromFirestore(d.id, d.data));
  }

  async getByParticipant(participantId) {
    const docs = await FirebaseService.getWhere(COLLECTION, 'participantId', '==', participantId);
    return docs.map((d) => Prediction.fromFirestore(d.id, d.data));
  }

  async getByMatch(matchId) {
    const docs = await FirebaseService.getWhere(COLLECTION, 'matchId', '==', matchId);
    return docs.map((d) => Prediction.fromFirestore(d.id, d.data));
  }

  async getOne(matchId, participantId) {
    const id = Prediction.buildId(matchId, participantId);
    const doc = await FirebaseService.getById(COLLECTION, id);
    return doc ? Prediction.fromFirestore(doc.id, doc.data) : null;
  }

  /**
   * Crea o actualiza un pronóstico. Firestore rechazará esta escritura (ver
   * firestore.rules) si el pronóstico ya existía y estaba "locked", así que
   * esta es la última línea de defensa contra ediciones fuera de tiempo,
   * independiente de que la interfaz ya deshabilite los campos.
   */
  async save(prediction) {
    await FirebaseService.save(COLLECTION, prediction.id, prediction.toFirestore());
  }

  /**
   * Acción exclusiva del panel admin: reabre un pronóstico ya bloqueado para
   * que el participante pueda volver a escribirlo, sin tocar el marcador que
   * ya había guardado. Firestore solo permite esta transición puntual
   * (locked true -> false, mismo marcador) según firestore.rules.
   */
  async unlock(prediction) {
    prediction.locked = false;
    await this.save(prediction);
  }
}

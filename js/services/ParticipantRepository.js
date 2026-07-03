import { FirebaseService } from './FirebaseService.js';
import { Participant } from '../models/Participant.js';

const COLLECTION = 'participants';

/** Encapsula todo el acceso a datos de participantes. */
export class ParticipantRepository {
  async getAll() {
    const docs = await FirebaseService.getAll(COLLECTION);
    return docs
      .map((d) => Participant.fromFirestore(d.id, d.data))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(id) {
    const doc = await FirebaseService.getById(COLLECTION, id);
    return doc ? Participant.fromFirestore(doc.id, doc.data) : null;
  }

  async save(participant) {
    await FirebaseService.save(COLLECTION, participant.id, participant.toFirestore());
  }

  /**
   * Alta a partir de un nombre (usada por la importación masiva). Si ya
   * existe un participante con ese mismo nombre, no lo toca — permite
   * re-importar un archivo con nombres viejos y nuevos mezclados sin
   * duplicar ni pisar nada.
   * @returns {Promise<boolean>} true si se creó uno nuevo, false si ya existía.
   */
  async createIfNotExists(name) {
    const id = slugify(name);
    const existing = await this.getById(id);
    if (existing) return false;

    const participant = new Participant({ id, name });
    await this.save(participant);
    return true;
  }
}

// Convierte "Dr Herrera" en "dr-herrera", quitando tildes para tener un id
// de documento estable y legible en Firestore.
function slugify(text) {
  const COMBINING_MARKS = /[̀-ͯ]/g;
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

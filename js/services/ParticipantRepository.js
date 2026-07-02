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

  async save(participant) {
    await FirebaseService.save(COLLECTION, participant.id, participant.toFirestore());
  }

  /** Alta rápida a partir de un nombre (usada por la importación masiva). */
  async createFromName(name) {
    const id = slugify(name);
    const participant = new Participant({ id, name });
    await this.save(participant);
    return participant;
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

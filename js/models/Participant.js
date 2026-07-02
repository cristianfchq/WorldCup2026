/**
 * Representa a una persona que puede hacer pronósticos.
 */
export class Participant {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  static fromFirestore(id, data) {
    return new Participant({ id, name: data.name });
  }

  toFirestore() {
    return { name: this.name };
  }
}

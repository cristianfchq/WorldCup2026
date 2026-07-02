import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from '../config/firebase-config.js';

/**
 * Punto único de acceso a Firestore (patrón singleton). Los repositorios
 * (ParticipantRepository, MatchRepository, PredictionRepository) dependen de
 * esta clase en vez de hablar con el SDK de Firebase directamente: si un día
 * cambia el proveedor de base de datos, solo hay que tocar este archivo.
 */
class FirebaseServiceClass {
  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.db = getFirestore(this.app);
  }

  collection(name) {
    return collection(this.db, name);
  }

  docRef(collectionName, id) {
    return doc(this.db, collectionName, id);
  }

  async getById(collectionName, id) {
    const snapshot = await getDoc(this.docRef(collectionName, id));
    return snapshot.exists() ? { id: snapshot.id, data: snapshot.data() } : null;
  }

  async getAll(collectionName) {
    const snapshot = await getDocs(this.collection(collectionName));
    return snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));
  }

  async getWhere(collectionName, field, operator, value) {
    const q = query(this.collection(collectionName), where(field, operator, value));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));
  }

  async save(collectionName, id, data) {
    await setDoc(this.docRef(collectionName, id), data, { merge: false });
  }

  async remove(collectionName, id) {
    await deleteDoc(this.docRef(collectionName, id));
  }
}

export const FirebaseService = new FirebaseServiceClass();

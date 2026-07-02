// Configuración de conexión a Firebase (proyecto: mundial-pronosticos-5f8fa).
// Esta config NO es un secreto: Firebase está diseñado para que estas claves
// viajen en el cliente, la seguridad real vive en firestore.rules.
//
// Nota: este proyecto no usa npm ni un bundler, así que NO se importa desde
// "firebase/app" (eso solo funciona con Webpack/Vite instalados). El SDK se
// carga por CDN directamente en js/services/FirebaseService.js, que es quien
// llama a initializeApp(firebaseConfig) usando este objeto.
export const firebaseConfig = {
  apiKey: 'AIzaSyBlxpd-sdOsDgMFrIcbZ72cgrd_ixvtCoQ',
  authDomain: 'mundial-pronosticos-5f8fa.firebaseapp.com',
  projectId: 'mundial-pronosticos-5f8fa',
  storageBucket: 'mundial-pronosticos-5f8fa.firebasestorage.app',
  messagingSenderId: '457093176132',
  appId: '1:457093176132:web:c88a9200d9da4b17c65511',
  measurementId: 'G-SK170FVPG2',
};

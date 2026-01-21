// Firebase initialization for Young Farmers Agencies LTD

const firebaseConfig = {
  apiKey: "AIzaSyB5xvYv-d_INyN4PB-D5ZsDCp29sNvuryo",
  authDomain: "yfarmers-app.firebaseapp.com",
  projectId: "yfarmers-app",
  storageBucket: "yfarmers-app.firebasestorage.app",
  messagingSenderId: "425745432452",
  appId: "1:425745432452:web:24073bf4e3c5dc26f3a7d1",
  measurementId: "G-X193QBDVNW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Services
// These will be accessible globally in app.js as we used the compat SDKs in index.html
const auth = firebase.auth();
const db = firebase.firestore();

// Provider for Google Login
const googleProvider = new firebase.auth.GoogleAuthProvider();
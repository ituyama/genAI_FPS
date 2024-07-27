import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyBySTi7FDFUVR_QYGYrqBTP5ys--T5ptAo",
  authDomain: "genai-fps.firebaseapp.com",
  projectId: "genai-fps",
  storageBucket: "genai-fps.appspot.com",
  messagingSenderId: "1085075777298",
  appId: "1:1085075777298:web:a20b64e9887b0784dcf5cb",
  measurementId: "G-P1EV9LGCSD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


export { db };

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB7Iz4Mbwxpn9zNOG6kxbUwejOb3gwpzqk",
  authDomain: "appvacances-c261a.firebaseapp.com",
  projectId: "appvacances-c261a",
  storageBucket: "appvacances-c261a.firebasestorage.app",
  messagingSenderId: "148120267357",
  appId: "1:148120267357:web:1ed9130c99e830a827bbb4",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

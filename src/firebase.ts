import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA0NvHmjGmvWdM5O576HHE9_3_we7JaxGs",
    authDomain: "minglemart-eb6da.firebaseapp.com",
      projectId: "minglemart-eb6da",
        storageBucket: "minglemart-eb6da.firebasestorage.app",
          messagingSenderId: "711447979810",
            appId: "1:711447979810:web:82c1fa0815043f4db2277b",
            };

            const app = initializeApp(firebaseConfig);

            export const auth = getAuth(app);

            export const db = getFirestore(app);

            export default app;
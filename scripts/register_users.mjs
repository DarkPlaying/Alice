import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC9hLgIEz1xqoHFghLreqa1B5vBQUWCJw8",
  authDomain: "borderland2.firebaseapp.com",
  databaseURL: "https://borderland2-default-rtdb.firebaseio.com",
  projectId: "borderland2",
  storageBucket: "borderland2.firebasestorage.app",
  messagingSenderId: "43624321078",
  appId: "1:43624321078:web:9007f7910aaf509e190897",
  measurementId: "G-H2X3CK049Y"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function register(username, email, password, role) {
  try {
    console.log(`Registering ${username}...`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await setDoc(doc(db, "users", user.uid), {
      username: username,
      role: role,
      points: 1000,
      created_at: new Date().toISOString()
    });
    
    console.log(`Success: ${username} registered with uid ${user.uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log(`${username} is already registered.`);
    } else {
      console.error(`Failed for ${username}:`, err.message);
    }
  }
}

async function run() {
  await register("sanjay", "sanjay@borderland.com", "password123", "admin");
  await register("admin", "admin@borderland.com", "password123", "master");
  await register("player1", "player1@borderland.com", "password123", "player");
  process.exit(0);
}

run();

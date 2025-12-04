import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Firebase configs for each environment
// Get these from Firebase Console → Project Settings → Your Apps → Web App
const devConfig = {
    apiKey: "AIzaSyD1s0XjN0sSak6xKzlBXPk6WrWCquDXZYI",
    authDomain: "lyrestudio-dev.firebaseapp.com",
    projectId: "lyrestudio-dev",
    storageBucket: "lyrestudio-dev.firebasestorage.app",
    messagingSenderId: "737993680938",
    appId: "1:737993680938:web:53981adf1588d195aa3b53",
    measurementId: "G-1DXWG9H44L"
};

const prodConfig = {
    // TODO: Update with lyrestudio Firebase config
    apiKey: "YOUR_PROD_API_KEY",
    authDomain: "lyrestudio.firebaseapp.com",
    projectId: "lyrestudio",
    storageBucket: "lyrestudio.firebasestorage.app",
    messagingSenderId: "YOUR_PROD_SENDER_ID",
    appId: "YOUR_PROD_APP_ID",
    measurementId: "YOUR_PROD_MEASUREMENT_ID"
};

// Detect environment based on Firebase Hosting URLs
// lyrestudio-dev.web.app → dev
// lyrestudio.web.app → prod
const hostname = window.location.hostname;
// Prod if hostname is exactly "lyrestudio.web.app" or "lyrestudio.firebaseapp.com"
// (not "lyrestudio-dev" which contains "lyrestudio")
const isProd = hostname === 'lyrestudio.web.app' || hostname === 'lyrestudio.firebaseapp.com';
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

const firebaseConfig = isProd ? prodConfig : devConfig;

console.log(`Firebase: Using ${isProd ? 'PROD' : 'DEV'} config (${firebaseConfig.projectId})`);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const analytics = isLocal ? null : getAnalytics(app); // Skip analytics on localhost
export const googleProvider = new GoogleAuthProvider();

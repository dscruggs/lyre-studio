import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const devConfig = {
    apiKey: "AIzaSyCk6uymR8K1Adxa5x-rrD4mgG2sWn-MJPM",
    authDomain: "lyrestudio-dev.firebaseapp.com",
    projectId: "lyrestudio-dev",
    storageBucket: "lyrestudio-dev.firebasestorage.app",
    messagingSenderId: "737993680938",
    appId: "1:737993680938:web:53981adf1588d195aa3b53",
    measurementId: "G-1DXWG9H44L"
};

const prodConfig = {
    apiKey: "AIzaSyA_E1VuD5k1vmqI0AhffJOtGxQk9FkRB4A",
    authDomain: "lyrestudio.firebaseapp.com",
    projectId: "lyrestudio",
    storageBucket: "lyrestudio.firebasestorage.app",
    messagingSenderId: "1001047216358",
    appId: "1:1001047216358:web:3de7fcd2982242d1c9eb27",
    measurementId: "G-Q6DE0KLRS2"
};

const hostname = window.location.hostname;
const isProd = hostname === 'lyrestudio.web.app' || hostname === 'lyrestudio.firebaseapp.com';
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

const firebaseConfig = isProd ? prodConfig : devConfig;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const analytics = isLocal ? null : getAnalytics(app);
export const googleProvider = new GoogleAuthProvider();

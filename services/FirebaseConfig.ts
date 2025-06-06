import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBe-3P8QLEvRP_tEKWXuu4iuAupSyHl_G0",
  authDomain: "phar-stock.firebaseapp.com",
  projectId: "phar-stock",
  storageBucket: "phar-stock.appspot.com",
  messagingSenderId: "183491720141",
  appId: "1:183491720141:web:6ca6da508445abdd3d4a84",
  measurementId: "G-6N5JQ2HYYY"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

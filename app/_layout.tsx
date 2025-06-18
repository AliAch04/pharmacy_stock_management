import { Stack } from 'expo-router';
import { UserProvider } from './context/UserContext'; // adjust path if needed
import './globals.css';

export default function RootLayout() {
  return (
    <UserProvider>
      <Stack
        initialRouteName="home"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="home" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </UserProvider>
  );
}

import { Stack } from 'expo-router';
import './globals.css';

export default function RootLayout() {
  return (
    <Stack
      initialRouteName="home"
      screenOptions={{ headerShown: false }} // applies to all screens inside
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

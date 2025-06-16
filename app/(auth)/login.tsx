import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { account, ID } from '../../lib/appwrite';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      
      // 1. First, delete any existing session to avoid conflicts
      try {
        await account.deleteSession('current');
      } catch (sessionError) {
        // If no session exists, this will throw an error, which is fine
        console.log('No existing session to delete');
      }

      // 2. Create new session
      await account.createEmailPasswordSession(email, password);
      
      // 3. Get current user to verify login was successful
      const currentUser = await account.get();
      if (!currentUser) throw new Error('Failed to verify login');

      setLoading(false);
      
      
      // 4. Redirect to home - using push instead of replace to allow back navigation if needed
      router.push('/(tabs)');
      
    } catch (error: any) {
      setLoading(false);
      console.error('Login failed:', error);
      
      // More specific error messages
      let errorMessage = 'An error occurred during login';
      if (error.message.includes('Invalid credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (error.message.includes('session')) {
        errorMessage = 'Session error - please try again';
      }
      
      Alert.alert('Login failed', errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#ccc"
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#ccc"
            onChangeText={setPassword}
            secureTextEntry
            value={password}
          />

          <TouchableOpacity 
            style={[styles.button, loading && styles.disabledButton]} 
            onPress={handleLogin} 
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, justifyContent: 'center', padding: 20 },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
  },
  content: { marginTop: 100 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    color: '#fff',
  },
  button: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  buttonText: {
    color: '#667eea',
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 14,
  },
  linkBold: {
    fontWeight: 'bold',
    color: '#fff',
  },
});
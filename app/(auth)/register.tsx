import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { account, ID, databases, databaseId, usersCollectionId, Permission, Role } from '../../lib/appwrite';
export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

const handleRegister = async () => {
  const { name, email, password, confirm } = form;

  if (!name || !email || !password || !confirm) {
    Alert.alert('Error', 'Please fill in all fields');
    return;
  }
  if (password !== confirm) {
    Alert.alert('Error', 'Passwords do not match');
    return;
  }
  if (password.length < 6) {
    Alert.alert('Error', 'Password too short');
    return;
  }

  try {
    setLoading(true);

    // 1. Delete existing session (if any)
    try {
      await account.deleteSession('current');
    } catch (sessionError) {
      console.log('No existing session to delete');
    }

    // 2. Create account
    const user = await account.create(ID.unique(), email, password, name);
    if (!user) throw new Error('Failed to create account');

    // 3. Create document in users collection (with string permissions)
    await databases.createDocument(
      databaseId,
      usersCollectionId,
      ID.unique(),
      {
        userId: user.$id,
        name,
        email,
      }

    );

    // 4. Create session
    await account.createEmailPasswordSession(email, password);

    setLoading(false);
    Alert.alert('Success', 'Account created successfully!');
    
    // 5. Redirect to home
    router.replace('/(auth)/login');
  } catch (error: any) {
    setLoading(false);
    Alert.alert('Registration Error', error.message || 'Something went wrong');
    console.error('Registration failed:', error);
  }
};
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join PharmStock today</Text>

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#ccc"
            onChangeText={v => handleChange('name', v)}
            value={form.name}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#ccc"
            onChangeText={v => handleChange('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#ccc"
            onChangeText={v => handleChange('password', v)}
            secureTextEntry
            value={form.password}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#ccc"
            onChangeText={v => handleChange('confirm', v)}
            secureTextEntry
            value={form.confirm}
          />

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: {
    padding: 20,
    justifyContent: 'center',
    flexGrow: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
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
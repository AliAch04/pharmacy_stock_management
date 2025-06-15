import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function HomePage() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="medical" size={60} color="#fff" />
            </View>
            <Text style={styles.title}>PharmStock</Text>
            <Text style={styles.subtitle}>Smart Pharmacy Management</Text>
          </View>

          <View style={styles.featuresContainer}>
            <View style={styles.featureCard}>
              <Ionicons name="archive" size={24} color="#667eea" />
              <Text style={styles.featureText}>Inventory Management</Text>
            </View>
            <View style={styles.featureCard}>
              <Ionicons name="bar-chart" size={24} color="#667eea" />
              <Text style={styles.featureText}>Sales Analytics</Text>
            </View>
            <View style={styles.featureCard}>
              <Ionicons name="time" size={24} color="#667eea" />
              <Text style={styles.featureText}>Expiry Tracking</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginButtonText}>Login</Text>
              <Ionicons name="arrow-forward" size={20} color="#667eea" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={styles.registerButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.bottomText}>
            Streamline your pharmacy operations with our comprehensive management solution
          </Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '300',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 40,
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
  },
  featureText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  buttonContainer: { marginTop: 20 },
  loginButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  registerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 20,
  },
});

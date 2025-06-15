// components/ActionsMenu.tsx
import { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { account } from '../lib/appwrite';
import { useRouter } from 'expo-router';

export default function ActionsMenu() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => setVisible(false),
        },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            try {
              await account.deleteSession('current');
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert('Erreur', 'Échec de la déconnexion');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setVisible(!visible)}>
        <Ionicons name="ellipsis-vertical" size={24} color="black" />
      </TouchableOpacity>

      {visible && (
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={() => {
            setVisible(false);
            // Add other actions here if needed
          }}>
            <Ionicons name="settings-outline" size={18} style={styles.icon} />
            <Text>Paramètres</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, styles.logoutItem]} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} style={styles.icon} />
            <Text>Déconnecter</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginRight: 15,
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: 30,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 8,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 100,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  logoutItem: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  icon: {
    marginRight: 10,
    color: '#333',
  },
});
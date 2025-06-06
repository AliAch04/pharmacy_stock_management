import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ToastAndroid, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Client, Databases, ID } from 'appwrite';

const client = new Client();
client
  .setEndpoint('https://[YOUR_APPWRITE_ENDPOINT]')
  .setProject('[YOUR_PROJECT_ID]');

const databases = new Databases(client);
const DATABASE_ID = '[YOUR_DATABASE_ID]';
const COLLECTION_ID = 'products';

export default function InventoryDashboard({ navigation }) {
  const [products, setProducts] = useState([]);

  const fetchProducts = async () => {
    try {
      const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID);
      setProducts(response.documents);
    } catch (error) {
      console.error('Erreur de récupération :', error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const confirmDelete = (id) => {
    Alert.alert(
      'Supprimer le produit',
      'Êtes-vous sûr de vouloir supprimer ce produit ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, id);
              fetchProducts();
              if (Platform.OS === 'android') {
                ToastAndroid.show('Produit supprimé avec succès', ToastAndroid.SHORT);
              } else {
                Alert.alert('Succès', 'Produit supprimé avec succès');
              }
            } catch (error) {
              Alert.alert('Erreur', 'La suppression a échoué : ' + error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-blue-50">
      <StatusBar style="dark" />
      <View className="flex-row justify-between items-center p-4 bg-white shadow">
        <Text className="text-xl font-bold">Inventory Dashboard</Text>
        <TouchableOpacity
          className="bg-blue-500 px-4 py-2 rounded-md"
          onPress={() => navigation.navigate('AddProduct')}
        >
          <Text className="text-white font-semibold">Add New Product</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="p-4">
        {products.map((item, index) => (
          <View
            key={index}
            className={`mb-4 p-4 rounded-lg shadow-sm ${item.status === 'Low Stock' ? 'bg-red-100' : 'bg-white'}`}
          >
            <View className="flex-row items-center mb-2">
              <View className="bg-gray-200 w-12 h-12 rounded-lg justify-center items-center mr-4" />
              <View className="flex-1">
                <Text className="font-bold text-base">{item.name}</Text>
                <Text className="text-gray-600 text-sm">{item.description}</Text>
                <View className="mt-1 bg-gray-100 px-2 py-1 rounded-full self-start">
                  <Text className="text-xs text-gray-700">{item.category}</Text>
                </View>
              </View>
            </View>

            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-gray-800 font-medium">{item.stock} units</Text>
              <View
                className={`px-3 py-1 rounded-full ${item.status === 'Low Stock' ? 'bg-yellow-100 border border-yellow-500' : 'bg-blue-100'}`}
              >
                <Text
                  className={`text-xs ${item.status === 'Low Stock' ? 'text-yellow-700' : 'text-blue-700'}`}
                >
                  {item.status}
                </Text>
              </View>
              <View className="flex-row space-x-2">
                <TouchableOpacity onPress={() => navigation.navigate('EditProduct', { product: item })}>
                  <Ionicons name="pencil-outline" size={20} color="#555" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(item.$id)}>
                  <Ionicons name="trash-outline" size={20} color="red" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

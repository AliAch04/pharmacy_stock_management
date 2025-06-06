import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Button,
  Platform,
  ToastAndroid,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { databases, storage, DATABASE_ID, COLLECTION_ID, BUCKET_ID } from '@/services/appwrite';
import { ID } from 'appwrite'; 

export default function InventoryDashboard() {
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // ✅ Form avec les bons attributs
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    quantity: '',
    image: null,
  });

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

  const handleDelete = async (id) => {
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, id);
      fetchProducts();
      showToast('Produit supprimé avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'La suppression a échoué : ' + error.message);
    }
  };

  const confirmDelete = (id) => {
    Alert.alert(
      'Supprimer le produit',
      'Êtes-vous sûr de vouloir supprimer ce produit ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => handleDelete(id) },
      ]
    );
  };

  const showToast = (message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Info', message);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setForm({ ...form, image: result.assets[0] });
    }
  };

  const openModal = (product = null) => {
    setEditingProduct(product);
    setForm(
      product
        ? {
            name: product.name,
            description: product.description,
            category: product.category,
            price: String(product.price),
            quantity: String(product.quantity),
            image: null,
          }
        : {
            name: '',
            description: '',
            category: '',
            price: '',
            quantity: '',
            image: null,
          }
    );
    setModalVisible(true);
  };

  const uploadImage = async (image) => {
    try {
      const response = await storage.createFile(
        BUCKET_ID,
        ID.unique(),
        {
          uri: image.uri,
          name: 'image.jpg',
          type: 'image/jpeg',
        }
      );
      return response.$id;
    } catch (error) {
      throw new Error('Échec de l’upload d’image');
    }
  };

  const getImageUrl = (id) =>
    `https://cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files/${id}/view?project=68424153002403801f6b`;

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name,
        description: form.description,
        category: form.category,
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity),
      };

      if (form.image) {
        const uploadedId = await uploadImage(form.image);
        payload.image = uploadedId;
      }

      if (editingProduct) {
        await databases.updateDocument(DATABASE_ID, COLLECTION_ID, editingProduct.$id, payload);
      } else {
        await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), payload);
      }

      fetchProducts();
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-blue-50">
      <StatusBar style="dark" />
      <View className="flex-row justify-between items-center p-4 bg-white shadow">
        <Text className="text-xl font-bold">Inventory Dashboard</Text>
        <TouchableOpacity className="bg-blue-500 px-4 py-2 rounded-md" onPress={() => openModal()}>
          <Text className="text-white font-semibold">Ajouter un produit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="p-4">
        {products.map((item) => (
          <View
            key={item.$id}
            className="mb-4 p-4 rounded-lg shadow-sm bg-white"
          >
            <View className="flex-row items-center mb-2">
              {item.image ? (
                <Image
                  source={{ uri: getImageUrl(item.image) }}
                  style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }}
                />
              ) : (
                <View className="bg-gray-200 w-12 h-12 rounded-lg justify-center items-center mr-4" />
              )}
              <View className="flex-1">
                <Text className="font-bold text-base">{item.name}</Text>
                <Text className="text-gray-600 text-sm">{item.description}</Text>
                <Text className="text-gray-500 text-sm">Catégorie : {item.category}</Text>
                <Text className="text-gray-500 text-sm">Prix : {item.price} €</Text>
                <Text className="text-gray-700 font-semibold">Quantité : {item.quantity}</Text>
              </View>
            </View>

            <View className="flex-row justify-end space-x-4">
              <TouchableOpacity onPress={() => openModal(item)}>
                <Ionicons name="pencil-outline" size={20} color="#555" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(item.$id)}>
                <Ionicons name="trash-outline" size={20} color="red" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-xl w-11/12">
            <Text className="text-lg font-bold mb-4">
              {editingProduct ? 'Modifier un produit' : 'Ajouter un produit'}
            </Text>

            {['name', 'description', 'category', 'price', 'quantity'].map((field) => (
              <TextInput
                key={field}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={form[field]}
                onChangeText={(text) => setForm({ ...form, [field]: text })}
                keyboardType={field === 'price' || field === 'quantity' ? 'numeric' : 'default'}
                className="border p-2 mb-3 rounded"
              />
            ))}

            {!editingProduct && (
              <>
                <TouchableOpacity onPress={pickImage} className="bg-gray-200 p-3 rounded mb-3 items-center">
                  <Text>Sélectionner une image</Text>
                </TouchableOpacity>
                {form.image && (
                  <Image source={{ uri: form.image.uri }} style={{ width: 100, height: 100, marginBottom: 10 }} />
                )}
              </>
            )}

            <View className="flex-row justify-between mt-4">
              <Button title="Annuler" onPress={() => setModalVisible(false)} />
              <Button title="Enregistrer" onPress={handleSave} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

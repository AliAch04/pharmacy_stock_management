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
import { useRouter } from 'expo-router';
import { client, account, databases, storage, DATABASE_ID, COLLECTION_ID, BUCKET_ID, } from '@/services/appwrite';
import { getMedicines, getFilePreview } from '../../services/medicines';
import { ID } from 'appwrite';
import { Picker } from '@react-native-picker/picker';
import ActionsMenu from '@/constants/ActionsMenu';


const PRODUCT_TYPES = ['Médicament', 'Équipement', 'Supplément', 'Autre'];

interface Medicine {
  $id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  imageId?: string;
  category: string;
}

export default function InventoryDashboard() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [form, setForm] = useState({ name: '', description: '', stock: '', type: '', image: null });
  const [expandedMenu, setExpandedMenu] = useState(false);
  const [reduceStockModal, setReduceStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantityToReduce, setQuantityToReduce] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Logout function
  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Déconnecter', 
          style: 'destructive', 
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              await account.deleteSession('current'); // Terminate current session
              showToast('Déconnecté avec succès');
              router.replace('/(auth)/login'); // Navigate back to login
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Erreur', 'Échec de la déconnexion : ' + error.message);
            } finally {
              setIsLoggingOut(false);
            }
          }
        },
      ]
    );
  };

  const logTransaction = async (productId, productName, type, quantity, oldStock, newStock) => {
    try {
      await databases.createDocument(DATABASE_ID, TRANSACTIONS_COLLECTION_ID, ID.unique(), {
        productId,
        productName,
        type,
        quantity,
        oldStock,
        newStock,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la transaction:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID);
      setProducts(response.documents);
    } catch (error) {
      console.error('Erreur de récupération :', error);
    }
  };

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        setLoading(true);
        const response = await getMedicines({
          limit: 20,
          sortField: 'name',
          sortOrder: 'ASC'
        });
        setMedicines(response.documents);
      } catch (err) {
        console.error('Failed to fetch medicines:', err);
        setError('Failed to load medicines. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchMedicines();
  }, []);

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
      'Etes-vous sûr de vouloir supprimer ce produit ?',
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

    if (!result.canceled && result.assets?.length > 0) {
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
            type: product.type,
            stock: String(product.stock),
            image: null,
          }
        : {
            name: '',
            description: '',
            type: '',
            stock: '',
            image: null,
          }
    );
    setModalVisible(true);
  };

  const getStockStatus = (stock) => {
    const s = parseInt(stock);
    if (isNaN(s)) return 'Indéterminé';
    if (s <= 5) return 'Stock Faible';
    if (s <= 20) return 'Stock Moyen';
    return 'En Stock';
  };

  const uploadImage = async (image) => {
    try {
      const response = await storage.createFile(BUCKET_ID, ID.unique(), {
        uri: image.uri,
        name: 'image.jpg',
        type: 'image/jpeg',
      });
      return response.$id;
    } catch (error) {
      throw new Error("Echec de l'upload d'image");
    }
  };

  const getImageUrl = (id) =>
    `https://cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files/${id}/view?project=68424153002403801f6b`;

  const handleSave = async () => {
    try {
      const newStock = parseInt(form.stock);
      if (!form.name.trim() || !form.description.trim() || !form.type || isNaN(newStock)) {
        throw new Error('Tous les champs sont requis');
      }

      const status = getStockStatus(newStock);
      let payload;

      if (editingProduct) {
        const oldStock = editingProduct.stock;
        payload = {
          name: form.name,
          description: form.description,
          stock: newStock,
          type: form.type,
          status,
        };

        await databases.updateDocument(DATABASE_ID, COLLECTION_ID, editingProduct.$id, payload);

        await logTransaction(
          editingProduct.$id,
          editingProduct.name,
          'edit',
          Math.abs(newStock - oldStock),
          oldStock,
          newStock
        );
      } else {
        let imageId = null;
        if (form.image) {
          const uploaded = await uploadImage(form.image);
          imageId = uploaded;
        }

        payload = {
          name: form.name,
          description: form.description,
          stock: newStock,
          type: form.type,
          status,
          ...(imageId && { imageId }),
        };

        const response = await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), payload);

        await logTransaction(response.$id, form.name, 'add', newStock, 0, newStock);
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
        <Text className="text-xl font-bold">Tableau de Bord</Text>

        <View className="flex-row items-center space-x-2">

          {/* Actions Menu */}
          <View className="relative z-20">
            <TouchableOpacity
              className="bg-blue-500 px-4 py-2 rounded-md flex-row items-center"
              onPress={() => setExpandedMenu(!expandedMenu)}
            >
              <Text className="text-white font-semibold mr-2">Actions</Text>
              <Ionicons name={expandedMenu ? 'chevron-up' : 'chevron-down'} size={16} color="white" />
            </TouchableOpacity>

            {expandedMenu && (
              <View
                className="absolute top-12 right-0 bg-white border border-gray-200 rounded-lg shadow-lg w-48"
                style={{ zIndex: 100 }}
              >
                <TouchableOpacity
                  className="p-3 border-b border-gray-100 flex-row items-center"
                  onPress={() => {
                    openModal();
                    setExpandedMenu(false);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
                  <Text className="ml-2 text-gray-700">Ajouter un produit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="p-3 flex-row items-center"
                  onPress={() => {
                    setReduceStockModal(true);
                    setExpandedMenu(false);
                  }}
                >
                  <Ionicons name="remove-circle-outline" size={20} color="#EF4444" />
                  <Text className="ml-2 text-gray-700">Réduire le stock</Text>
                </TouchableOpacity>

                {/* Logout Button */}
              <TouchableOpacity
                className="bg-red-500 px-3 py-2 rounded-md flex-row items-center mr-2"
                onPress={handleLogout}
                disabled={isLoggingOut}
              >
                <Ionicons name="log-out-outline" size={16} color="white" />
                <Text className="text-white font-semibold ml-1">
                  {isLoggingOut ? 'Déconnexion...' : 'Déconnecter'}
                </Text>
              </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-xl w-11/12">
            <Text className="text-lg font-bold mb-4">
              {editingProduct ? 'Modifier un produit' : 'Ajouter un produit'}
            </Text>

            <TextInput
              placeholder="Nom"
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
              className="border p-2 mb-3 rounded"
            />
            <TextInput
              placeholder="Description"
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
              className="border p-2 mb-3 rounded"
            />
            <TextInput
              placeholder="Stock"
              value={form.stock}
              onChangeText={(text) => setForm({ ...form, stock: text })}
              keyboardType="numeric"
              className="border p-2 mb-3 rounded"
            />
            <Picker
              selectedValue={form.type}
              onValueChange={(itemValue) => setForm({ ...form, type: itemValue })}
              style={{ marginBottom: 10 }}
            >
              <Picker.Item label="-- Sélectionnez un type --" value="" />
              {PRODUCT_TYPES.map((type, i) => (
                <Picker.Item key={i} label={type} value={type} />
              ))}
            </Picker>

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
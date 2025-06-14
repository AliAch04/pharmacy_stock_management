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
import { Client, Databases, ID, Storage } from 'appwrite';
import { Picker } from '@react-native-picker/picker';

const client = new Client();
client.setEndpoint('https://[YOUR_APPWRITE_ENDPOINT]').setProject('[YOUR_PROJECT_ID]');

const databases = new Databases(client);
const storage = new Storage(client);

const TRANSACTIONS_COLLECTION_ID = 'transactions';




 


const PRODUCT_TYPES = ['Médicament', 'Équipement', 'Supplément', 'Autre'];

export default function InventoryDashboard() {
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [form, setForm] = useState({ name: '', description: '', stock: '', type: '', image: null });
  const [expandedMenu, setExpandedMenu] = useState(false);
  const [reduceStockModal, setReduceStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantityToReduce, setQuantityToReduce] = useState('');

  const logTransaction = async (productId, productName, type, quantity, oldStock, newStock) => {
    try {
      await databases.createDocument(DATABASE_ID, TRANSACTIONS_COLLECTION_ID, ID.unique(), {
        productId,
        productName,
        type, // 'add', 'reduce', 'edit'
        quantity,
        oldStock,
        newStock,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la transaction:', error);
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


  const getStockStatus = (stock) => {
    const s = parseInt(stock);
    if (isNaN(s)) return 'Indéterminé';
    if (s <= 5) return 'Stock Faible';
    if (s <= 20) return 'Stock Moyen';
    return 'En Stock';
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
      throw new Error("Échec de l'upload d'image");
    }
  };

  const getImageUrl = (id) =>
    `https://cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files/${id}/view?project=68424153002403801f6b`;

  const handleSave = async () => {
    try {

      const newStock = parseInt(form.stock);
      if (isNaN(newStock)) throw new Error('Tous les champs sont requis');
      const status = getStockStatus(newStock);
      let payload;

      if (editingProduct) {
        const oldStock = editingProduct.stock;
        payload = {
          stock: newStock,
          status,
        };
        
        await databases.updateDocument(DATABASE_ID, COLLECTION_ID, editingProduct.$id, payload);
        
        // Log the transaction
        await logTransaction(
          editingProduct.$id,
          editingProduct.name,
          'edit',
          Math.abs(newStock - oldStock),
          oldStock,
          newStock
        );
      } else {
        if (!form.name || !form.description || !form.type || isNaN(newStock)) {
          throw new Error('Tous les champs sont requis');
        }

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
        
        // Log the transaction
        await logTransaction(
          response.$id,
          form.name,
          'add',
          newStock,
          0,
          newStock
        );

      }

      fetchProducts();
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  const handleReduceStock = async () => {
    try {
      if (!selectedProduct || !quantityToReduce) {
        throw new Error('Veuillez sélectionner un produit et entrer une quantité');
      }

      const product = products.find(p => p.$id === selectedProduct);
      if (!product) {
        throw new Error('Produit non trouvé');
      }

      const currentStock = parseInt(product.stock);
      const reduceBy = parseInt(quantityToReduce);

      if (isNaN(reduceBy) || reduceBy <= 0) {
        throw new Error('La quantité doit être un nombre positif');
      }

      if (reduceBy > currentStock) {
        throw new Error('La quantité à réduire ne peut pas être supérieure au stock actuel');
      }

      const newStock = currentStock - reduceBy;
      const status = getStockStatus(newStock);

      await databases.updateDocument(DATABASE_ID, COLLECTION_ID, selectedProduct, {
        stock: newStock,
        status,
      });

      // Log the transaction
      await logTransaction(
        selectedProduct,
        product.name,
        'reduce',
        reduceBy,
        currentStock,
        newStock
      );

      fetchProducts();
      setReduceStockModal(false);
      setSelectedProduct('');
      setQuantityToReduce('');

      if (Platform.OS === 'android') {
        ToastAndroid.show('Stock mis à jour avec succès', ToastAndroid.SHORT);
      } else {
        Alert.alert('Succès', 'Stock mis à jour avec succès');
      }
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-blue-50">
      <StatusBar style="dark" />
      <View className="flex-row justify-between items-center p-4 bg-white shadow">
        <Text className="text-xl font-bold">Inventory Dashboard</Text>

        <View className="relative">
          <TouchableOpacity 
            className="bg-blue-500 px-4 py-2 rounded-md flex-row items-center" 
            onPress={() => setExpandedMenu(!expandedMenu)}
          >
            <Text className="text-white font-semibold mr-2">Actions</Text>
            <Ionicons 
              name={expandedMenu ? "chevron-up" : "chevron-down"} 
              size={16} 
              color="white" 
            />
          </TouchableOpacity>
          
          {expandedMenu && (
            <View className="absolute top-12 right-0 bg-white border border-gray-200 rounded-lg shadow-lg w-48 z-10">
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

            </View>
          )}
        </View>
      </View>


      <View className="p-4">
        <ScrollView>
          {products.map((item, index) => (
            <View
              key={index}
              className={`mb-4 p-4 rounded-lg shadow-sm ${item.status === 'Stock Faible' ? 'bg-red-100' : 'bg-white'}`}
            >
              <View className="flex-row items-center mb-2">
                {item.imageId ? (
                  <Image
                    source={{ uri: getImageUrl(item.imageId) }}
                    style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }}
                  />
                ) : (
                  <View className="bg-gray-200 w-12 h-12 rounded-lg justify-center items-center mr-4">
                    <Ionicons name="image-outline" size={24} color="#888" />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="font-bold text-base">{item.name}</Text>
                  <Text className="text-gray-600 text-sm">{item.description}</Text>
                  <Text className="text-gray-500 text-sm italic">Type: {item.type}</Text>
                </View>
              </View>

              <View className="flex-row justify-between items-center mt-2">
                <Text className="text-gray-800 font-medium">{item.stock} unités</Text>
                <View
                  className={`px-3 py-1 rounded-full ${item.status === 'Stock Faible' ? 'bg-yellow-100 border border-yellow-500' : 'bg-blue-100'}`}
                >
                  <Text className={`text-xs ${item.status === 'Stock Faible' ? 'text-yellow-700' : 'text-blue-700'}`}>{item.status}</Text>
                </View>
                <View className="flex-row space-x-2">
                  <TouchableOpacity onPress={() => openModal(item)}>
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
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-xl w-11/12">
            <Text className="text-lg font-bold mb-4">
              {editingProduct ? 'Modifier un produit' : 'Ajouter un produit'}
            </Text>


            {!editingProduct && (
              <>
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
              </>
            )}


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

      {/* Reduce Stock Modal */}
      <Modal visible={reduceStockModal} animationType="slide" transparent={true}>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-xl w-11/12">
            <Text className="text-lg font-bold mb-4">Réduire le stock</Text>

            <Text className="text-sm text-gray-600 mb-2">Sélectionnez un produit:</Text>
            <View className="border rounded mb-3">
              <Picker
                selectedValue={selectedProduct}
                onValueChange={(itemValue) => setSelectedProduct(itemValue)}
              >
                <Picker.Item label="-- Sélectionnez un produit --" value="" />
                {products.map((product) => (
                  <Picker.Item 
                    key={product.$id} 
                    label={`${product.name} (Stock: ${product.stock})`} 
                    value={product.$id} 
                  />
                ))}
              </Picker>
            </View>

            <TextInput
              placeholder="Quantité à réduire"
              value={quantityToReduce}
              onChangeText={(text) => setQuantityToReduce(text)}
              keyboardType="numeric"
              className="border p-2 mb-3 rounded"
            />

            {selectedProduct && (
              <View className="bg-gray-50 p-3 rounded mb-3">
                <Text className="text-sm text-gray-600">
                  Stock actuel: {products.find(p => p.$id === selectedProduct)?.stock || 0} unités
                </Text>
                {quantityToReduce && !isNaN(parseInt(quantityToReduce)) && (
                  <Text className="text-sm text-blue-600">
                    Nouveau stock: {(products.find(p => p.$id === selectedProduct)?.stock || 0) - parseInt(quantityToReduce)} unités
                  </Text>
                )}
              </View>
            )}

            <View className="flex-row justify-between mt-4">
              <Button 
                title="Annuler" 
                onPress={() => {
                  setReduceStockModal(false);
                  setSelectedProduct('');
                  setQuantityToReduce('');
                }} 
              />
              <Button title="Confirmer" onPress={handleReduceStock} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
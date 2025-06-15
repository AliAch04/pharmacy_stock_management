import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Button,
  Platform,
  ToastAndroid,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { account, databases, DATABASE_ID, COLLECTION_ID, BUCKET_ID } from '@/services/appwrite';
import { getFilePreview } from '../../services/medicines';
import { ID, Query } from 'appwrite';
import { Picker } from '@react-native-picker/picker';

interface Medicine {
  $id: string;
  name: string;
  description: string;
  price: number | null;
  quantity: number | null;
  imageId?: string;
  category: string;
  status?: string;
}

interface FormState {
  name: string;
  description: string;
  price: string;
  quantity: string;
  category: string;
  image?: any;
}

export default function InventoryDashboard() {
  const router = useRouter();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Medicine | null>(null);

  // Form state
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    price: '',
    quantity: '',
    category: '',
  });

  // Filter states
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [priceFilter, setPriceFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [quantityFilter, setQuantityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      
      const queries = [
        Query.limit(limit),
        sortOrder === 'ASC' ? Query.orderAsc(sortField) : Query.orderDesc(sortField)
      ];

      if (priceFilter === 'low') {
        queries.push(Query.lessThanEqual('price', 10));
      } else if (priceFilter === 'medium') {
        queries.push(Query.between('price', 10, 50));
      } else if (priceFilter === 'high') {
        queries.push(Query.greaterThanEqual('price', 50));
      }

      if (quantityFilter === 'low') {
        queries.push(Query.lessThanEqual('quantity', 5));
      } else if (quantityFilter === 'medium') {
        queries.push(Query.between('quantity', 5, 20));
      } else if (quantityFilter === 'high') {
        queries.push(Query.greaterThanEqual('quantity', 20));
      }

      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        queries
      );

      setMedicines(response.documents as Medicine[]);
    } catch (err: any) {
      console.error('Failed to fetch medicines:', err);
      setError('Failed to load medicines. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMedicines();
  }, [limit, sortField, sortOrder, priceFilter, quantityFilter]);

  const onRefresh = () => {
    fetchMedicines();
  };

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
              await account.deleteSession('current');
              showToast('Déconnecté avec succès');
              router.replace('/(auth)/login');
            } catch (error: any) {
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

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Info', message);
    }
  };

  const openEditModal = (product: Medicine) => {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '0',
      quantity: product.quantity?.toString() || '0',
      category: product.category || '',
    });
    setModalVisible(true);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setForm({
      name: '',
      description: '',
      price: '',
      quantity: '',
      category: '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const price = parseFloat(form.price);
      const quantity = parseInt(form.quantity);
      
      if (!form.name.trim() || !form.description.trim() || isNaN(price) || isNaN(quantity)) {
        throw new Error('Tous les champs sont requis et doivent être valides');
      }

      if (price < 0 || quantity < 0) {
        throw new Error('Le prix et la quantité doivent être positifs');
      }

      const status = getStockStatus(quantity);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        quantity,
        category: form.category.trim(),
        status,
      };

      if (editingProduct) {
        // Update existing product
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTION_ID,
          editingProduct.$id,
          payload
        );
        showToast('Médicament mis à jour');
      } else {
        // Create new product
        await databases.createDocument(
          DATABASE_ID,
          COLLECTION_ID,
          ID.unique(),
          payload
        );
        showToast('Médicament ajouté');
      }

      fetchMedicines();
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const getStockStatus = (quantity: number | null): string => {
    if (quantity === null || quantity === undefined) return 'Quantité inconnue';
    if (quantity <= 5) return 'Stock Faible';
    if (quantity <= 20) return 'Stock Moyen';
    return 'En Stock';
  };

  const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) return 'Prix non défini';
    return `$${price.toFixed(2)}`;
  };

  const formatQuantity = (quantity: number | null): string => {
    if (quantity === null || quantity === undefined) return 'Quantité inconnue';
    return `${quantity} en stock`;
  };

  const getQuantityColor = (quantity: number | null): string => {
    if (quantity === null || quantity === undefined) return 'text-gray-500';
    if (quantity <= 5) return 'text-red-500';
    if (quantity <= 20) return 'text-yellow-500';
    return 'text-green-500';
  };

  const renderMedicineItem = ({ item }: { item: Medicine }) => (
    <TouchableOpacity 
      className="bg-white p-4 rounded-lg shadow-sm mb-3 mx-2"
      onPress={() => openEditModal(item)}
    >
      <View className="flex-row">
        {item.imageId && (
          <Image 
            source={{ uri: getFilePreview(item.imageId) }} 
            className="w-20 h-20 rounded-lg mr-3"
            resizeMode="cover"
          />
        )}
        <View className="flex-1">
          <Text className="font-bold text-lg">{item.name || 'Nom non défini'}</Text>
          <Text className="text-gray-500 text-sm mb-1">
            {item.description && item.description.length > 15 
              ? `${item.description.substring(0, 15)}...` 
              : item.description || 'Aucune description'}
          </Text>
          <View className="flex-row justify-between items-center">
            <Text className="text-blue-600 font-bold">{formatPrice(item.price)}</Text>
            <Text className={`font-semibold ${getQuantityColor(item.quantity)}`}>
              {formatQuantity(item.quantity)}
            </Text>
          </View>
          <Text className="text-xs text-gray-400 mt-1">
            {getStockStatus(item.quantity)}
          </Text>
          {item.category && (
            <Text className="text-xs text-blue-400 mt-1">
              Catégorie: {item.category}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 bg-white shadow">
        <Text className="text-xl font-bold">Inventaire des Médicaments</Text>
        
        <View className="flex-row space-x-2">
          <TouchableOpacity 
            className="p-2 bg-blue-100 rounded-full"
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="filter" size={20} color="#3B82F6" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="p-2 bg-green-100 rounded-full"
            onPress={openAddModal}
          >
            <Ionicons name="add" size={20} color="#10B981" />
          </TouchableOpacity>

          <TouchableOpacity 
            className="p-2 bg-red-100 rounded-full"
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            <Ionicons 
              name={isLoggingOut ? "hourglass" : "log-out"} 
              size={20} 
              color="#EF4444" 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <View className="bg-white p-4 mx-2 rounded-lg shadow-sm mb-2">
          <Text className="font-bold mb-2">Filtres</Text>
          
          <View className="mb-3">
            <Text className="text-sm text-gray-500 mb-1">Nombre à afficher</Text>
            <Picker
              selectedValue={limit}
              onValueChange={(itemValue) => setLimit(itemValue)}
              style={{ backgroundColor: '#f3f4f6' }}
            >
              <Picker.Item label="3 médicaments" value={3} />
              <Picker.Item label="5 médicaments" value={5} />
              <Picker.Item label="10 médicaments" value={10} />
              <Picker.Item label="20 médicaments" value={20} />
              <Picker.Item label="50 médicaments" value={50} />
            </Picker>
          </View>
          
          <View className="mb-3">
            <Text className="text-sm text-gray-500 mb-1">Trier par</Text>
            <Picker
              selectedValue={sortField}
              onValueChange={(itemValue) => setSortField(itemValue)}
              style={{ backgroundColor: '#f3f4f6' }}
            >
              <Picker.Item label="Nom" value="name" />
              <Picker.Item label="Prix" value="price" />
              <Picker.Item label="Quantité" value="quantity" />
            </Picker>
            <View className="flex-row mt-2">
              <TouchableOpacity
                className={`px-3 py-1 rounded-l-lg ${sortOrder === 'ASC' ? 'bg-blue-500' : 'bg-gray-200'}`}
                onPress={() => setSortOrder('ASC')}
              >
                <Text className={sortOrder === 'ASC' ? 'text-white' : 'text-gray-700'}>Croissant</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-1 rounded-r-lg ${sortOrder === 'DESC' ? 'bg-blue-500' : 'bg-gray-200'}`}
                onPress={() => setSortOrder('DESC')}
              >
                <Text className={sortOrder === 'DESC' ? 'text-white' : 'text-gray-700'}>Décroissant</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View className="mb-3">
            <Text className="text-sm text-gray-500 mb-1">Filtrer par prix</Text>
            <View className="flex-row flex-wrap">
              {['all', 'low', 'medium', 'high'].map((filter) => (
                <TouchableOpacity
                  key={filter}
                  className={`px-3 py-1 mr-2 mb-2 rounded-full ${
                    priceFilter === filter ? 'bg-blue-500' : 'bg-gray-200'
                  }`}
                  onPress={() => setPriceFilter(filter as any)}
                >
                  <Text className={priceFilter === filter ? 'text-white' : 'text-gray-700'}>
                    {filter === 'all' ? 'Tous' : 
                     filter === 'low' ? '< $10' : 
                     filter === 'medium' ? '$10-$50' : '> $50'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View className="mb-3">
            <Text className="text-sm text-gray-500 mb-1">Filtrer par quantité</Text>
            <View className="flex-row flex-wrap">
              {['all', 'low', 'medium', 'high'].map((filter) => (
                <TouchableOpacity
                  key={filter}
                  className={`px-3 py-1 mr-2 mb-2 rounded-full ${
                    quantityFilter === filter ? 'bg-blue-500' : 'bg-gray-200'
                  }`}
                  onPress={() => setQuantityFilter(filter as any)}
                >
                  <Text className={quantityFilter === filter ? 'text-white' : 'text-gray-700'}>
                    {filter === 'all' ? 'Tous' : 
                     filter === 'low' ? 'Faible (<5)' : 
                     filter === 'medium' ? 'Moyen (5-20)' : 'Élevé (>20)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Content */}
      {loading && !refreshing ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-2 text-gray-500">Chargement des médicaments...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-4">
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text className="text-red-500 text-center mt-2">{error}</Text>
          <TouchableOpacity 
            className="mt-4 bg-blue-500 px-6 py-3 rounded-lg"
            onPress={fetchMedicines}
          >
            <Text className="text-white font-semibold">Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={medicines}
          renderItem={renderMedicineItem}
          keyExtractor={(item) => item.$id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3B82F6']}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center mt-10">
              <Ionicons name="medical" size={48} color="#9CA3AF" />
              <Text className="text-gray-500 mt-2 text-lg">Aucun médicament trouvé</Text>
              <Text className="text-gray-400 mt-1 text-center px-4">
                Ajoutez des médicaments à votre inventaire ou modifiez vos filtres
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Add/Edit Product Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-xl w-11/12 max-h-4/5">
            <Text className="text-lg font-bold mb-4">
              {editingProduct ? 'Modifier un médicament' : 'Ajouter un médicament'}
            </Text>

            <TextInput
              placeholder="Nom du médicament *"
              value={form.name}
              onChangeText={(text) => setForm({...form, name: text})}
              className="border border-gray-300 p-3 mb-3 rounded-lg"
            />
            <TextInput
              placeholder="Description *"
              value={form.description}
              onChangeText={(text) => setForm({...form, description: text})}
              className="border border-gray-300 p-3 mb-3 rounded-lg"
              multiline
              numberOfLines={3}
            />
            <TextInput
              placeholder="Prix ($) *"
              value={form.price}
              onChangeText={(text) => setForm({...form, price: text})}
              keyboardType="decimal-pad"
              className="border border-gray-300 p-3 mb-3 rounded-lg"
            />
            <TextInput
              placeholder="Quantité *"
              value={form.quantity}
              onChangeText={(text) => setForm({...form, quantity: text})}
              keyboardType="numeric"
              className="border border-gray-300 p-3 mb-3 rounded-lg"
            />
            <TextInput
              placeholder="Catégorie"
              value={form.category}
              onChangeText={(text) => setForm({...form, category: text})}
              className="border border-gray-300 p-3 mb-4 rounded-lg"
            />

            <View className="flex-row justify-between mt-4">
              <TouchableOpacity
                className="bg-gray-200 px-6 py-3 rounded-lg flex-1 mr-2"
                onPress={() => setModalVisible(false)}
              >
                <Text className="text-center font-semibold">Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-blue-500 px-6 py-3 rounded-lg flex-1 ml-2"
                onPress={handleSave}
              >
                <Text className="text-white text-center font-semibold">Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
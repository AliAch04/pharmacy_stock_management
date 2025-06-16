import React, { useEffect, useState, useRef } from 'react';
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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { account, databases, DATABASE_ID, COLLECTION_ID, BUCKET_ID } from '@/services/appwrite';
import { getFilePreview } from '../../services/medicines';
import { ID, Query } from 'appwrite';
import { Picker } from '@react-native-picker/picker';

// Add this to your constants file
const LOGS_COLLECTION_ID = 'logs'; // Replace with your actual logs collection ID

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

interface StockLogForm {
  medicineId: string;
  medicineName: string;
  quantitySold: string;
  notes: string;
}

export default function InventoryDashboard() {
  const router = useRouter();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [stockLogModalVisible, setStockLogModalVisible] = useState(false);
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

  // Stock log form state
  const [stockLogForm, setStockLogForm] = useState<StockLogForm>({
    medicineId: '',
    medicineName: '',
    quantitySold: '',
    notes: '',
  });

  // Filter states
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [priceFilter, setPriceFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [quantityFilter, setQuantityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      if (showDropdown) {
        setShowDropdown(false);
      }
    };
    
    if (showDropdown) {
      // Add a small delay to prevent immediate closing
      const timer = setTimeout(() => {
        // This would normally be handled by a touch outside detector
        // For React Native, you'd use a TouchableWithoutFeedback wrapper
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showDropdown]);

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

  const openStockLogModal = () => {
    setStockLogForm({
      medicineId: '',
      medicineName: '',
      quantitySold: '',
      notes: '',
    });
    setStockLogModalVisible(true);
    setShowDropdown(false);
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

 const handleStockLog = async () => {
  try {
    const quantitySold = parseInt(stockLogForm.quantitySold);
    
    if (!stockLogForm.medicineId || !stockLogForm.medicineName || isNaN(quantitySold)) {
      throw new Error('Veuillez sélectionner un médicament et entrer une quantité valide');
    }

    if (quantitySold <= 0) {
      throw new Error('La quantité vendue doit être positive');
    }

    const selectedMedicine = medicines.find(med => med.$id === stockLogForm.medicineId);
    if (!selectedMedicine) {
      throw new Error('Médicament non trouvé');
    }

    if (selectedMedicine.quantity === null || selectedMedicine.quantity < quantitySold) {
      throw new Error('Stock insuffisant pour cette vente');
    }

    const previousQuantity = selectedMedicine.quantity;
    const newQuantity = previousQuantity - quantitySold;

    // Update medicine quantity
    await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_ID,
      stockLogForm.medicineId,
      {
        quantity: newQuantity,
        status: getStockStatus(newQuantity)
      }
    );

    // Différents formats de timestamp à essayer selon votre configuration Appwrite
    const now = new Date();
    
    // Format 1: ISO String (recommandé)
    const timestampISO = now.toISOString();
    
    // Format 2: Unix timestamp en secondes
    const timestampUnix = Math.floor(now.getTime() / 1000);
    
    // Format 3: Format français lisible
    const timestampFR = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR');
    
    // Format 4: Format personnalisé
    const timestampCustom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // Utilisez le format qui fonctionne avec votre base de données
    const logData = {
      medicineId: stockLogForm.medicineId,
      medicineName: stockLogForm.medicineName,
      transactionType: 'sale',
      quantityChanged: -quantitySold,
      previousQuantity: previousQuantity,
      newQuantity: newQuantity,
      timestamp: timestampISO, // Changez ici selon le format requis
      // Alternatives à essayer :
      // timestamp: timestampFR,
      // timestamp: timestampCustom,
      // timestamp: timestampUnix,
      notes: stockLogForm.notes.trim() || `Vente de ${quantitySold} unité(s)`
    };

    await databases.createDocument(
      DATABASE_ID,
      LOGS_COLLECTION_ID,
      ID.unique(),
      logData
    );

    showToast(`Vente enregistrée: ${quantitySold} unité(s) de ${stockLogForm.medicineName}`);
    setStockLogModalVisible(false);
    fetchMedicines();
  } catch (error: any) {
    console.error('Erreur complète:', error);
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

  // Get low stock medicines for notifications
  const getLowStockMedicines = () => {
    return medicines.filter(medicine => 
      medicine.quantity !== null && 
      medicine.quantity !== undefined && 
      medicine.quantity <= 5
    );
  };

  const getNotificationCount = () => {
    return getLowStockMedicines().length;
  };

  const handleNotificationPress = () => {
    setShowNotifications(true);
  };

  const renderMedicineItem = ({ item }: { item: Medicine }) => (
    <TouchableOpacity 
      className="bg-white p-4 rounded-xl shadow-sm mb-4 mx-4 border border-gray-100"
      onPress={() => openEditModal(item)}
      style={{ elevation: 2 }}
    >
      <View className="flex-row">
        {item.imageId && (
          <Image 
            source={{ uri: getFilePreview(item.imageId) }} 
            className="w-20 h-20 rounded-xl mr-4 bg-gray-100"
            resizeMode="cover"
          />
        )}
        <View className="flex-1">
          <Text className="font-bold text-lg text-gray-800 mb-1">{item.name || 'Nom non défini'}</Text>
          <Text className="text-gray-500 text-sm mb-2 leading-5">
            {item.description && item.description.length > 50 
              ? `${item.description.substring(0, 50)}...` 
              : item.description || 'Aucune description'}
          </Text>
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-blue-600 font-bold text-lg">{formatPrice(item.price)}</Text>
            <Text className={`font-semibold ${getQuantityColor(item.quantity)}`}>
              {formatQuantity(item.quantity)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center">
            <View className={`px-3 py-1 rounded-full ${
              item.quantity !== null && item.quantity <= 5 ? 'bg-red-100' :
              item.quantity !== null && item.quantity <= 20 ? 'bg-yellow-100' : 'bg-green-100'
            }`}>
              <Text className={`text-xs font-medium ${
                item.quantity !== null && item.quantity <= 5 ? 'text-red-700' :
                item.quantity !== null && item.quantity <= 20 ? 'text-yellow-700' : 'text-green-700'
              }`}>
                {getStockStatus(item.quantity)}
              </Text>
            </View>
            {item.category && (
              <Text className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-full">
                {item.category}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" style={{ position: 'relative' }}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 bg-white shadow-sm border-b border-gray-100" style={{ zIndex: 1000 }}>         
        <Text className="text-xl font-bold text-gray-800">Inventaire des Médicaments</Text>
        
        <View className="flex-row items-center">
  {/* Notification Bell */}
  <TouchableOpacity 
    className="relative p-3 bg-yellow-50 rounded-full border border-yellow-200 mr-3"
    onPress={handleNotificationPress}
  >
    <Ionicons name="notifications" size={20} color="#F59E0B" />
    {getNotificationCount() > 0 && (
      <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 justify-center items-center">
        <Text className="text-white text-xs font-bold">
          {getNotificationCount() > 9 ? '9+' : getNotificationCount()}
        </Text>
      </View>
    )}
  </TouchableOpacity>

  {/* Dropdown Menu */}
  <View className="relative" style={{ zIndex: 9999 }}>
    <TouchableOpacity 
      className="p-3 bg-gray-50 rounded-full border border-gray-200"
      onPress={() => setShowDropdown(!showDropdown)}
    >
      <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
    </TouchableOpacity>
  </View>
</View>

{/* Dropdown content déplacé à l'extérieur et avec un z-index plus élevé */}
{showDropdown && (
  <>
    {/* Overlay to close dropdown */}
    <TouchableOpacity 
      className="absolute inset-0 w-full h-full"
      onPress={() => setShowDropdown(false)}
      activeOpacity={1}
      style={{ zIndex: 9998, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
    
    {/* Dropdown content avec position absolue par rapport à l'écran */}
    <View 
      className="absolute bg-white rounded-xl shadow-lg border border-gray-200 w-56"
      style={{ 
        zIndex: 9999, 
        elevation: 20,
        position: 'absolute',
        top: 70, // Ajustez selon la hauteur de votre header
        right: 16, // Marge depuis le bord droit
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      }}
    >
      <TouchableOpacity 
        className="flex-row items-center p-4 border-b border-gray-100"
        onPress={() => {
          setShowFilters(!showFilters);
          setShowDropdown(false);
        }}
      >
        <View className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center mr-3">
          <Ionicons name="filter" size={16} color="#3B82F6" />
        </View>
        <Text className="text-gray-700 font-medium">Filtres</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        className="flex-row items-center p-4 border-b border-gray-100"
        onPress={() => {
          openAddModal();
          setShowDropdown(false);
        }}
      >
        <View className="w-8 h-8 bg-green-50 rounded-full items-center justify-center mr-3">
          <Ionicons name="add" size={16} color="#10B981" />
        </View>
        <Text className="text-gray-700 font-medium">Ajouter médicament</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="flex-row items-center p-4 border-b border-gray-100"
        onPress={openStockLogModal}
      >
        <View className="w-8 h-8 bg-orange-50 rounded-full items-center justify-center mr-3">
          <Ionicons name="receipt" size={16} color="#F97316" />
        </View>
        <Text className="text-gray-700 font-medium">Enregistrer une vente</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        className="flex-row items-center p-4"
        onPress={() => {
          handleLogout();
          setShowDropdown(false);
        }}
        disabled={isLoggingOut}
      >
        <View className="w-8 h-8 bg-red-50 rounded-full items-center justify-center mr-3">
          <Ionicons 
            name={isLoggingOut ? "hourglass" : "log-out"} 
            size={16} 
            color="#EF4444" 
          />
        </View>
        <Text className="text-gray-700 font-medium">
          {isLoggingOut ? 'Déconnexion...' : 'Déconnexion'}
        </Text>
      </TouchableOpacity>
    </View>
  </>
)}
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <View className="bg-white p-4 mx-4 rounded-xl shadow-sm mb-4 border border-gray-100 mt-2">
          <Text className="font-bold mb-4 text-gray-800 text-lg">Filtres</Text>
          
          <View className="mb-4">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Nombre à afficher</Text>
            <View className="bg-gray-50 rounded-lg border border-gray-200">
              <Picker
                selectedValue={limit}
                onValueChange={(itemValue) => setLimit(itemValue)}
                style={{ backgroundColor: 'transparent' }}
              >
                <Picker.Item label="3 médicaments" value={3} />
                <Picker.Item label="5 médicaments" value={5} />
                <Picker.Item label="10 médicaments" value={10} />
                <Picker.Item label="20 médicaments" value={20} />
                <Picker.Item label="50 médicaments" value={50} />
              </Picker>
            </View>
          </View>
          
          <View className="mb-4">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Trier par</Text>
            <View className="bg-gray-50 rounded-lg border border-gray-200">
              <Picker
                selectedValue={sortField}
                onValueChange={(itemValue) => setSortField(itemValue)}
                style={{ backgroundColor: 'transparent' }}
              >
                <Picker.Item label="Nom" value="name" />
                <Picker.Item label="Prix" value="price" />
                <Picker.Item label="Quantité" value="quantity" />
              </Picker>
            </View>
            <View className="flex-row mt-3">
              <TouchableOpacity
                className={`px-4 py-2 rounded-l-lg border ${sortOrder === 'ASC' ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}
                onPress={() => setSortOrder('ASC')}
              >
                <Text className={`font-medium ${sortOrder === 'ASC' ? 'text-white' : 'text-gray-700'}`}>Croissant</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-4 py-2 rounded-r-lg border-l-0 border ${sortOrder === 'DESC' ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}
                onPress={() => setSortOrder('DESC')}
              >
                <Text className={`font-medium ${sortOrder === 'DESC' ? 'text-white' : 'text-gray-700'}`}>Décroissant</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View className="mb-4">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Filtrer par prix</Text>
            <View className="flex-row flex-wrap">
              {[
                { key: 'all', label: 'Tous' },
                { key: 'low', label: '< $10' },
                { key: 'medium', label: '$10-$50' },
                { key: 'high', label: '> $50' }
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  className={`px-4 py-2 mr-2 mb-2 rounded-full border ${
                    priceFilter === filter.key ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setPriceFilter(filter.key as any)}
                >
                  <Text className={`font-medium ${priceFilter === filter.key ? 'text-white' : 'text-gray-700'}`}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View className="mb-2">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Filtrer par quantité</Text>
            <View className="flex-row flex-wrap">
              {[
                { key: 'all', label: 'Tous' },
                { key: 'low', label: 'Faible (<5)' },
                { key: 'medium', label: 'Moyen (5-20)' },
                { key: 'high', label: 'Élevé (>20)' }
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  className={`px-4 py-2 mr-2 mb-2 rounded-full border ${
                    quantityFilter === filter.key ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setQuantityFilter(filter.key as any)}
                >
                  <Text className={`font-medium ${quantityFilter === filter.key ? 'text-white' : 'text-gray-700'}`}>
                    {filter.label}
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
          <Text className="mt-4 text-gray-500 font-medium">Chargement des médicaments...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-4">
          <View className="bg-red-50 p-6 rounded-xl items-center">
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
            <Text className="text-red-500 text-center mt-4 font-medium">{error}</Text>
            <TouchableOpacity 
              className="mt-4 bg-red-500 px-6 py-3 rounded-lg"
              onPress={fetchMedicines}
            >
              <Text className="text-white font-semibold">Réessayer</Text>
            </TouchableOpacity>
          </View>
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
            <View className="flex-1 justify-center items-center mt-20">
              <View className="bg-white p-8 rounded-xl items-center mx-4 shadow-sm border border-gray-100">
                <Ionicons name="medical" size={48} color="#9CA3AF" />
                <Text className="text-gray-500 mt-4 text-lg font-medium">Aucun médicament trouvé</Text>
                <Text className="text-gray-400 mt-2 text-center px-4 leading-6">
                  Ajoutez des médicaments à votre inventaire ou modifiez vos filtres
                </Text>
              </View>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add/Edit Product Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-xl w-11/12 max-h-4/5 shadow-xl">
            <Text className="text-xl font-bold mb-6 text-gray-800">
              {editingProduct ? 'Modifier un médicament' : 'Ajouter un médicament'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                placeholder="Nom du médicament *"
                value={form.name}
                onChangeText={(text) => setForm({...form, name: text})}
                className="border border-gray-300 p-4 mb-4 rounded-lg bg-gray-50 font-medium"
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                placeholder="Description *"
                value={form.description}
                onChangeText={(text) => setForm({...form, description: text})}
                className="border border-gray-300 p-4 mb-4 rounded-lg bg-gray-50 font-medium"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                placeholder="Prix ($) *"
                value={form.price}
                onChangeText={(text) => setForm({...form, price: text})}
                keyboardType="decimal-pad"
                className="border border-gray-300 p-4 mb-4 rounded-lg bg-gray-50 font-medium"
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                placeholder="Quantité *"
                value={form.quantity}
                onChangeText={(text) => setForm({...form, quantity: text})}
                keyboardType="numeric"
                className="border border-gray-300 p-4 mb-4 rounded-lg bg-gray-50 font-medium"
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                placeholder="Catégorie"
                value={form.category}
                onChangeText={(text) => setForm({...form, category: text})}
                className="border border-gray-300 p-4 mb-6 rounded-lg bg-gray-50 font-medium"
                placeholderTextColor="#9CA3AF"
              />
            </ScrollView>

            <View className="flex-row justify-between mt-4">
              <TouchableOpacity
                className="bg-gray-100 px-6 py-4 rounded-lg flex-1 mr-3 border border-gray-200"
                onPress={() => setModalVisible(false)}
              >
                <Text className="text-center font-semibold text-gray-700">Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-blue-500 px-6 py-4 rounded-lg flex-1 ml-3 shadow-sm"
                onPress={handleSave}
              >
                <Text className="text-white text-center font-semibold">Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stock Log Modal */}
      <Modal visible={stockLogModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-xl w-11/12 max-h-4/5 shadow-xl">
            <View className="flex-row items-center mb-6">
              <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="receipt" size={20} color="#F97316" />
              </View>
              <Text className="text-xl font-bold text-gray-800">Enregistrer une vente</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="mb-4">
                <Text className="text-sm text-gray-600 mb-2 font-medium">Sélectionner un médicament *</Text>
                <View className="border border-gray-300 rounded-lg bg-gray-50">
                  <Picker
                    selectedValue={stockLogForm.medicineId}
                    onValueChange={(itemValue, itemIndex) => {
                      const selectedMed = medicines.find(med => med.$id === itemValue);
                      setStockLogForm({
                        ...stockLogForm,
                        medicineId: itemValue,
                        medicineName: selectedMed?.name || ''
                      });
                    }}
                    style={{ backgroundColor: 'transparent' }}
                  >
                    <Picker.Item label="-- Sélectionner un médicament --" value="" />
                    {medicines.map((medicine) => (
                      <Picker.Item 
                        key={medicine.$id} 
                        label={`${medicine.name} (Stock: ${medicine.quantity || 0})`} 
                        value={medicine.$id} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <TextInput
                placeholder="Quantité vendue *"
                value={stockLogForm.quantitySold}
                onChangeText={(text) => setStockLogForm({...stockLogForm, quantitySold: text})}
                keyboardType="numeric"
                className="border border-gray-300 p-4 mb-4 rounded-lg bg-gray-50 font-medium"
                placeholderTextColor="#9CA3AF"
              />

              <TextInput
                placeholder="Notes (optionnel)"
                value={stockLogForm.notes}
                onChangeText={(text) => setStockLogForm({...stockLogForm, notes: text})}
                className="border border-gray-300 p-4 mb-6 rounded-lg bg-gray-50 font-medium"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor="#9CA3AF"
              />

              {stockLogForm.medicineId && (
                <View className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-200">
                  <Text className="text-blue-700 font-medium mb-1">Informations du médicament:</Text>
                  <Text className="text-blue-600 text-sm">
                    Nom: {stockLogForm.medicineName}
                  </Text>
                  <Text className="text-blue-600 text-sm">
                    Stock actuel: {medicines.find(med => med.$id === stockLogForm.medicineId)?.quantity || 0} unités
                  </Text>
                  {stockLogForm.quantitySold && !isNaN(parseInt(stockLogForm.quantitySold)) && (
                    <Text className="text-blue-600 text-sm">
                      Stock après vente: {(medicines.find(med => med.$id === stockLogForm.medicineId)?.quantity || 0) - parseInt(stockLogForm.quantitySold)} unités
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>

            <View className="flex-row justify-between mt-4">
              <TouchableOpacity
                className="bg-gray-100 px-6 py-4 rounded-lg flex-1 mr-3 border border-gray-200"
                onPress={() => setStockLogModalVisible(false)}
              >
                <Text className="text-center font-semibold text-gray-700">Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-orange-500 px-6 py-4 rounded-lg flex-1 ml-3 shadow-sm"
                onPress={handleStockLog}
              >
                <Text className="text-white text-center font-semibold">Enregistrer la vente</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} animationType="slide" transparent>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-xl w-11/12 max-h-4/5 shadow-xl">
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-yellow-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="notifications" size={20} color="#F59E0B" />
                </View>
                <Text className="text-xl font-bold text-gray-800">Notifications de Stock</Text>
              </View>
              <TouchableOpacity 
                className="p-2 bg-gray-100 rounded-full"
                onPress={() => setShowNotifications(false)}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {getLowStockMedicines().length === 0 ? (
              <View className="items-center py-12">
                <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
                  <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                </View>
                <Text className="text-gray-800 text-lg font-medium mb-2">
                  Aucune alerte de stock !
                </Text>
                <Text className="text-gray-500 text-center leading-6">
                  Tous vos médicaments ont un stock suffisant
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {getLowStockMedicines().map((item) => (
                  <View key={item.$id} className="bg-red-50 p-4 rounded-xl mb-4 border-l-4 border-red-500">
                    <View className="flex-row items-center mb-3">
                      <View className="w-8 h-8 bg-red-100 rounded-full items-center justify-center mr-3">
                        <Ionicons name="warning" size={16} color="#EF4444" />
                      </View>
                      <Text className="font-bold text-red-700 flex-1">Stock Faible</Text>
                    </View>
                    <Text className="font-semibold text-gray-800 mb-1">{item.name}</Text>
                    <Text className="text-gray-600 text-sm mb-2">
                      Quantité restante: {item.quantity} unité(s)
                    </Text>
                    {item.category && (
                      <Text className="text-gray-500 text-xs mb-3">
                        Catégorie: {item.category}
                      </Text>
                    )}
                    <TouchableOpacity
                      className="bg-red-500 px-4 py-2 rounded-lg self-start shadow-sm"
                      onPress={() => {
                        setShowNotifications(false);
                        openEditModal(item);
                      }}
                    >
                      <Text className="text-white text-sm font-medium">Réapprovisionner</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              className="bg-blue-500 px-6 py-4 rounded-lg mt-4 shadow-sm"
              onPress={() => setShowNotifications(false)}
            >
              <Text className="text-white text-center font-semibold">Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
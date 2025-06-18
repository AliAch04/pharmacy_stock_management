import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { account, databases, DATABASE_ID, COLLECTION_ID, BUCKET_ID, storage } from '@/services/appwrite';
import { getFilePreview } from '../../services/medicines';
import { ID, Query } from 'appwrite';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useUser } from '../context/UserContext';
import { getMedicineImage } from '@/services/images';

const LOGS_COLLECTION_ID = 'logs';

interface Medicine {
  $id: string;
  name: string;
  description: string;
  price: number | null;
  quantity: number | null;
  image?: string;
  category: string;
  status?: string;
  userID: string;
}

interface FormState {
  name: string;
  description: string;
  price: string;
  quantity: string;
  category: string;
  image?: string;
}

interface StockLogForm {
  medicineId: string;
  medicineName: string;
  quantitySold: string;
  notes: string;
}

export default function InventoryDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const [userID, setUserID] = useState<string>('');
  
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [stockLogModalVisible, setStockLogModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Medicine | null>(null);

  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    price: '',
    quantity: '',
    category: '',
    image: '',
  });
  const [stockLogForm, setStockLogForm] = useState<StockLogForm>({
    medicineId: '',
    medicineName: '',
    quantitySold: '',
    notes: '',
  });
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [priceFilter, setPriceFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [quantityFilter, setQuantityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (user) {
      setUserID(user.$id);
      fetchMedicines();
    } else {
      router.replace('/login');
    }
  }, [user]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin d\'accéder à votre galerie pour sélectionner une image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  const uploadImageWithFormData = async () => {
    if (!selectedImage) return null;
    
    setUploadingImage(true);
    try {
      const fileId = ID.unique();
      const fileName = `medicine_${Date.now()}.jpg`;
      
      const formData = new FormData();
      formData.append('fileId', fileId);
      formData.append('file', {
        uri: selectedImage.uri,
        type: selectedImage.mimeType || 'image/jpeg',
        name: fileName,
      } as any);
      
      const response = await fetch(
        `https://cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files`,
        {
          method: 'POST',
          headers: {
            'X-Appwrite-Project': '68424153002403801f6b',
          },
          body: formData,
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      return result.$id;
    } catch (error) {
      console.error('Erreur upload FormData:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const fetchMedicines = async () => {
    try {
      if (!userID) return;
      
      setLoading(true);
      setRefreshing(true);
      
      const queries = [
        Query.limit(limit),
        Query.equal('userID', userID),
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
    if (userID) {
      fetchMedicines();
    }
  }, [userID, limit, sortField, sortOrder, priceFilter, quantityFilter]);

  const createLog = async (
    medicineId: string,
    medicineName: string,
    transactionType: 'sale' | 'add' | 'adjust',
    quantityChanged: number,
    previousQuantity: number,
    newQuantity: number,
    notes: string = ''
  ) => {
    try {
      await databases.createDocument(
        DATABASE_ID,
        LOGS_COLLECTION_ID,
        ID.unique(),
        {
          medicineId,
          medicineName,
          transactionType,
          quantityChanged,
          previousQuantity,
          newQuantity,
          notes,
          timestamp: new Date().toISOString(),
          userID: userID,
          medID: medicineId
        }
      );
      console.log(`Log created for ${transactionType}`);
    } catch (error) {
      console.error('Error creating log:', error);
    }
  };

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

  const openEditModal = (product: Medicine) => {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '0',
      quantity: product.quantity?.toString() || '0',
      category: product.category || '',
      image: product.image || '',
    });
    setSelectedImage(null);
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
      image: '',
    });
    setSelectedImage(null);
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

      let imageId = form.image;
      
      if (selectedImage) {
        try {
          imageId = await uploadImageWithFormData();
        } catch (uploadError) {
          console.error('Erreur upload:', uploadError);
          Alert.alert('Avertissement', 'L\'image n\'a pas pu être uploadée, mais le médicament sera sauvegardé sans image.');
          imageId = form.image;
        }
      }

      const status = getStockStatus(quantity);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        quantity,
        category: form.category.trim(),
        status,
        image: imageId || '',
        userID: userID
      };

      if (editingProduct) {
        const previousQuantity = editingProduct.quantity || 0;
        const quantityChanged = quantity - previousQuantity;
        
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTION_ID,
          editingProduct.$id,
          payload
        );
        
        if (quantity !== previousQuantity) {
          await createLog(
            editingProduct.$id,
            form.name.trim(),
            'adjust',
            quantityChanged,
            previousQuantity,
            quantity,
            `Ajustement de stock: ${quantityChanged > 0 ? '+' : ''}${quantityChanged} unité(s)`
          );
        }
      } else {
        const response = await databases.createDocument(
          DATABASE_ID,
          COLLECTION_ID,
          ID.unique(),
          payload
        );
        
        await createLog(
          response.$id,
          form.name.trim(),
          'add',
          quantity,
          0,
          quantity,
          'Ajout initial au stock'
        );
      }

      fetchMedicines();
      setModalVisible(false);
      setSelectedImage(null);
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

      await databases.updateDocument(
        DATABASE_ID,
        COLLECTION_ID,
        stockLogForm.medicineId,
        {
          quantity: newQuantity,
          status: getStockStatus(newQuantity)
        }
      );

      await createLog(
        stockLogForm.medicineId,
        stockLogForm.medicineName,
        'sale',
        -quantitySold,
        previousQuantity,
        newQuantity,
        stockLogForm.notes.trim() || `Vente de ${quantitySold} unité(s)`
      );

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

  const getImagePreview = (imageId: string | undefined) => {
    if (!imageId) return null;
    try {
      return getFilePreview(imageId);
    } catch (error) {
      console.error('Error getting image preview:', error);
      return null;
    }
  };

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
      className="bg-white p-4 rounded-xl shadow-sm mt-5 mx-4 border border-gray-100"
      onPress={() => openEditModal(item)}
      style={{ elevation: 2 }}
    >
      <View className="flex-row">
        {getMedicineImage(item.image) ? (
          <Image 
            source={getMedicineImage(item.image)}
            className="w-20 h-20 rounded-xl mr-4 bg-gray-100"
            resizeMode="cover"
            onError={(e) => console.error('Image load error:', e.nativeEvent.error)}
          />
        ) : (
          <View className="w-20 h-20 rounded-xl mr-4 bg-gray-100 items-center justify-center">
            <Ionicons name="image-outline" size={24} color="#9CA3AF" />
          </View>
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

        {/* Dropdown content */}
        {showDropdown && (
          <>
            {/* Overlay to close dropdown */}
            <TouchableOpacity 
              className="absolute inset-0 w-full h-full"
              onPress={() => setShowDropdown(false)}
              activeOpacity={1}
              style={{ zIndex: 9998, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            
            {/* Dropdown content */}
            <View 
              className="absolute bg-white rounded-xl shadow-lg border border-gray-200 w-56"
              style={{ 
                zIndex: 9999, 
                elevation: 20,
                position: 'absolute',
                top: 70,
                right: 16,
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
                  className={`px-3 py-2 mr-2 mb-2 rounded-lg border ${
                    priceFilter === filter.key 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setPriceFilter(filter.key as any)}
                >
                  <Text className={`text-sm font-medium ${
                    priceFilter === filter.key ? 'text-white' : 'text-gray-700'
                  }`}>
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
                { key: 'low', label: '< 5' },
                { key: 'medium', label: '5-20' },
                { key: 'high', label: '> 20' }
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  className={`px-3 py-2 mr-2 mb-2 rounded-lg border ${
                    quantityFilter === filter.key 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setQuantityFilter(filter.key as any)}
                >
                  <Text className={`text-sm font-medium ${
                    quantityFilter === filter.key ? 'text-white' : 'text-gray-700'
                  }`}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Notifications Panel */}
      {showNotifications && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={showNotifications}
          onRequestClose={() => setShowNotifications(false)}
        >
          <View className="flex-1 bg-white p-4">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-800">Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {getLowStockMedicines().length > 0 ? (
              <FlatList
                data={getLowStockMedicines()}
                keyExtractor={(item) => item.$id}
                renderItem={({ item }) => (
                  <View className="bg-red-50 p-4 rounded-lg mb-3 border border-red-100">
                    <Text className="font-bold text-red-700 mb-1">
                      Stock faible: {item.name}
                    </Text>
                    <Text className="text-red-600">
                      Seulement {item.quantity} unité(s) restante(s)
                    </Text>
                  </View>
                )}
              />
            ) : (
              <View className="flex-1 justify-center items-center">
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                <Text className="text-lg font-medium text-gray-600 mt-4">
                  Aucun médicament en stock faible
                </Text>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* Main Content */}
      <View className="flex-1">
        {loading && medicines.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="mt-4 text-gray-500">Chargement des médicaments...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center p-4">
            <Ionicons name="warning" size={48} color="#EF4444" />
            <Text className="text-lg text-red-500 text-center mt-4">{error}</Text>
            <TouchableOpacity
              className="mt-6 bg-blue-500 px-6 py-3 rounded-lg"
              onPress={fetchMedicines}
            >
              <Text className="text-white font-medium">Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : medicines.length === 0 ? (
          <View className="flex-1 justify-center items-center p-4">
            <Ionicons name="archive" size={48} color="#9CA3AF" />
            <Text className="text-lg text-gray-500 text-center mt-4">
              Aucun médicament trouvé. Essayez de modifier vos filtres.
            </Text>
            <TouchableOpacity
              className="mt-6 bg-blue-500 px-6 py-3 rounded-lg"
              onPress={openAddModal}
            >
              <Text className="text-white font-medium">Ajouter un médicament</Text>
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
                tintColor="#3B82F6"
              />
            }
          />
        )}
      </View>

      {/* Add/Edit Medicine Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <ScrollView className="flex-1 bg-white px-6 py-4" keyboardShouldPersistTaps="handled">
          <View className="flex-row justify-between items-center mb-8">
            <Text className="text-2xl font-semibold text-gray-800">
              {editingProduct ? 'Modifier médicament' : 'Ajouter médicament'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} className="p-1">
              <Ionicons name="close" size={26} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Image Upload */}
          <View className="mb-8">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Image du médicament</Text>
            <TouchableOpacity
              className="w-full h-48 bg-gray-100 rounded-2xl border border-dashed border-gray-300 items-center justify-center overflow-hidden"
              onPress={pickImage}
            >
              {selectedImage ? (
                <Image
                  source={{ uri: selectedImage.uri }}
                  className="w-full h-full rounded-2xl"
                  resizeMode="cover"
                />
              ) : editingProduct?.image ? (
                <Image
                  source={{ uri: getImagePreview(editingProduct.image) }}
                  className="w-full h-full rounded-2xl"
                  resizeMode="cover"
                />
              ) : (
                <View className="items-center">
                  <Ionicons name="image" size={48} color="#9CA3AF" />
                  <Text className="text-gray-500 mt-2">Ajouter une image</Text>
                </View>
              )}
            </TouchableOpacity>


            {uploadingImage && (
              <View className="flex-row items-center mt-2">
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text className="ml-2 text-blue-500">Upload en cours...</Text>
              </View>
            )}
          </View>

          {/* Form Fields */}
          <View className="mb-5">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Nom du médicament</Text>
            <TextInput
              className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
              placeholder="Paracétamol 500mg"
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
            />
          </View>

          <View className="mb-5">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Description</Text>
            <TextInput
              className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 h-24 text-top"
              placeholder="Description du médicament..."
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
              multiline
            />
          </View>

          <View className="mb-5">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Prix unitaire ($)</Text>
            <TextInput
              className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
              placeholder="9.99"
              value={form.price}
              onChangeText={(text) => setForm({ ...form, price: text })}
              keyboardType="decimal-pad"
            />
          </View>

          <View className="mb-5">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Quantité en stock</Text>
            <TextInput
              className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
              placeholder="50"
              value={form.quantity}
              onChangeText={(text) => setForm({ ...form, quantity: text })}
              keyboardType="number-pad"
            />
          </View>

          {/* Category */}
          <View className="mb-5">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Catégorie</Text>
            <View className="bg-gray-50 rounded-xl border border-gray-200">
              <Picker
                selectedValue={form.category}
                onValueChange={(itemValue) => setForm({ ...form, category: itemValue })}
              >
                <Picker.Item label="Sélectionner une catégorie" value="" />
                <Picker.Item label="Antidouleur" value="Antidouleur" />
                <Picker.Item label="Antibiotique" value="Antibiotique" />
                <Picker.Item label="Antihistaminique" value="Antihistaminique" />
                <Picker.Item label="Anti-inflammatoire" value="Anti-inflammatoire" />
                <Picker.Item label="Antipyrétique" value="Antipyrétique" />
                <Picker.Item label="Vitamines" value="Vitamines" />
                <Picker.Item label="Autre" value="Autre" />
              </Picker>
            </View>
          </View>

          {/* Buttons Container */}
          <View className="flex-row justify-center mb-20">
            {/* Save Button */}
            <TouchableOpacity
              className={`bg-blue-600 flex-row items-center justify-center p-4 rounded-xl mr-3 ${uploadingImage ? 'opacity-60' : 'opacity-100'}`}
              onPress={handleSave}
              disabled={uploadingImage}
            >
              <Ionicons name="save-outline" size={18} color="white" />
              <Text className="text-white font-bold text-base ml-2">
                {editingProduct ? 'Mettre à jour' : 'Ajouter'}
              </Text>
            </TouchableOpacity>

            {/* Delete Button */}
            {editingProduct && (
              <TouchableOpacity
                className="bg-red-600 flex-row items-center justify-center p-5 rounded-xl ml-3"
                onPress={() =>
                  Alert.alert(
                    'Supprimer',
                    'Êtes-vous sûr de vouloir supprimer ce médicament ?',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Supprimer',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await databases.deleteDocument(
                              DATABASE_ID,
                              COLLECTION_ID,
                              editingProduct.$id
                            );
                            fetchMedicines();
                            setModalVisible(false);
                          } catch (error) {
                            Alert.alert('Erreur', 'Échec de la suppression');
                          }
                        }
                      }
                    ]
                  )
                }
              >
                <Ionicons name="trash-outline" size={18} color="white" />
                <Text className="text-white font-bold text-base ml-2">Supprimer</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </Modal>

      {/* Stock Log Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={stockLogModalVisible}
        onRequestClose={() => setStockLogModalVisible(false)}
      >
        <ScrollView className="flex-1 bg-white p-4" keyboardShouldPersistTaps="handled">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-gray-800">Enregistrer une vente</Text>
            <TouchableOpacity onPress={() => setStockLogModalVisible(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          <View className="mb-4">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Médicament</Text>
            <View className="bg-gray-50 rounded-lg border border-gray-200">
              <Picker
                selectedValue={stockLogForm.medicineId}
                onValueChange={(itemValue) => {
                  const selected = medicines.find(med => med.$id === itemValue);
                  setStockLogForm({
                    ...stockLogForm,
                    medicineId: itemValue,
                    medicineName: selected?.name || ''
                  });
                }}
              >
                <Picker.Item label="Sélectionner un médicament" value="" />
                {medicines.map((medicine) => (
                  <Picker.Item 
                    key={medicine.$id} 
                    label={`${medicine.name} (${medicine.quantity} en stock)`} 
                    value={medicine.$id} 
                  />
                ))}
              </Picker>
            </View>
          </View>
          
          <View className="mb-4">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Quantité vendue</Text>
            <TextInput
              className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              placeholder="1"
              keyboardType="number-pad"
              value={stockLogForm.quantitySold}
              onChangeText={(text) => setStockLogForm({...stockLogForm, quantitySold: text})}
            />
          </View>
          
          <View className="mb-6">
            <Text className="text-sm text-gray-600 mb-2 font-medium">Notes (optionnel)</Text>
            <TextInput
              className="bg-gray-50 p-4 rounded-lg border border-gray-200 h-24"
              placeholder="Notes supplémentaires..."
              multiline
              value={stockLogForm.notes}
              onChangeText={(text) => setStockLogForm({...stockLogForm, notes: text})}
            />
          </View>
          
          <TouchableOpacity
            className="bg-blue-500 p-4 rounded-xl items-center"
            onPress={handleStockLog}
          >
            <Text className="text-white font-bold text-lg">Enregistrer la vente</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}
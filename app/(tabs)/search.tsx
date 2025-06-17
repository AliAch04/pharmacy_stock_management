import { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  FlatList, 
  ActivityIndicator, 
  Image, 
  TouchableOpacity,
  Modal,
  Button,
  Dimensions
} from 'react-native';
import Slider from '@react-native-community/slider';
import { getMedicines, getFilePreview, getCategories } from '@/services/medicines';

const { width: screenWidth } = Dimensions.get('window');

const Search = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    minPrice: 0,
    maxPrice: 1000
  });
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [categories, setCategories] = useState([]);
  const [imageErrors, setImageErrors] = useState({});

  const limit = 10;

  // Fonction pour construire l'URL de l'image
  const getImageUrl = (imageId) => {
    if (!imageId) return null;
    return `https://fra.cloud.appwrite.io/v1/storage/buckets/medicines-images/files/${imageId}/view?project=68424153002403801f6b&mode=admin`;
  };

  // Gérer les erreurs d'image
  const handleImageError = (itemId) => {
    setImageErrors(prev => ({
      ...prev,
      [itemId]: true
    }));
  };

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Search with debounce
  const fetchMedicines = useCallback(async (reset = false) => {
    if (reset) {
      setPage(0);
      setMedicines([]);
      setHasMore(true);
      setImageErrors({}); // Reset image errors
    }

    if (!hasMore && !reset) return;

    try {
      setLoading(true);
      const currentOffset = reset ? 0 : page * limit;
      
      const response = await getMedicines({
        searchTerm,
        limit,
        offset: currentOffset,
        filters,
        sortField,
        sortOrder
      });

      if (reset) {
        setMedicines(response.documents);
      } else {
        setMedicines(prev => [...prev, ...response.documents]);
      }

      setHasMore(response.documents.length === limit);
      setError(null);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.type === 'missing_index' 
        ? 'La recherche avancée n\'est pas encore configurée. Essayez un terme plus simple.'
        : 'Échec de la recherche. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, page, filters, sortField, sortOrder, hasMore]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMedicines(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, filters, sortField, sortOrder]);

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
  };

  const renderItem = ({ item }) => {
    const imageUrl = getImageUrl(item.image);
    const hasImageError = imageErrors[item.$id];

    return (
      <TouchableOpacity style={styles.itemContainer}>
        <View style={styles.imageContainer}>
          {imageUrl && !hasImageError ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.medicineImage} 
              resizeMode="cover"
              onError={() => handleImageError(item.$id)}
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>📋</Text>
              <Text style={styles.placeholderSubtext}>Pas d'image</Text>
            </View>
          )}
          
          {/* Badge de statut */}
          <View style={[
            styles.statusBadge, 
            { backgroundColor: item.status === 'available' ? '#4CAF50' : '#FF9800' }
          ]}>
            <Text style={styles.statusText}>
              {item.quantity > 0 ? 'Disponible' : 'Indisponible'}
            </Text>
          </View>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <Text style={styles.medicineName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.price}>${item.price.toFixed(2)}</Text>
          </View>
          
          <Text style={styles.category}>{item.category}</Text>
          
          <Text style={styles.description} numberOfLines={3}>
            {item.description}
          </Text>
          
          <View style={styles.footerContainer}>
            <Text style={styles.quantity}>
              Quantité: {item.quantity}
            </Text>
            <TouchableOpacity style={styles.detailButton}>
              <Text style={styles.detailButtonText}>Voir détails</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher des médicaments..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
        />
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Text style={styles.filterButtonText}>🔍 Filtres</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sortContainer}>
        <TouchableOpacity 
          style={[styles.sortButton, sortField === 'name' && styles.activeSortButton]}
          onPress={() => setSortField('name')}
        >
          <Text style={[styles.sortButtonText, sortField === 'name' && styles.activeSortText]}>
            Nom {sortField === 'name' && (sortOrder === 'ASC' ? '↑' : '↓')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sortButton, sortField === 'price' && styles.activeSortButton]}
          onPress={() => setSortField('price')}
        >
          <Text style={[styles.sortButtonText, sortField === 'price' && styles.activeSortText]}>
            Prix {sortField === 'price' && (sortOrder === 'ASC' ? '↑' : '↓')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.toggleButton}
          onPress={toggleSortOrder}
        >
          <Text style={styles.toggleButtonText}>⇅</Text>
        </TouchableOpacity>
      </View>

      {loading && page === 0 ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Recherche en cours...</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={medicines}
          renderItem={renderItem}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>
                {searchTerm ? 'Aucun médicament trouvé' : 'Recherchez des médicaments...'}
              </Text>
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && page > 0 ? (
              <ActivityIndicator size="small" style={styles.footerLoader} color="#2196F3" />
            ) : null
          }
        />
      )}

      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filtres de recherche</Text>
            
            <Text style={styles.filterLabel}>Catégorie</Text>
            <View style={styles.categoryContainer}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    filters.category === cat && styles.selectedCategory
                  ]}
                  onPress={() => setFilters(prev => ({
                    ...prev,
                    category: prev.category === cat ? '' : cat
                  }))}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    filters.category === cat && styles.selectedCategoryText
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>
              Fourchette de prix (${filters.minPrice} - ${filters.maxPrice})
            </Text>
            <View style={styles.priceInputContainer}>
              <TextInput
                style={styles.priceInput}
                value={String(filters.minPrice)}
                onChangeText={(text) => {
                  const value = parseFloat(text) || 0;
                  setFilters(prev => ({
                    ...prev,
                    minPrice: Math.min(value, filters.maxPrice - 1)
                  }));
                }}
                keyboardType="numeric"
                placeholder="Min"
              />
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1000}
                step={10}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#d3d3d3"
                thumbTintColor="#2196F3"
                value={filters.maxPrice}
                onValueChange={value => setFilters(prev => ({
                  ...prev,
                  maxPrice: value
                }))}
                onSlidingComplete={() => fetchMedicines(true)}
              />
              <TextInput
                style={styles.priceInput}
                value={String(filters.maxPrice)}
                onChangeText={(text) => {
                  const value = parseFloat(text) || 1000;
                  setFilters(prev => ({
                    ...prev,
                    maxPrice: Math.max(value, filters.minPrice + 1)
                  }));
                }}
                keyboardType="numeric"
                placeholder="Max"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={() => {
                  setShowFilters(false);
                  fetchMedicines(true);
                }}
              >
                <Text style={styles.applyButtonText}>Appliquer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop:40
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 20,
    marginRight: 12,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
  },
  filterButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    justifyContent: 'center',
  },
  filterButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  sortContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  activeSortButton: {
    backgroundColor: '#2196F3',
  },
  sortButtonText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  activeSortText: {
    color: '#fff',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FF9800',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  list: {
    padding: 8,
  },
  itemContainer: {
    backgroundColor: '#fff',
    marginVertical: 6,
    marginHorizontal: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    height: 180,
  },
  medicineImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  contentContainer: {
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  medicineName: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  category: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantity: {
    fontSize: 12,
    color: '#888',
  },
  detailButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  detailButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  error: {
    color: '#f44336',
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  footerLoader: {
    marginVertical: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  categoryButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
  },
  selectedCategory: {
    backgroundColor: '#2196F3',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  selectedCategoryText: {
    color: '#fff',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  priceInput: {
    width: 80,
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    marginHorizontal: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Search;
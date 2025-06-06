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
  Button
} from 'react-native';
import Slider from '@react-native-community/slider';
import { getMedicines, getFilePreview, getCategories } from '@/services/medicines';

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

  const limit = 10;

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

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      {item.image && (
        <Image 
          source={{ uri: getFilePreview(item.image) }} 
          style={styles.image} 
          resizeMode="cover"
        />
      )}
      <View style={styles.textContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={styles.description}>{item.description}</Text>
        <Text style={styles.price}>${item.price.toFixed(2)}</Text>
      </View>
    </View>
  );

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
          <Text>Filtres</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sortContainer}>
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => setSortField('name')}
        >
          <Text style={sortField === 'name' ? styles.activeSort : {}}>
            Trier par nom {sortField === 'name' && (sortOrder === 'ASC' ? '↑' : '↓')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => setSortField('price')}
        >
          <Text style={sortField === 'price' ? styles.activeSort : {}}>
            Trier par prix {sortField === 'price' && (sortOrder === 'ASC' ? '↑' : '↓')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={toggleSortOrder}
        >
          <Text>Inverser l'ordre</Text>
        </TouchableOpacity>
      </View>

      {loading && page === 0 ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={medicines}
          renderItem={renderItem}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchTerm ? 'Aucun médicament trouvé' : 'Recherchez des médicaments...'}
            </Text>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && page > 0 ? (
              <ActivityIndicator size="small" style={styles.footerLoader} />
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
            <Text style={styles.modalTitle}>Filtres</Text>
            
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
                  <Text>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Fourchette de prix (${filters.minPrice} - ${filters.maxPrice})</Text>
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
              />
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1000}
                step={10}
                minimumTrackTintColor="#1fb28a"
                maximumTrackTintColor="#d3d3d3"
                thumbTintColor="#1a9274"
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
              />
            </View>

            <Button 
              title="Appliquer les filtres" 
              onPress={() => {
                setShowFilters(false);
                fetchMedicines(true);
              }} 
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  filterButton: {
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sortButton: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  activeSort: {
    fontWeight: 'bold',
    color: '#1a9274',
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  loader: {
    marginTop: 20,
  },
  footerLoader: {
    marginVertical: 20,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  list: {
    paddingBottom: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterLabel: {
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  categoryButton: {
    padding: 8,
    margin: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
  },
  selectedCategory: {
    backgroundColor: '#1a9274',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  priceInput: {
    width: 60,
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 8,
    textAlign: 'center',
    marginHorizontal: 5,
  },
  slider: {
    flex: 1,
    height: 40,
  },
});

export default Search;
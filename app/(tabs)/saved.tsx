import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Client, Databases, Query } from 'appwrite';

const client = new Client();
client.setEndpoint('https://[YOUR_APPWRITE_ENDPOINT]').setProject('[YOUR_PROJECT_ID]');

const databases = new Databases(client);
const DATABASE_ID = '[YOUR_DATABASE_ID]';
const PRODUCTS_COLLECTION_ID = 'products';
const TRANSACTIONS_COLLECTION_ID = 'transactions'; // New collection for tracking changes

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '6',
    strokeWidth: '2',
    stroke: '#3B82F6',
  },
};

export default function AnalyticsDashboard() {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('7days'); // 7days, 30days, 3months

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch products
      const productsResponse = await databases.listDocuments(DATABASE_ID, PRODUCTS_COLLECTION_ID);
      setProducts(productsResponse.documents);

      // Fetch transactions based on selected period
      const dateLimit = getDateLimit();
      const transactionsResponse = await databases.listDocuments(
        DATABASE_ID, 
        TRANSACTIONS_COLLECTION_ID,
        [
          Query.greaterThanEqual('createdAt', dateLimit),
          Query.orderDesc('createdAt'),
          Query.limit(100)
        ]
      );
      setTransactions(transactionsResponse.documents);
    } catch (error) {
      console.error('Erreur de récupération des données:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const getDateLimit = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case '7days':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '3months':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Calculate statistics
  const getTotalProducts = () => products.length;
  
  const getLowStockProducts = () => products.filter(p => p.stock <= 5).length;
  
  const getTotalStock = () => products.reduce((sum, p) => sum + (p.stock || 0), 0);
  
  const getStockValue = () => {
    // Assuming average value per unit is stored in product.unitPrice or defaulting to 10
    return products.reduce((sum, p) => sum + ((p.stock || 0) * (p.unitPrice || 10)), 0);
  };

  const getRecentActivity = () => {
    return transactions.filter(t => {
      const transactionDate = new Date(t.createdAt);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return transactionDate >= yesterday;
    }).length;
  };

  // Prepare chart data
  const getStockByCategory = () => {
    const categories = {};
    products.forEach(product => {
      const type = product.type || 'Autre';
      categories[type] = (categories[type] || 0) + (product.stock || 0);
    });
    
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
    return Object.entries(categories).map(([name, population], index) => ({
      name,
      population,
      color: colors[index % colors.length],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    }));
  };

  const getStockTrend = () => {
    const last7Days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayTransactions = transactions.filter(t => {
        const tDate = new Date(t.createdAt);
        return tDate.toDateString() === date.toDateString();
      });
      
      const dayTotal = dayTransactions.reduce((sum, t) => {
        return sum + (t.type === 'add' ? t.quantity : -t.quantity);
      }, 0);
      
      last7Days.push(Math.abs(dayTotal));
    }

    return {
      labels: ['6j', '5j', '4j', '3j', '2j', '1j', "Auj"],
      datasets: [{
        data: last7Days.length > 0 ? last7Days : [0, 0, 0, 0, 0, 0, 0],
        strokeWidth: 2,
      }],
    };
  };

  const getTopProducts = () => {
    return products
      .sort((a, b) => (b.stock || 0) - (a.stock || 0))
      .slice(0, 5)
      .map(p => ({
        name: p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name,
        stock: p.stock || 0,
      }));
  };

  const getTopProductsChart = () => {
    const topProducts = getTopProducts();
    return {
      labels: topProducts.map(p => p.name),
      datasets: [{
        data: topProducts.map(p => p.stock),
      }],
    };
  };

  const StatCard = ({ title, value, icon, color = '#3B82F6', subtitle }) => (
    <View className="bg-white p-4 rounded-lg shadow-sm flex-1 mx-1">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-gray-600 text-sm">{title}</Text>
          <Text className={`text-2xl font-bold`} style={{ color }}>{value}</Text>
          {subtitle && <Text className="text-gray-500 text-xs mt-1">{subtitle}</Text>}
        </View>
        <Ionicons name={icon} size={24} color={color} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <Text className="text-gray-600">Chargement des statistiques...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 bg-white shadow">
        <Text className="text-xl font-bold">Tableau de Bord</Text>
        <View className="flex-row bg-gray-100 rounded-lg">
          {[
            { key: '7days', label: '7j' },
            { key: '30days', label: '30j' },
            { key: '3months', label: '3m' }
          ].map((period) => (
            <TouchableOpacity
              key={period.key}
              className={`px-3 py-1 rounded-lg ${selectedPeriod === period.key ? 'bg-blue-500' : ''}`}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Text className={`text-sm ${selectedPeriod === period.key ? 'text-white' : 'text-gray-600'}`}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView 
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Cards */}
        <View className="flex-row mb-4">
          <StatCard
            title="Total Produits"
            value={getTotalProducts()}
            icon="cube-outline"
            color="#3B82F6"
          />
          <StatCard
            title="Stock Faible"
            value={getLowStockProducts()}
            icon="warning-outline"
            color="#EF4444"
          />
        </View>

        <View className="flex-row mb-6">
          <StatCard
            title="Stock Total"
            value={getTotalStock()}
            icon="layers-outline"
            color="#10B981"
            subtitle="unités"
          />
          <StatCard
            title="Valeur Estimée"
            value={`${getStockValue()}€`}
            icon="cash-outline"
            color="#F59E0B"
          />
        </View>

        {/* Stock Trend Chart */}
        <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <Text className="text-lg font-semibold mb-3">Évolution du Stock (7 derniers jours)</Text>
          <LineChart
            data={getStockTrend()}
            width={screenWidth - 60}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        </View>

        {/* Top Products Chart */}
        <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <Text className="text-lg font-semibold mb-3">Top 5 Produits par Stock</Text>
          <BarChart
            data={getTopProductsChart()}
            width={screenWidth - 60}
            height={200}
            chartConfig={chartConfig}
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        </View>

        {/* Stock by Category */}
        <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <Text className="text-lg font-semibold mb-3">Répartition par Catégorie</Text>
          <PieChart
            data={getStockByCategory()}
            width={screenWidth - 60}
            height={200}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        </View>

        {/* Recent Activity */}
        <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <Text className="text-lg font-semibold mb-3">Activité Récente</Text>
          <View className="flex-row items-center">
            <Ionicons name="pulse-outline" size={20} color="#10B981" />
            <Text className="ml-2 text-gray-700">
              {getRecentActivity()} transactions dans les dernières 24h
            </Text>
          </View>
        </View>

        {/* Low Stock Alert */}
        {getLowStockProducts() > 0 && (
          <View className="bg-red-50 border border-red-200 p-4 rounded-lg shadow-sm mb-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
              <Text className="ml-2 text-red-800 font-semibold">Alerte Stock Faible</Text>
            </View>
            <Text className="text-red-700">
              {getLowStockProducts()} produit(s) ont un stock faible (≤ 5 unités)
            </Text>
            <Text className="text-red-600 text-sm mt-1">
              Vérifiez la liste des produits pour plus de détails
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
import React, { useEffect, useState, useRef } from 'react';
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';

const client = new Client();
client.setEndpoint('https://[YOUR_APPWRITE_ENDPOINT]').setProject('[YOUR_PROJECT_ID]');

const databases = new Databases(client);
const DATABASE_ID = '[YOUR_DATABASE_ID]';
const PRODUCTS_COLLECTION_ID = 'products';
const TRANSACTIONS_COLLECTION_ID = 'transactions';

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
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [exportingPDF, setExportingPDF] = useState(false);
  
  // Refs for capturing charts
  const trendChartRef = useRef();
  const topProductsChartRef = useRef();
  const categoryChartRef = useRef();

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const productsResponse = await databases.listDocuments(DATABASE_ID, PRODUCTS_COLLECTION_ID);
      setProducts(productsResponse.documents);

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

  // Statistics functions
  const getTotalProducts = () => products.length;
  const getLowStockProducts = () => products.filter(p => p.stock <= 5).length;
  const getTotalStock = () => products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const getStockValue = () => {
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
        fullName: p.name,
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

  const getLowStockList = () => {
    return products
      .filter(p => p.stock <= 5)
      .sort((a, b) => (a.stock || 0) - (b.stock || 0))
      .slice(0, 10);
  };

  // PDF Export Function
  const exportToPDF = async () => {
    try {
      setExportingPDF(true);
      
      // Capture chart images
      let trendChartImage = '';
      let topProductsChartImage = '';
      let categoryChartImage = '';
      
      try {
        if (trendChartRef.current) {
          const trendUri = await captureRef(trendChartRef.current, {
            format: 'png',
            quality: 0.8,
          });
          trendChartImage = `data:image/png;base64,${await FileSystem.readAsStringAsync(trendUri, { encoding: 'base64' })}`;
        }
        
        if (topProductsChartRef.current) {
          const topProductsUri = await captureRef(topProductsChartRef.current, {
            format: 'png',
            quality: 0.8,
          });
          topProductsChartImage = `data:image/png;base64,${await FileSystem.readAsStringAsync(topProductsUri, { encoding: 'base64' })}`;
        }
        
        if (categoryChartRef.current) {
          const categoryUri = await captureRef(categoryChartRef.current, {
            format: 'png',
            quality: 0.8,
          });
          categoryChartImage = `data:image/png;base64,${await FileSystem.readAsStringAsync(categoryUri, { encoding: 'base64' })}`;
        }
      } catch (chartError) {
        console.log('Chart capture error:', chartError);
      }

      // Get current date
      const currentDate = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const periodLabels = {
        '7days': '7 derniers jours',
        '30days': '30 derniers jours',
        '3months': '3 derniers mois'
      };

      // Generate HTML content
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Rapport d'Analyse - Gestion de Stock</title>
          <style>
            body {
              font-family: 'Helvetica', Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: #f8f9fa;
              color: #333;
            }
            .header {
              text-align: center;
              background: linear-gradient(135deg, #3B82F6, #1E40AF);
              color: white;
              padding: 30px;
              border-radius: 10px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: bold;
            }
            .header p {
              margin: 10px 0 0 0;
              opacity: 0.9;
              font-size: 14px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }
            .stat-card {
              background: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              border-left: 4px solid #3B82F6;
            }
            .stat-card h3 {
              margin: 0 0 10px 0;
              color: #666;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .stat-card .value {
              font-size: 32px;
              font-weight: bold;
              color: #333;
              margin: 0;
            }
            .stat-card .subtitle {
              color: #888;
              font-size: 12px;
              margin-top: 5px;
            }
            .chart-section {
              background: white;
              padding: 25px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              margin-bottom: 25px;
            }
            .chart-section h2 {
              margin: 0 0 20px 0;
              color: #333;
              font-size: 20px;
              border-bottom: 2px solid #3B82F6;
              padding-bottom: 10px;
            }
            .chart-image {
              width: 100%;
              max-width: 600px;
              height: auto;
              display: block;
              margin: 0 auto;
              border-radius: 8px;
            }
            .products-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            .products-table th,
            .products-table td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #eee;
            }
            .products-table th {
              background: #f8f9fa;
              font-weight: bold;
              color: #333;
            }
            .products-table tr:hover {
              background: #f8f9fa;
            }
            .alert-section {
              background: #FEF2F2;
              border: 1px solid #FECACA;
              border-left: 4px solid #EF4444;
              padding: 20px;
              border-radius: 10px;
              margin-bottom: 25px;
            }
            .alert-section h3 {
              color: #DC2626;
              margin: 0 0 10px 0;
              font-size: 18px;
            }
            .alert-section p {
              color: #7F1D1D;
              margin: 5px 0;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding: 20px;
              background: white;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .footer p {
              margin: 0;
              color: #666;
              font-size: 12px;
            }
            .low-stock {
              color: #EF4444;
              font-weight: bold;
            }
            .good-stock {
              color: #10B981;
            }
            @media print {
              body { background: white; }
              .chart-section, .stat-card, .footer { 
                box-shadow: none; 
                border: 1px solid #ddd;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 Rapport d'Analyse de Stock</h1>
            <p>Généré le ${currentDate} • Période: ${periodLabels[selectedPeriod]}</p>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <h3>Total Produits</h3>
              <div class="value">${getTotalProducts()}</div>
              <div class="subtitle">produits référencés</div>
            </div>
            <div class="stat-card">
              <h3>Stock Faible</h3>
              <div class="value" style="color: #EF4444;">${getLowStockProducts()}</div>
              <div class="subtitle">produits à réapprovisionner</div>
            </div>
            <div class="stat-card">
              <h3>Stock Total</h3>
              <div class="value" style="color: #10B981;">${getTotalStock()}</div>
              <div class="subtitle">unités en stock</div>
            </div>
            <div class="stat-card">
              <h3>Valeur Estimée</h3>
              <div class="value" style="color: #F59E0B;">${getStockValue()}€</div>
              <div class="subtitle">valeur totale du stock</div>
            </div>
          </div>

          ${getLowStockProducts() > 0 ? `
          <div class="alert-section">
            <h3>⚠️ Alerte Stock Faible</h3>
            <p><strong>${getLowStockProducts()} produit(s)</strong> ont un stock critique (≤ 5 unités)</p>
            <p>Action recommandée: Vérifier les approvisionnements pour ces produits</p>
          </div>
          ` : ''}

          ${trendChartImage ? `
          <div class="chart-section">
            <h2>📈 Évolution du Stock (7 derniers jours)</h2>
            <img src="${trendChartImage}" alt="Graphique d'évolution du stock" class="chart-image">
            <p style="text-align: center; color: #666; font-size: 12px; margin-top: 10px;">
              Évolution des mouvements de stock sur la période sélectionnée
            </p>
          </div>
          ` : ''}

          ${topProductsChartImage ? `
          <div class="chart-section">
            <h2>🏆 Top 5 Produits par Stock</h2>
            <img src="${topProductsChartImage}" alt="Graphique des top produits" class="chart-image">
            <table class="products-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Stock</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                ${getTopProducts().map(product => `
                  <tr>
                    <td>${product.fullName}</td>
                    <td>${product.stock}</td>
                    <td class="${product.stock <= 5 ? 'low-stock' : 'good-stock'}">
                      ${product.stock <= 5 ? 'Stock faible' : 'Stock correct'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${categoryChartImage ? `
          <div class="chart-section">
            <h2>📊 Répartition par Catégorie</h2>
            <img src="${categoryChartImage}" alt="Graphique de répartition par catégorie" class="chart-image">
            <table class="products-table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Quantité</th>
                  <th>Pourcentage</th>
                </tr>
              </thead>
              <tbody>
                ${getStockByCategory().map(category => {
                  const percentage = ((category.population / getTotalStock()) * 100).toFixed(1);
                  return `
                    <tr>
                      <td>${category.name}</td>
                      <td>${category.population}</td>
                      <td>${percentage}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${getLowStockProducts() > 0 ? `
          <div class="chart-section">
            <h2>⚠️ Produits à Stock Faible</h2>
            <table class="products-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Stock Actuel</th>
                  <th>Type</th>
                  <th>Prix Unitaire</th>
                </tr>
              </thead>
              <tbody>
                ${getLowStockList().map(product => `
                  <tr>
                    <td>${product.name}</td>
                    <td class="low-stock">${product.stock || 0}</td>
                    <td>${product.type || 'Non défini'}</td>
                    <td>${product.unitPrice || 10}€</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="chart-section">
            <h2>📋 Résumé d'Activité</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <h3>Activité Récente</h3>
                <div class="value" style="color: #10B981;">${getRecentActivity()}</div>
                <div class="subtitle">transactions dans les 24h</div>
              </div>
              <div class="stat-card">
                <h3>Période d'Analyse</h3>
                <div class="value" style="color: #3B82F6;">${periodLabels[selectedPeriod]}</div>
                <div class="subtitle">données analysées</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Rapport généré automatiquement par l'application de gestion de stock</p>
            <p>📧 Pour toute question, contactez l'équipe de gestion</p>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Create a meaningful filename
      const fileName = `Rapport_Stock_${new Date().toISOString().split('T')[0]}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.moveAsync({
        from: uri,
        to: newPath,
      });

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newPath, {
          mimeType: 'application/pdf',
          dialogTitle: 'Partager le rapport PDF',
        });
      } else {
        Alert.alert(
          '✅ PDF Généré', 
          `Le rapport a été sauvegardé avec succès!\n\nEmplacement: ${fileName}`,
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      Alert.alert(
        'Erreur',
        'Impossible de générer le PDF. Veuillez réessayer.',
        [{ text: 'OK' }]
      );
    } finally {
      setExportingPDF(false);
    }
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
        <View className="flex-row items-center">
          {/* Period Selection */}
          <View className="flex-row bg-gray-100 rounded-lg mr-3">
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
          
          {/* PDF Export Button */}
          <TouchableOpacity
            className={`bg-blue-500 px-4 py-2 rounded-lg flex-row items-center ${exportingPDF ? 'opacity-50' : ''}`}
            onPress={exportToPDF}
            disabled={exportingPDF}
          >
            <Ionicons 
              name={exportingPDF ? "hourglass-outline" : "document-text-outline"} 
              size={16} 
              color="white" 
            />
            <Text className="text-white text-sm ml-1 font-medium">
              {exportingPDF ? 'Export...' : 'PDF'}
            </Text>
          </TouchableOpacity>
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
          <View ref={trendChartRef}>
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
        </View>

        {/* Top Products Chart */}
        <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <Text className="text-lg font-semibold mb-3">Top 5 Produits par Stock</Text>
          <View ref={topProductsChartRef}>
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
        </View>

        {/* Stock by Category */}
        <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <Text className="text-lg font-semibold mb-3">Répartition par Catégorie</Text>
          <View ref={categoryChartRef}>
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
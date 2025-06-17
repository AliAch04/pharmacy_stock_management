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
client.setEndpoint('https://cloud.appwrite.io/v1').setProject('68424153002403801f6b');

const databases = new Databases(client);
const DATABASE_ID = 'stock';
const LOGS_COLLECTION_ID = 'logs';

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
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [exportingPDF, setExportingPDF] = useState(false);
  
  // Refs for capturing charts
  const trendChartRef = useRef();
  const topMedicinesChartRef = useRef();
  const transactionTypeChartRef = useRef();

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const dateLimit = getDateLimit();
      const logsResponse = await databases.listDocuments(
        DATABASE_ID, 
        LOGS_COLLECTION_ID,
        [
          Query.greaterThanEqual('timestamp', dateLimit),
          Query.orderDesc('timestamp'),
          Query.limit(500)
        ]
      );
      setLogs(logsResponse.documents);
    } catch (error) {
      console.error('Erreur de récupération des données:', error);
      Alert.alert('Erreur', 'Impossible de charger les données des logs');
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

  // Statistics functions based on logs
  const getTotalTransactions = () => logs.length;
  
  const getUniqueMedicines = () => {
    const uniqueMedicines = new Set(logs.map(log => log.medicineId).filter(Boolean));
    return uniqueMedicines.size;
  };
  
  const getTotalQuantityChanged = () => {
    return logs.reduce((sum, log) => sum + Math.abs(log.quantityChanged || 0), 0);
  };

  const getCurrentStock = () => {
    const medicineStocks = {};
    logs.forEach(log => {
      if (!log.medicineId) return;
      if (!medicineStocks[log.medicineId]) {
        medicineStocks[log.medicineId] = {
          name: log.medicineName || log.medicineId,
          currentStock: 0
        };
      }
      // Calculate current stock based on transaction type
      if (log.transactionType === 'sale') {
        medicineStocks[log.medicineId].currentStock -= (log.quantityChanged || 0);
      } else {
        medicineStocks[log.medicineId].currentStock += (log.quantityChanged || 0);
      }
    });
    return medicineStocks;
  };

  const getLowStockMedicines = () => {
    const stocks = getCurrentStock();
    return Object.values(stocks).filter(med => med.currentStock <= 5).length;
  };

  const getRecentActivity = () => {
    return logs.filter(log => {
      const logDate = new Date(log.timestamp);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return logDate >= yesterday;
    }).length;
  };

  const getTransactionTypes = () => {
    const types = {};
    logs.forEach(log => {
      const type = log.transactionType || 'other';
      types[type] = (types[type] || 0) + 1;
    });
    
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
    return Object.entries(types).map(([name, population], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      population,
      color: colors[index % colors.length],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    }));
  };

  // FIXED: Updated function to respect selected period
  const getActivityTrend = () => {
    // Determine time range based on selected period
    const daysBack = selectedPeriod === '7days' ? 7 : 
                    selectedPeriod === '30days' ? 30 : 90;
    const interval = selectedPeriod === '3months' ? 'week' : 'day';

    const now = new Date();
    const dataPoints = [];
    const labels = [];

    if (interval === 'day') {
      for (let i = daysBack - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        
        const dayLogs = logs.filter(log => {
          const logDate = new Date(log.timestamp);
          return logDate.toDateString() === date.toDateString();
        });
        
        const dayTotal = dayLogs.reduce((sum, log) => {
          return sum + Math.abs(log.quantityChanged || 0);
        }, 0);
        
        dataPoints.push(dayTotal);
        
        // Format labels based on time range
        if (daysBack === 7) {
          labels.push(i === 0 ? "Auj" : `${i}j`);
        } else {
          if (i % 5 === 0 || i === 0) {
            labels.push(i === 0 ? "Auj" : `${i}j`);
          } else {
            labels.push('');
          }
        }
      }
    } else {
      // Weekly aggregation
      const weeksBack = Math.ceil(daysBack / 7);
      for (let i = weeksBack - 1; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
        
        const weekLogs = logs.filter(log => {
          const logDate = new Date(log.timestamp);
          return logDate >= weekStart && logDate <= weekEnd;
        });
        
        const weekTotal = weekLogs.reduce((sum, log) => {
          return sum + Math.abs(log.quantityChanged || 0);
        }, 0);
        
        dataPoints.push(weekTotal);
        
        // Format weekly labels
        if (i === 0) {
          labels.push('Cette');
        } else if (i === 1) {
          labels.push('1s');
        } else {
          labels.push(`${i}s`);
        }
      }
    }

    return {
      labels: labels.length > 0 ? labels : ['', '', '', '', '', '', ''],
      datasets: [{
        data: dataPoints.length > 0 ? dataPoints : Array(daysBack).fill(0),
        strokeWidth: 2,
      }],
    };
  };

  const getTopMedicines = () => {
    const medicineActivity = {};
    logs.forEach(log => {
      if (!log.medicineId) return;
      const key = log.medicineId;
      if (!medicineActivity[key]) {
        medicineActivity[key] = {
          name: log.medicineName || log.medicineId,
          totalActivity: 0
        };
      }
      medicineActivity[key].totalActivity += Math.abs(log.quantityChanged || 0);
    });

    return Object.values(medicineActivity)
      .sort((a, b) => b.totalActivity - a.totalActivity)
      .slice(0, 5)
      .map(med => ({
        name: med.name.length > 15 ? med.name.substring(0, 15) + '...' : med.name,
        fullName: med.name,
        activity: med.totalActivity,
      }));
  };

  const getTopMedicinesChart = () => {
    const topMedicines = getTopMedicines();
    return {
      labels: topMedicines.map(med => med.name),
      datasets: [{
        data: topMedicines.map(med => med.activity),
      }],
    };
  };

  const getLowStockList = () => {
    const stocks = getCurrentStock();
    return Object.values(stocks)
      .filter(med => med.currentStock <= 5)
      .sort((a, b) => a.currentStock - b.currentStock)
      .slice(0, 10);
  };

  const getRecentLogs = () => {
    return logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
  };

  // PDF Export Function (updated for logs data)
  const exportToPDF = async () => {
    try {
      setExportingPDF(true);
      
      // Capture chart images
      let trendChartImage = '';
      let topMedicinesChartImage = '';
      let transactionTypeChartImage = '';
      
      try {
        if (trendChartRef.current) {
          const trendUri = await captureRef(trendChartRef.current, {
            format: 'png',
            quality: 0.8,
          });
          trendChartImage = `data:image/png;base64,${await FileSystem.readAsStringAsync(trendUri, { encoding: 'base64' })}`;
        }
        
        if (topMedicinesChartRef.current) {
          const topMedicinesUri = await captureRef(topMedicinesChartRef.current, {
            format: 'png',
            quality: 0.8,
          });
          topMedicinesChartImage = `data:image/png;base64,${await FileSystem.readAsStringAsync(topMedicinesUri, { encoding: 'base64' })}`;
        }
        
        if (transactionTypeChartRef.current) {
          const transactionTypeUri = await captureRef(transactionTypeChartRef.current, {
            format: 'png',
            quality: 0.8,
          });
          transactionTypeChartImage = `data:image/png;base64,${await FileSystem.readAsStringAsync(transactionTypeUri, { encoding: 'base64' })}`;
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
          <title>Rapport d'Analyse - Gestion Médicaments</title>
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
            .logs-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            .logs-table th,
            .logs-table td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #eee;
            }
            .logs-table th {
              background: #f8f9fa;
              font-weight: bold;
              color: #333;
            }
            .logs-table tr:hover {
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
            .sale-transaction {
              color: #EF4444;
            }
            .restock-transaction {
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
            <h1>💊 Rapport d'Analyse des Médicaments</h1>
            <p>Généré le ${currentDate} • Période: ${periodLabels[selectedPeriod]}</p>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <h3>Total Transactions</h3>
              <div class="value">${getTotalTransactions()}</div>
              <div class="subtitle">transactions enregistrées</div>
            </div>
            <div class="stat-card">
              <h3>Médicaments Uniques</h3>
              <div class="value" style="color: #10B981;">${getUniqueMedicines()}</div>
              <div class="subtitle">médicaments différents</div>
            </div>
            <div class="stat-card">
              <h3>Stock Critique</h3>
              <div class="value" style="color: #EF4444;">${getLowStockMedicines()}</div>
              <div class="subtitle">médicaments à réapprovisionner</div>
            </div>
            <div class="stat-card">
              <h3>Quantité Totale</h3>
              <div class="value" style="color: #F59E0B;">${getTotalQuantityChanged()}</div>
              <div class="subtitle">unités traitées</div>
            </div>
          </div>

          ${getLowStockMedicines() > 0 ? `
          <div class="alert-section">
            <h3>⚠️ Alerte Stock Critique</h3>
            <p><strong>${getLowStockMedicines()} médicament(s)</strong> ont un stock critique (≤ 5 unités)</p>
            <p>Action recommandée: Vérifier les approvisionnements pour ces médicaments</p>
          </div>
          ` : ''}

          ${trendChartImage ? `
          <div class="chart-section">
            <h2>📈 Activité des ${periodLabels[selectedPeriod]}</h2>
            <img src="${trendChartImage}" alt="Graphique d'activité" class="chart-image">
            <p style="text-align: center; color: #666; font-size: 12px; margin-top: 10px;">
              Évolution de l'activité des transactions sur la période sélectionnée
            </p>
          </div>
          ` : ''}

          ${topMedicinesChartImage ? `
          <div class="chart-section">
            <h2>🏆 Top 5 Médicaments par Activité</h2>
            <img src="${topMedicinesChartImage}" alt="Graphique des top médicaments" class="chart-image">
            <table class="logs-table">
              <thead>
                <tr>
                  <th>Médicament</th>
                  <th>Activité Totale</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                ${getTopMedicines().map(medicine => {
                  const currentStock = getCurrentStock()[medicine.fullName] || { currentStock: 0 };
                  return `
                    <tr>
                      <td>${medicine.fullName}</td>
                      <td>${medicine.activity}</td>
                      <td class="${currentStock.currentStock <= 5 ? 'low-stock' : 'good-stock'}">
                        ${currentStock.currentStock <= 5 ? 'Stock critique' : 'Stock correct'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${transactionTypeChartImage ? `
          <div class="chart-section">
            <h2>📊 Répartition par Type de Transaction</h2>
            <img src="${transactionTypeChartImage}" alt="Graphique de répartition par type" class="chart-image">
            <table class="logs-table">
              <thead>
                <tr>
                  <th>Type de Transaction</th>
                  <th>Nombre</th>
                  <th>Pourcentage</th>
                </tr>
              </thead>
              <tbody>
                ${getTransactionTypes().map(type => {
                  const percentage = ((type.population / getTotalTransactions()) * 100).toFixed(1);
                  return `
                    <tr>
                      <td>${type.name}</td>
                      <td>${type.population}</td>
                      <td>${percentage}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${getLowStockMedicines() > 0 ? `
          <div class="chart-section">
            <h2>⚠️ Médicaments à Stock Critique</h2>
            <table class="logs-table">
              <thead>
                <tr>
                  <th>Médicament</th>
                  <th>Stock Actuel</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                ${getLowStockList().map(medicine => `
                  <tr>
                    <td>${medicine.name}</td>
                    <td class="low-stock">${medicine.currentStock}</td>
                    <td class="low-stock">Critique</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="chart-section">
            <h2>📋 Transactions Récentes</h2>
            <table class="logs-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Médicament</th>
                  <th>Type</th>
                  <th>Quantité</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${getRecentLogs().map(log => `
                  <tr>
                    <td>${new Date(log.timestamp).toLocaleDateString('fr-FR')}</td>
                    <td>${log.medicineName || log.medicineId || 'N/A'}</td>
                    <td class="${log.transactionType === 'sale' ? 'sale-transaction' : 'restock-transaction'}">
                      ${log.transactionType || 'N/A'}
                    </td>
                    <td>${log.quantityChanged || 0}</td>
                    <td>${log.notes || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

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
            <p>Rapport généré automatiquement par l'application de gestion des médicaments</p>
            <p>💊 Pour toute question, contactez l'équipe de gestion pharmaceutique</p>
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
      const fileName = `Rapport_Medicaments_${new Date().toISOString().split('T')[0]}.pdf`;
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
        <Text className="text-gray-600">Chargement des logs...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar style="dark" />
      
      {/* FIXED: Header layout */}
      <View className="p-4 bg-white shadow">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-xl font-bold">Tableau de Bord Médicaments</Text>
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
        
        <View className="flex-row justify-center">
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
      </View>

      <ScrollView 
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Cards */}
        <View className="flex-row mb-4">
          <StatCard
            title="Total Transactions"
            value={getTotalTransactions()}
            icon="receipt-outline"
            color="#3B82F6"
          />
          <StatCard
            title="Médicaments Uniques"
            value={getUniqueMedicines()}
            icon="medical-outline"
            color="#10B981"
          />
        </View>

        <View className="flex-row mb-6">
          <StatCard
            title="Stock Critique"
            value={getLowStockMedicines()}
            icon="warning-outline"
            color="#EF4444"
            subtitle="médicaments"
          />
          <StatCard
            title="Quantité Totale"
            value={getTotalQuantityChanged()}
            icon="layers-outline"
            color="#F59E0B"
            subtitle="unités"
          />
        </View>

        {/* Activity Trend Chart */}
        <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <Text className="text-lg font-semibold mb-3">Activité des {selectedPeriod === '7days' ? '7 derniers jours' : selectedPeriod === '30days' ? '30 derniers jours' : '3 derniers mois'}</Text>
          <View ref={trendChartRef}>
            <LineChart
              data={getActivityTrend()}
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

        {/* Top Medicines Chart */}
        <View className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <Text className="text-lg font-semibold mb-3">Top 5 Médicaments par Activité</Text>
          <View ref={topMedicinesChartRef}>
            <BarChart
              data={getTopMedicinesChart()}
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
          <View ref={transactionTypeChartRef}>
            <PieChart
              data={getTransactionTypes()}
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
        {getLowStockMedicines() > 0 && (
          <View className="bg-red-50 border border-red-200 p-4 rounded-lg shadow-sm mb-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
              <Text className="ml-2 text-red-800 font-semibold">Alerte Stock Faible</Text>
            </View>
            <Text className="text-red-700">
              {getLowStockMedicines()} produit(s) ont un stock faible (≤ 5 unités)
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
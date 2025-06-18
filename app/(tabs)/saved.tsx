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
// ... existing imports ...
import { account } from '../../lib/appwrite';
import { router } from 'expo-router';
import { AppwriteException } from 'appwrite';

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
  const [currentUser, setCurrentUser] = useState(null);
  const [userID, setUserID] = useState(null);
  
  // Refs for capturing charts
  const trendChartRef = useRef();
  const topMedicinesChartRef = useRef();
  const transactionTypeChartRef = useRef();

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const dateLimit = getDateLimit();
      const queries = [
        Query.greaterThanEqual('timestamp', dateLimit),
        Query.orderDesc('timestamp'),
        Query.limit(500)
      ];
      
      // Add user ID filter if available
      if (userID) {
        queries.push(Query.equal('userID', userID));
      }

      const logsResponse = await databases.listDocuments(
        DATABASE_ID, 
        LOGS_COLLECTION_ID,
        queries
      );
      
      setLogs(logsResponse.documents);
    } catch (error) {
      console.error('Erreur de récupération des données:', error);
      Alert.alert('Erreur', 'Impossible de charger les données des logs');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = await account.get();
      setCurrentUser(user);
      setUserID(user.$id);
    } catch (error) {
      console.error('Error loading user:', error);
      
      let errorMessage = 'Failed to load user information.';
      if (error instanceof AppwriteException) {
        console.error('Appwrite error:', error.code, error.type, error.response);
        errorMessage = `Appwrite error: ${error.message || error.code}`;
      } else if (error.code === 401) {
        errorMessage = 'Please log in again.';
        router.replace('/login');
        return;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (userID) {
      fetchData();
    }
  }, [selectedPeriod, userID]);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // NEW: All statistics functions now based on logs only
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

// Enhanced PDF Export Function with beautiful styling
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
      
      if (topProductsChartRef.current) {
        const topMedicinesUri = await captureRef(topProductsChartRef.current, {
          format: 'png',
          quality: 0.8,
        });
        topMedicinesChartImage = `data:image/png;base64,${await FileSystem.readAsStringAsync(topMedicinesUri, { encoding: 'base64' })}`;
      }
      
      if (categoryChartRef.current) {
        const transactionTypeUri = await captureRef(categoryChartRef.current, {
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

    // Generate HTML content with enhanced styling
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rapport d'Analyse - Gestion Médicaments</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8fafc;
            padding: 20px;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="40" r="0.8" fill="rgba(255,255,255,0.08)"/><circle cx="40" cy="80" r="1.2" fill="rgba(255,255,255,0.06)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>') repeat;
            opacity: 0.3;
          }
          
          .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            position: relative;
            z-index: 1;
          }
          
          .header p {
            font-size: 16px;
            opacity: 0.9;
            position: relative;
            z-index: 1;
          }
          
          .content {
            padding: 30px;
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          
          .stat-card {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          }
          
          .stat-card h3 {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
          }
          
          .stat-card .value {
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 4px;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .stat-card .subtitle {
            font-size: 12px;
            color: #64748b;
            font-weight: 500;
          }
          
          .alert-section {
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            border: 1px solid #fca5a5;
            border-left: 5px solid #ef4444;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
          }
          
          .alert-section h3 {
            color: #dc2626;
            font-size: 18px;
            margin-bottom: 10px;
            font-weight: 700;
          }
          
          .alert-section p {
            color: #7f1d1d;
            margin-bottom: 8px;
          }
          
          .chart-section {
            margin-bottom: 40px;
            background: white;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
          }
          
          .chart-section h2 {
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
            color: #1e293b;
            font-size: 20px;
            font-weight: 700;
            padding: 20px;
            margin: 0;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .chart-content {
            padding: 20px;
          }
          
          .chart-image {
            width: 100%;
            height: auto;
            border-radius: 8px;
            margin-bottom: 15px;
          }
          
          .logs-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 14px;
          }
          
          .logs-table th {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 12px;
          }
          
          .logs-table th:first-child {
            border-top-left-radius: 8px;
          }
          
          .logs-table th:last-child {
            border-top-right-radius: 8px;
          }
          
          .logs-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
          }
          
          .logs-table tr:nth-child(even) td {
            background: #f1f5f9;
          }
          
          .logs-table tr:hover td {
            background: #e0e7ff;
          }
          
          .low-stock {
            color: #dc2626 !important;
            font-weight: 600;
          }
          
          .good-stock {
            color: #059669;
            font-weight: 600;
          }
          
          .sale-transaction {
            background: #fef2f2;
            color: #dc2626;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }
          
          .restock-transaction {
            background: #f0fdf4;
            color: #059669;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }
          
          .footer {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 25px;
            text-align: center;
            margin-top: 30px;
          }
          
          .footer p {
            margin-bottom: 8px;
            opacity: 0.9;
          }
          
          .footer p:last-child {
            margin-bottom: 0;
            font-weight: 600;
          }
          
          .section-divider {
            height: 2px;
            background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
            margin: 30px 0;
          }
          
          .highlight-box {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border: 1px solid #93c5fd;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
          }
          
          .metric-highlight {
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
          }
          
          .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .status-critical {
            background: #fee2e2;
            color: #dc2626;
            border: 1px solid #fca5a5;
          }
          
          .status-good {
            background: #dcfce7;
            color: #059669;
            border: 1px solid #86efac;
          }
          
          @media print {
            body { padding: 0; }
            .container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💊 Rapport d'Analyse des Médicaments</h1>
            <p>Généré le ${currentDate} • Période: ${periodLabels[selectedPeriod]}</p>
          </div>

          <div class="content">
            <div class="stats-grid">
              <div class="stat-card">
                <h3>Total Transactions</h3>
                <div class="value">${getTotalTransactions()}</div>
                <div class="subtitle">transactions enregistrées</div>
              </div>
              <div class="stat-card">
                <h3>Médicaments Uniques</h3>
                <div class="value">${getUniqueMedicines()}</div>
                <div class="subtitle">médicaments différents</div>
              </div>
              <div class="stat-card">
                <h3>Stock Critique</h3>
                <div class="value">${getLowStockMedicines()}</div>
                <div class="subtitle">médicaments à réapprovisionner</div>
              </div>
              <div class="stat-card">
                <h3>Quantité Totale</h3>
                <div class="value">${getTotalQuantityChanged()}</div>
                <div class="subtitle">unités traitées</div>
              </div>
            </div>

            ${getLowStockMedicines() > 0 ? `
            <div class="alert-section">
              <h3>⚠️ Alerte Stock Critique</h3>
              <p><span class="metric-highlight">${getLowStockMedicines()} médicament(s)</span> ont un stock critique (≤ 5 unités)</p>
              <p><strong>Action recommandée:</strong> Vérifier les approvisionnements pour ces médicaments</p>
            </div>
            ` : ''}

            ${trendChartImage ? `
            <div class="chart-section">
              <h2>📈 Activité des ${periodLabels[selectedPeriod]}</h2>
              <div class="chart-content">
                <img src="${trendChartImage}" alt="Graphique d'activité" class="chart-image">
                <div class="highlight-box">
                  <p style="text-align: center; color: #64748b; font-size: 14px; margin: 0;">
                    Évolution de l'activité des transactions sur la période sélectionnée
                  </p>
                </div>
              </div>
            </div>
            ` : ''}

            ${topMedicinesChartImage ? `
            <div class="chart-section">
              <h2>🏆 Top 5 Médicaments par Activité</h2>
              <div class="chart-content">
                <img src="${topMedicinesChartImage}" alt="Graphique des top médicaments" class="chart-image">
                <table class="logs-table">
                  <thead>
                    <tr>
                      <th>Médicament</th>
                      <th>Activité Totale</th>
                      <th>Statut Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${getTopMedicines().map(medicine => {
                      const currentStockData = getCurrentStock();
                      const stockInfo = Object.values(currentStockData).find(stock => 
                        stock.name === medicine.fullName
                      ) || { currentStock: 0 };
                      const isLowStock = stockInfo.currentStock <= 5;
                      
                      return `
                        <tr>
                          <td><strong>${medicine.fullName}</strong></td>
                          <td><span class="metric-highlight">${medicine.activity}</span></td>
                          <td>
                            <span class="status-badge ${isLowStock ? 'status-critical' : 'status-good'}">
                              ${isLowStock ? 'Stock critique' : 'Stock correct'}
                            </span>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            ` : ''}

            ${transactionTypeChartImage ? `
            <div class="chart-section">
              <h2>📊 Répartition par Type de Transaction</h2>
              <div class="chart-content">
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
                          <td><strong>${type.name}</strong></td>
                          <td><span class="metric-highlight">${type.population}</span></td>
                          <td>${percentage}%</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            ` : ''}

            ${getLowStockMedicines() > 0 ? `
            <div class="chart-section">
              <h2>⚠️ Médicaments à Stock Critique</h2>
              <div class="chart-content">
                <div class="alert-section">
                  <p>Ces médicaments nécessitent un réapprovisionnement urgent</p>
                </div>
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
                        <td><strong>${medicine.name}</strong></td>
                        <td><span class="low-stock">${medicine.currentStock} unités</span></td>
                        <td><span class="status-badge status-critical">Critique</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            ` : ''}

            <div class="chart-section">
              <h2>📋 Transactions Récentes</h2>
              <div class="chart-content">
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
                        <td>${new Date(log.timestamp).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}</td>
                        <td><strong>${log.medicineName || log.medicineId || 'N/A'}</strong></td>
                        <td>
                          <span class="${log.transactionType === 'sale' ? 'sale-transaction' : 'restock-transaction'}">
                            ${log.transactionType || 'N/A'}
                          </span>
                        </td>
                        <td><span class="metric-highlight">${log.quantityChanged || 0}</span></td>
                        <td>${log.notes || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="section-divider"></div>

            <div class="stats-grid">
              <div class="stat-card">
                <h3>Activité Récente</h3>
                <div class="value">${getRecentActivity()}</div>
                <div class="subtitle">transactions dans les 24h</div>
              </div>
              <div class="stat-card">
                <h3>Période d'Analyse</h3>
                <div class="value" style="font-size: 18px;">${periodLabels[selectedPeriod]}</div>
                <div class="subtitle">données analysées</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Rapport généré automatiquement par l'application de gestion des médicaments</p>
            <p>💊 Pour toute question, contactez l'équipe de gestion pharmaceutique</p>
          </div>
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
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { account, databases, storage, databaseId, usersCollectionId } from '../../lib/appwrite';
import { Query, AppwriteException, ID } from 'appwrite';

const avatarBucketId = 'medicines-images';
const PROJECT_ID = '68424153002403801f6b'; // Votre project ID

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  pharmacyName: string;
  phone: string;
  avatar?: string;
  avatarFileId?: string;
  joinDate?: string;
}

const ProfilePage = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editType, setEditType] = useState<'phone' | 'pharmacy'>('phone');
  const [editValue, setEditValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    loadUserData();
    requestMediaPermissions();
  }, []);

  const requestMediaPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please enable media access to change your avatar');
    }
  };

  const loadUserData = async () => {
    try {
      const user = await account.get();
      const response = await databases.listDocuments(
        databaseId,
        usersCollectionId,
        [Query.equal('email', user.email)]
      );

      if (response.documents.length === 0) {
        throw new Error('User profile not found in database');
      }

      const userDoc = response.documents[0];
      
      // Generate avatar URL if we have a file ID
      let avatarUrl = '';
      if (userDoc.avatarFileId) {
        // Utiliser votre format d'URL qui fonctionne
        avatarUrl = `https://fra.cloud.appwrite.io/v1/storage/buckets/${avatarBucketId}/files/${userDoc.avatarFileId}/view?project=${PROJECT_ID}&mode=admin`;
      }
      
      setUserInfo({
        id: userDoc.$id,
        name: userDoc.name,
        email: user.email,
        role: userDoc.role,
        joinDate: user.registration,
        pharmacyName: userDoc.pharmacyName,
        phone: userDoc.phone,
        avatar: avatarUrl || userDoc.avatar || '',
        avatarFileId: userDoc.avatarFileId || '',
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      
      let errorMessage = 'Failed to load profile.';
      
      if (error instanceof AppwriteException) {
        console.error('Appwrite error:', error.code, error.type, error.response);
        errorMessage = `Appwrite error: ${error.message || error.code}`;
      } else if (error.code === 401) {
        errorMessage = 'Please log in again.';
        router.replace('/login');
        return;
      } else if (error.code === 404 || error.message?.includes?.('not found')) {
        errorMessage = 'Profile not found. Please contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await account.deleteSession('current');
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout.');
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = () => router.push('/edit-profile');

  const openEditor = (type: 'phone' | 'pharmacy') => {
    if (!userInfo) return;
    
    setEditType(type);
    
    if (type === 'phone') {
      setEditValue(userInfo.phone);
    } else if (type === 'pharmacy') {
      setEditValue(userInfo.pharmacyName);
    }
    
    setEditModalVisible(true);
  };

  const updateProfileInfo = async () => {
    if (!userInfo || !editValue.trim()) {
      Alert.alert('Error', 'Please enter a valid value');
      return;
    }

    try {
      setIsUpdating(true);
      
      // Create update object
      const updateData: { phone?: string; pharmacyName?: string } = {};
      
      if (editType === 'phone') {
        const phoneRegex = /^[0-9+\-\s()]{8,15}$/;
        if (!phoneRegex.test(editValue)) {
          throw new Error('Please enter a valid phone number (8-15 digits)');
        }
        updateData.phone = editValue;
      } else if (editType === 'pharmacy') {
        if (editValue.length < 2) {
          throw new Error('Pharmacy name must be at least 2 characters');
        }
        updateData.pharmacyName = editValue;
      }
      
      // Update document in Appwrite
      await databases.updateDocument(
        databaseId,
        usersCollectionId,
        userInfo.id,
        updateData
      );
      
      // Update local state
      setUserInfo({
        ...userInfo,
        ...updateData
      });
      
      setEditModalVisible(false);
      Alert.alert('Success', `${editType === 'phone' ? 'Phone number' : 'Pharmacy name'} updated successfully`);
    } catch (error) {
      console.error('Update error:', error);
      
      let errorMessage = `Failed to update ${editType === 'phone' ? 'phone number' : 'pharmacy name'}. Please try again.`;
      
      if (error instanceof AppwriteException) {
        console.error('Appwrite error details:', {
          code: error.code,
          type: error.type,
          response: error.response,
          message: error.message
        });
        
        switch (error.code) {
          case 401:
            errorMessage = 'Session expired. Please log in again.';
            router.replace('/login');
            break;
          case 403:
            errorMessage = 'Permission denied. You cannot update this resource.';
            break;
          case 404:
            errorMessage = 'User document not found.';
            break;
          case 409:
            errorMessage = 'Conflict: Another user has the same value.';
            break;
          default:
            errorMessage = `Appwrite error: ${error.message || error.code}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = () => 
    Alert.alert('Change Password', 'This feature will be implemented soon.');
  
  const handleSettings = () => 
    Alert.alert('Settings', 'This feature will be implemented soon.');
  
  const handleSupport = () => 
    Alert.alert('Support', 'Contact support at: support@pharmstock.com');

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadAvatar(result.assets[0]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const uploadAvatar = async (selectedImage: any) => {
    if (!userInfo) return;
    
    try {
      setIsUploadingAvatar(true);
      setAvatarError(false);
      
      console.log('Upload avec FormData...');
      
      const fileId = ID.unique();
      const fileName = `avatar_${Date.now()}.jpg`;
      
      // Créer FormData
      const formData = new FormData();
      formData.append('fileId', fileId);
      formData.append('file', {
        uri: selectedImage.uri,
        type: selectedImage.mimeType || 'image/jpeg',
        name: fileName,
      } as any);

      // Faire l'appel direct à l'API Appwrite
      const response = await fetch(
        `https://cloud.appwrite.io/v1/storage/buckets/${avatarBucketId}/files`,
        {
          method: 'POST',
          headers: {
            'X-Appwrite-Project': PROJECT_ID,
            // Pas de Content-Type pour FormData, le navigateur le gère
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const uploadResult = await response.json();
      console.log('Upload réussi:', uploadResult);

      // Delete previous avatar if exists
      if (userInfo.avatarFileId) {
        try {
          await fetch(
            `https://cloud.appwrite.io/v1/storage/buckets/${avatarBucketId}/files/${userInfo.avatarFileId}`,
            {
              method: 'DELETE',
              headers: {
                'X-Appwrite-Project': PROJECT_ID,
              },
            }
          );
          console.log('Ancien avatar supprimé');
        } catch (deleteError) {
          console.warn('Failed to delete old avatar:', deleteError);
        }
      }

      // Generate avatar URL with your working format
      const avatarUrl = `https://fra.cloud.appwrite.io/v1/storage/buckets/${avatarBucketId}/files/${uploadResult.$id}/view?project=${PROJECT_ID}&mode=admin`;
      
      // Update user document with new avatar file ID
      await databases.updateDocument(
        databaseId,
        usersCollectionId,
        userInfo.id,
        { avatarFileId: uploadResult.$id }
      );

      // Update local state
      setUserInfo({ 
        ...userInfo, 
        avatar: avatarUrl,
        avatarFileId: uploadResult.$id
      });
      
      Alert.alert('Success', 'Avatar updated successfully');
    } catch (error) {
      console.error('Avatar upload error:', error);
      
      let errorMessage = 'Failed to update avatar. Please try again.';
      
      if (error instanceof AppwriteException) {
        switch (error.code) {
          case 401:
            errorMessage = 'Session expired. Please log in again.';
            router.replace('/login');
            break;
          case 403:
            errorMessage = 'You do not have permission to update your avatar.';
            break;
          case 409:
            errorMessage = 'File with this name already exists.';
            break;
          case 413:
            errorMessage = 'File is too large. Maximum size is 5MB.';
            break;
          default:
            errorMessage = `Appwrite error: ${error.message || error.code}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!userInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
          <View style={styles.errorContainer}>
            <Ionicons name="person-circle-outline" size={80} color="rgba(255,255,255,0.5)" />
            <Text style={styles.errorText}>Unable to load profile</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadUserData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
              colors={['#667eea']}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              {userInfo.avatar && !avatarError ? (
                <Image 
                  source={{ uri: userInfo.avatar }} 
                  style={styles.avatar} 
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={50} color="#667eea" />
                </View>
              )}
              <TouchableOpacity 
                style={styles.editAvatarButton} 
                onPress={pickImage}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{userInfo.name}</Text>
            <Text style={styles.userRole}>{userInfo.role}</Text>
            
            <TouchableOpacity 
              style={styles.pharmacyContainer} 
              onPress={() => openEditor('pharmacy')}
            >
              <Text style={styles.pharmacyName}>{userInfo.pharmacyName}</Text>
              <Ionicons name="create-outline" size={16} color="#667eea" style={styles.editIcon} />
            </TouchableOpacity>
          </View>

          {/* User Information */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            
            <View style={styles.infoCard}>
              <View style={styles.infoItem}>
                <View style={styles.infoIcon}>
                  <Ionicons name="mail-outline" size={20} color="#667eea" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{userInfo.email}</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => openEditor('phone')}>
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="call-outline" size={20} color="#667eea" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <View style={styles.valueContainer}>
                      <Text style={styles.infoValue}>{userInfo.phone}</Text>
                      <Ionicons name="create-outline" size={16} color="#667eea" style={styles.editIcon} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.infoItem}>
                <View style={styles.infoIcon}>
                  <Ionicons name="calendar-outline" size={20} color="#667eea" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Member Since</Text>
                  <Text style={styles.infoValue}>
                    {new Date(userInfo.joinDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoIcon}>
                  <Ionicons name="business-outline" size={20} color="#667eea" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>User ID</Text>
                  <Text style={styles.infoValue}>{userInfo.id}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Account Actions</Text>
            
            <View style={styles.actionCard}>
              <TouchableOpacity style={styles.actionItem} onPress={handleChangePassword}>
                <View style={styles.actionIcon}>
                  <Ionicons name="lock-closed-outline" size={22} color="#667eea" />
                </View>
                <Text style={styles.actionText}>Change Password</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem} onPress={handleSettings}>
                <View style={styles.actionIcon}>
                  <Ionicons name="settings-outline" size={22} color="#667eea" />
                </View>
                <Text style={styles.actionText}>Settings</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem} onPress={handleSupport}>
                <View style={styles.actionIcon}>
                  <Ionicons name="help-circle-outline" size={22} color="#667eea" />
                </View>
                <Text style={styles.actionText}>Help & Support</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionItem, styles.logoutItem]} onPress={handleLogout}>
                <View style={styles.actionIcon}>
                  <Ionicons name="log-out-outline" size={22} color="#ff4757" />
                </View>
                <Text style={[styles.actionText, styles.logoutText]}>Logout</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => !isUpdating && setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit {editType === 'phone' ? 'Phone Number' : 'Pharmacy Name'}
            </Text>
            
            <TextInput
              style={styles.input}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={`Enter your ${editType === 'phone' ? 'phone number' : 'pharmacy name'}`}
              placeholderTextColor="#888"
              autoFocus
              editable={!isUpdating}
              multiline={editType === 'pharmacy'}
              numberOfLines={editType === 'pharmacy' ? 2 : 1}
            />
            
            {editType === 'phone' && (
              <Text style={styles.formatHint}>
                Format: 8-15 digits, can include + - ( )
              </Text>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
                disabled={isUpdating}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, isUpdating && styles.disabledButton]}
                onPress={updateProfileInfo}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    marginTop:50,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 20,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#667eea',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#667eea',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 5,
    backgroundColor: '#667eea',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  userRole: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 5,
  },
  pharmacyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  pharmacyName: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
    marginRight: 8,
  },
  editIcon: {
    marginLeft: 5,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  editProfileText: {
    color: '#667eea',
    fontWeight: '600',
    marginLeft: 8,
  },
  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  actionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 100

  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  logoutItem: {
    borderBottomWidth: 0,

  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  logoutText: {
    color: '#ff4757',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    minHeight: 50,
    borderColor: '#667eea',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    textAlignVertical: 'top',
  },
  formatHint: {
    alignSelf: 'flex-start',
    color: '#666',
    fontSize: 12,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#667eea',
  },
  disabledButton: {
    backgroundColor: '#a0a0a0',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ProfilePage;
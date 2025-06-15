// app/(tabs)/profile.tsx
import { account, databases, ID, storage } from "@/services/appwrite"; // ensure correct path
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  joinDate: string;
  pharmacyName: string;
  phone: string;
  avatar?: string;
}

const ProfilePage = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const user = await account.get();
      const doc = await databases.getDocument("pharmacyDB", "users", user.$id);

      const avatarUrl = doc.avatar
        ? storage.getFilePreview("avatars", doc.avatar).href
        : undefined;

      setUserInfo({
        id: doc.$id,
        name: doc.name,
        email: doc.email,
        role: doc.role,
        joinDate: doc.joinDate,
        pharmacyName: doc.pharmacyName,
        phone: doc.phone,
        avatar: avatarUrl,
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Failed to load profile data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUserData();
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await account.deleteSession("current");
            router.replace("/");
          } catch (err) {
            Alert.alert("Logout Failed", "Something went wrong during logout.");
          }
        },
      },
    ]);
  };

  const handleEditProfile = () => {
    router.push("/edit-profile");
  };

  const handleChangePassword = () => {
    Alert.alert("Change Password", "This feature will be implemented soon.");
  };

  const handleSettings = () => {
    Alert.alert("Settings", "This feature will be implemented soon.");
  };

  const handleSupport = () => {
    Alert.alert("Support", "Contact us at support@pharmstock.com");
  };

  const handleAvatarChange = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const file = {
        uri: result.assets[0].uri,
        name: `avatar-${Date.now()}.jpg`,
        type: "image/jpeg",
      };

      try {
        const fileRes = await storage.createFile("avatars", ID.unique(), file);
        const avatarId = fileRes.$id;

        // Update user document with new avatar
        const user = await account.get();
        await databases.updateDocument("pharmacyDB", "users", user.$id, {
          avatar: avatarId,
        });

        loadUserData();
      } catch (err) {
        console.error("Avatar upload failed:", err);
        Alert.alert("Error", "Failed to upload avatar.");
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!userInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.gradient}>
          <View style={styles.errorContainer}>
            <Ionicons
              name="person-circle-outline"
              size={80}
              color="rgba(255,255,255,0.5)"
            />
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
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              {userInfo.avatar ? (
                <Image
                  source={{ uri: userInfo.avatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={50} color="#667eea" />
                </View>
              )}
              <TouchableOpacity
                style={styles.editAvatarButton}
                onPress={handleAvatarChange}
              >
                <Ionicons name="camera" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{userInfo.name}</Text>
            <Text style={styles.userRole}>{userInfo.role}</Text>
            <Text style={styles.pharmacyName}>{userInfo.pharmacyName}</Text>

            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={handleEditProfile}
            >
              <Ionicons name="create-outline" size={20} color="#667eea" />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Account Information</Text>

            <View style={styles.infoCard}>
              {[
                {
                  icon: "mail-outline",
                  label: "Email",
                  value: userInfo.email,
                },
                {
                  icon: "call-outline",
                  label: "Phone",
                  value: userInfo.phone,
                },
                {
                  icon: "calendar-outline",
                  label: "Member Since",
                  value: new Date(userInfo.joinDate).toLocaleDateString(),
                },
                {
                  icon: "business-outline",
                  label: "User ID",
                  value: userInfo.id,
                },
              ].map((item, idx) => (
                <View style={styles.infoItem} key={idx}>
                  <View style={styles.infoIcon}>
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color="#667eea"
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={styles.infoValue}>{item.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Account Actions</Text>

            <View style={styles.actionCard}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleChangePassword}
              >
                <View style={styles.actionIcon}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={22}
                    color="#667eea"
                  />
                </View>
                <Text style={styles.actionText}>Change Password</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleSettings}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="settings-outline" size={22} color="#667eea" />
                </View>
                <Text style={styles.actionText}>Settings</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleSupport}
              >
                <View style={styles.actionIcon}>
                  <Ionicons
                    name="help-circle-outline"
                    size={22}
                    color="#667eea"
                  />
                </View>
                <Text style={styles.actionText}>Help & Support</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.logoutItem]}
                onPress={handleLogout}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="log-out-outline" size={22} color="#ff4757" />
                </View>
                <Text style={[styles.actionText, styles.logoutText]}>
                  Logout
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
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
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  errorText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  profileCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    margin: 20,
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: "#667eea",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(102, 126, 234, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#667eea",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 5,
    backgroundColor: "#667eea",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
    textAlign: "center",
  },
  userRole: {
    fontSize: 16,
    color: "#667eea",
    fontWeight: "600",
    marginBottom: 5,
  },
  pharmacyName: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(102, 126, 234, 0.1)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#667eea",
  },
  editProfileText: {
    color: "#667eea",
    fontWeight: "600",
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
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 15,
  },
  infoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  actionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(102, 126, 234, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(102, 126, 234, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  logoutText: {
    color: "#ff4757",
  },
});

export default ProfilePage;

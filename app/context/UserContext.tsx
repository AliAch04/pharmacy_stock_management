import React, { createContext, useContext, useState, useEffect } from 'react';
import { account } from '@/services/appwrite';

interface User {
  $id: string;
  name: string;
  email: string;
  // Add other user fields as needed
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  loading: true,
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // First try to get current session
        await account.getSession('current');
        
        // If session exists, get user details
        const currentUser = await account.get();
        setUser({
          $id: currentUser.$id,
          name: currentUser.name,
          email: currentUser.email,
          // Add other fields as needed
        });
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
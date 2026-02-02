import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserProfile {
  name: string;
  age: string;
  height: string; // in cm
  weight: string; // in kg
  previousDiseases: string;
  bodyType: 'athletic' | 'lean' | 'muscular' | 'healthy' | 'obese' | '';
  currentGoal: string;
  desiredOutcome: string;
}

interface User {
  id: string;
  email: string;
  profile?: UserProfile;
  onboardingCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  updateProfile: (profile: UserProfile) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      console.log('🔄 Loading user from localStorage:', parsedUser);
      setUser(parsedUser);
    } else {
      console.log('📭 No user found in localStorage, creating default user with reports');
      // Create default user with the user ID that has reports
      const defaultUser = {
        id: '4f6aedf0-2ecd-4ff8-bbd7-ef08743a8f23',
        email: 'test@example.com'
      };
      setUser(defaultUser);
      localStorage.setItem('user', JSON.stringify(defaultUser));
      console.log('✅ Created default user with reports:', defaultUser);
    }
  }, []);

  const login = (userData: User) => {
    console.log('👤 Logging in user:', userData);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    console.log('💾 User stored in localStorage');
  };

  const updateProfile = (profile: UserProfile) => {
    if (user) {
      const updatedUser = { ...user, profile };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, updateProfile, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

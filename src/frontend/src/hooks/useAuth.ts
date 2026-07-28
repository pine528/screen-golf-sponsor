import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { User, RegisterData } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email: string, password: string) => {
        const response = await api.login(email, password);
        if (response.success && response.data) {
          const { accessToken, refreshToken, user } = response.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        }
      },

      register: async (data: RegisterData) => {
        let response;

        // FAN 역할이면 fanRegister 호출, AGENCY면 agencyRegister 호출, 아니면 기존 register 호출
        if (data.role === 'FAN') {
          response = await api.fanRegister({
            email: data.email,
            password: data.password,
            nickname: data.nickname,
          });
        } else if (data.role === 'AGENCY') {
          response = await api.agencyRegister({
            email: data.email,
            password: data.password,
            name: data.name || '',
            bizNo: data.bizNo,
            contactName: data.contactName,
            contactPhone: data.contactPhone,
          });
        } else {
          response = await api.register(data);
        }

        if (response.success && response.data) {
          const { accessToken, refreshToken, user } = response.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const response = await api.getMe();
          if (response.success && response.data) {
            set({
              user: response.data,
              accessToken: token,
              refreshToken: localStorage.getItem('refreshToken'),
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

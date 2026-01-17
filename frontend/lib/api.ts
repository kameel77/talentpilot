// API client with JWT token management and error handling.
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Storage keys
const TOKEN_KEY = 'talentpilot_token';
const USER_KEY = 'talentpilot_user';

// Types
export interface User {
    id: number;
    email: string;
    full_name: string;
    job_title?: string;
    role: 'admin' | 'manager' | 'user';
    is_active: boolean;
    is_ghost: boolean;
    avatar_url?: string;
    organization_id: number;
    created_at: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
}

export interface Team {
    id: number;
    name: string;
    description?: string;
    organization_id: number;
    manager_id?: number;
    created_at: string;
}

export interface TalentTranslation {
    language: string;
    name: string;
    description?: string;
    short_description?: string;
}

export interface Talent {
    id: number;
    code: string;
    domain: 'executing' | 'influencing' | 'relationship_building' | 'strategic_thinking';
    translation: TalentTranslation;
}

export interface GhostInviteTalent {
    talent_id: number;
    rank: number;
}

export interface GhostInviteRequest {
    email: string;
    full_name: string;
    job_title?: string;
    team_id: number;
    talents?: GhostInviteTalent[];
}

export interface GhostInviteResponse {
    invitation_id: number;
    user_id: number;
    invite_token: string;
    expires_at: string;
    status: string;
}

// Token management
export const tokenManager = {
    getToken: (): string | null => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(TOKEN_KEY);
    },

    setToken: (token: string): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(TOKEN_KEY, token);
    },

    removeToken: (): void => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },

    getUser: (): User | null => {
        if (typeof window === 'undefined') return null;
        const userStr = localStorage.getItem(USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
    },

    setUser: (user: User): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
};

// Create axios instance
const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
    (config) => {
        const token = tokenManager.getToken();
        if (token) {
            config.headers = {
                ...(config.headers || {}),
                Authorization: `Bearer ${token}`,
            };
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
            tokenManager.removeToken();
            // Redirect to login (you can customize this)
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

// API methods
export const api = {
    // Auth
    auth: {
        login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
            const response = await apiClient.post<AuthResponse>('/api/auth/login', credentials);
            return response.data;
        },

        register: async (data: RegisterData): Promise<AuthResponse> => {
            const response = await apiClient.post<AuthResponse>('/api/auth/register', data);
            return response.data;
        },

        getCurrentUser: async (): Promise<User> => {
            const response = await apiClient.get<User>('/api/auth/me');
            return response.data;
        },
    },

    // Organizations
    organizations: {
        create: async (name: string) => {
            const response = await apiClient.post('/api/organizations', { name });
            return response.data;
        },

        get: async (id: number) => {
            const response = await apiClient.get(`/api/organizations/${id}`);
            return response.data;
        },
    },

    // Teams
    teams: {
        list: async (): Promise<Team[]> => {
            const response = await apiClient.get<Team[]>('/api/teams');
            return response.data;
        },

        get: async (id: number) => {
            const response = await apiClient.get(`/api/teams/${id}`);
            return response.data;
        },

        create: async (data: { name: string; description?: string; manager_id?: number }) => {
            const response = await apiClient.post('/api/teams', data);
            return response.data;
        },
    },

    // Users
    users: {
        list: async (teamId?: number) => {
            const params = teamId ? { team_id: teamId } : {};
            const response = await apiClient.get('/api/users', { params });
            return response.data;
        },

        get: async (id: number) => {
            const response = await apiClient.get(`/api/users/${id}`);
            return response.data;
        },

        create: async (data: { email: string; password: string; full_name: string; role?: string }) => {
            const response = await apiClient.post('/api/users', data);
            return response.data;
        },
    },

    // Talents
    talents: {
        list: async (): Promise<Talent[]> => {
            const response = await apiClient.get<Talent[]>('/api/talents');
            return response.data;
        },

        assignToUser: async (userId: number, talents: { talent_id: number; rank: number }[]) => {
            const response = await apiClient.post(`/api/users/${userId}/talents`, talents);
            return response.data;
        },

        getUserTalents: async (userId: number) => {
            const response = await apiClient.get(`/api/users/${userId}/talents`);
            return response.data;
        },
    },

    // Invitations
    invitations: {
        createGhostInvite: async (data: GhostInviteRequest): Promise<GhostInviteResponse> => {
            const response = await apiClient.post<GhostInviteResponse>('/api/invitations/ghost', data);
            return response.data;
        },
    },

    // AI Tips
    tips: {
        getDaily: async (context?: string) => {
            const params = context ? { context } : {};
            const response = await apiClient.get('/api/tips/daily', { params });
            return response.data;
        },

        submitFeedback: async (tipId: number, helpful: boolean) => {
            const response = await apiClient.post('/api/tips/feedback', { tip_id: tipId, helpful });
            return response.data;
        },
    },

    // Gallup
    gallup: {
        parsePdf: async (file: File, language: string = 'pl') => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('language', language);
            const response = await apiClient.post('/api/gallup/parse-pdf', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        },

        saveTalents: async (userId: number, rankings: Record<string, number>, language: string = 'en') => {
            const response = await apiClient.post(`/api/gallup/save-talents/${userId}`, {
                rankings,
                language,
            });
            return response.data;
        },
    },
};

export default apiClient;

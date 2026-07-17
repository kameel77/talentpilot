// API client with JWT token management and error handling.
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Storage keys
const TOKEN_KEY = 'talentpilot_token';
const USER_KEY = 'talentpilot_user';
const ACTIVE_ORG_KEY = 'talentpilot_active_org';

// Types
export interface User {
    id: number;
    email: string;
    full_name: string;
    job_title?: string;
    job_title_en?: string;
    role: 'admin' | 'manager' | 'coach' | 'user';
    is_active: boolean;
    is_ghost: boolean;
    avatar_url?: string;
    phone?: string;
    linkedin_url?: string;
    organization_id: number;
    created_at: string;
    public_token?: string;
    public_slug?: string;
    language?: string;
    organizations_access?: number[];
}

export interface Organization {
    id: number;
    name: string;
    address?: string;
    street?: string;
    postal_code?: string;
    city?: string;
    tax_id?: string;
    language?: string;
    created_at: string;
}

export interface OrganizationCreateData {
    name: string;
    street?: string;
    postal_code?: string;
    city?: string;
    tax_id?: string;
}

export interface OrganizationUpdateData {
    name?: string;
    address?: string;
    street?: string;
    postal_code?: string;
    city?: string;
    tax_id?: string;
    language?: string;
}

export interface UserUpdateData {
    full_name?: string;
    email?: string;
    phone?: string;
    linkedin_url?: string;
    avatar_url?: string;
    is_active?: boolean;
    superpowers?: string;
    motivators?: string;
    blockers?: string;
    feedback_style?: string;
    public_profile_settings?: Record<string, boolean | number>;
    public_slug?: string;
    job_title?: string;
    job_title_en?: string;
    superpowers_en?: string;
    motivators_en?: string;
    blockers_en?: string;
    feedback_style_en?: string;
    language?: string;
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
    organization_name?: string;
    manager_id?: number;
    members_count?: number;
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

export interface AdminTalent {
    id: number;
    code: string;
    domain: 'executing' | 'influencing' | 'relationship_building' | 'strategic_thinking';
    translations: TalentTranslation[];
}

export interface GhostInviteTalent {
    talent_id: number;
    rank: number;
}

export interface GhostInviteRequest {
    email: string;
    full_name: string;
    job_title?: string;
    team_id?: number;
    organization_id?: number;
    talents?: GhostInviteTalent[];
}

export interface GhostInviteResponse {
    invitation_id: number;
    user_id: number;
    invite_token: string;
    expires_at: string;
    status: string;
}

export interface QueryReview {
    query_id: number;
    question: string;
    language: string;
    created_at: string;
    answer_id: number;
    answer_text: string;
    model_name: string;
    status: 'pending' | 'approved' | 'rejected';
    edited_text?: string;
}

export interface AdminSettings {
    settings: Record<string, string>;
}

export interface AdminSettingUpdate {
    key: string;
    value: string;
}

export interface KnowledgeItem {
    id: number;
    title: string;
    category: string;
    tags: string[];
    section: string;
    content: string;
    language: string;
    is_active: boolean;
    metadata_json: Record<string, unknown>;
    created_at: string;
    updated_at?: string | null;
}

// QA v1 Types
export interface QAAnswer {
    talent: string;
    competency: string;
    actions: string[];
    fallback: boolean;
}

export interface QAQueryResponse {
    query_id: number;
    answer_id: number;
    answer: QAAnswer;
    answer_raw: string;
    render_mode: string;
    source: string;
}

export interface QAHistoryItem {
    query_id: number;
    question: string;
    context: 'self' | 'team';
    answer: QAAnswer;
    answer_raw: string;
    render_mode: string;
    created_at: string;
}

export interface DomainDistribution {
    executing: number;
    influencing: number;
    relationship_building: number;
    strategic_thinking: number;
}

export interface UserDetailResponse extends User {
    superpowers?: string;
    motivators?: string;
    blockers?: string;
    feedback_style?: string;
    superpowers_en?: string;
    motivators_en?: string;
    blockers_en?: string;
    feedback_style_en?: string;
}

export interface UserTalentResponse {
    id: number;
    talent_id: number;
    rank: number;
    talent: Talent;
}

// Compare types
export interface TalentCompareItem {
    code: string;
    name: string;
    domain: string;
    rank: number;
}

export interface SharedTalent {
    code: string;
    name: string;
    domain: string;
    rank_a: number;
    rank_b: number;
}

export interface DomainBalanceItem {
    domain: string;
    domain_label: string;
    count_a: number;
    count_b: number;
}

export interface CompareResponse {
    user_a: User;
    user_b: User;
    shared_talents: SharedTalent[];
    unique_a: TalentCompareItem[];
    unique_b: TalentCompareItem[];
    domain_balance: DomainBalanceItem[];
    synergy_score: number;
    collaboration_tips: string[];
}

// Tips types
export interface DailyTipResponse {
    tip_id: number | null;
    content: string;
    talent_focus: string;
    context: string;
}

export interface SynergyTipResponse {
    tip_id: number | null;
    content: string;
    target_user_name: string | null;
    shared_talents: SharedTalent[];
    synergy_score: number;
    collaboration_tips: string[];
    domain_balance: DomainBalanceItem[];
}

export interface QAFeedbackRequest {
    query_id: number;
    answer_id: number;
    rating?: number;
    is_effective?: boolean;
    comment?: string;
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
        localStorage.removeItem(ACTIVE_ORG_KEY);
    },

    getUser: (): User | null => {
        if (typeof window === 'undefined') return null;
        const userStr = localStorage.getItem(USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
    },

    setUser: (user: User): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        if (!localStorage.getItem(ACTIVE_ORG_KEY) && user.organization_id) {
            localStorage.setItem(ACTIVE_ORG_KEY, user.organization_id.toString());
        }
    },
    
    getActiveOrgId: (): number | null => {
        if (typeof window === 'undefined') return null;
        const val = localStorage.getItem(ACTIVE_ORG_KEY);
        return val ? parseInt(val, 10) : null;
    },
    
    setActiveOrgId: (orgId: number): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(ACTIVE_ORG_KEY, orgId.toString());
    }
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
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        const activeOrgId = tokenManager.getActiveOrgId();
        if (activeOrgId && config.headers && !config.headers['X-Organization-Id']) {
            config.headers['X-Organization-Id'] = activeOrgId.toString();
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

// Dashboard aggregate (replaces N+1 fetches on the dashboard landing page)
export interface TeamDomainCounts {
    executing: number;
    influencing: number;
    relationship_building: number;
    strategic_thinking: number;
}

export interface DashboardMember {
    id: number;
    full_name: string;
    email: string;
    role: string;
}

export interface DashboardOverview {
    total_users: number;
    users_with_talents: number;
    team_domains: TeamDomainCounts;
    members: DashboardMember[];
}

export interface CoachClientOverview {
    id: number;
    name: string;
    members: number;
    teams: number;
    users_with_talents: number;
}

export interface CoachDashboardTotals {
    clients: number;
    teams: number;
    people: number;
    users_with_talents: number;
}

export interface CoachDashboardOverview {
    clients: CoachClientOverview[];
    individual_clients: number;
    individual_clients_with_talents: number;
    totals: CoachDashboardTotals;
}

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

        registerCoach: async (data: { email: string; password: string; full_name: string }): Promise<AuthResponse> => {
            const response = await apiClient.post<AuthResponse>('/api/auth/register-coach', data);
            return response.data;
        },

        getCurrentUser: async (): Promise<User> => {
            const response = await apiClient.get<User>('/api/auth/me');
            return response.data;
        },

        getMyOrganizations: async (): Promise<Array<{id: number, name: string}>> => {
            const response = await apiClient.get<Array<{id: number, name: string}>>('/api/auth/me/organizations');
            return response.data;
        },

        forgotPassword: async (email: string) => {
            const response = await apiClient.post('/api/auth/forgot-password', { email });
            return response.data;
        },

        resetPassword: async (token: string, new_password: string) => {
            const response = await apiClient.post('/api/auth/reset-password', { token, new_password });
            return response.data;
        },
    },

    // Organizations
    organizations: {
        list: async (): Promise<Organization[]> => {
            const response = await apiClient.get<Organization[]>('/api/organizations');
            return response.data;
        },

        create: async (data: OrganizationCreateData): Promise<Organization> => {
            const response = await apiClient.post<Organization>('/api/organizations', data);
            return response.data;
        },

        get: async (id: number): Promise<Organization> => {
            const response = await apiClient.get<Organization>(`/api/organizations/${id}`);
            return response.data;
        },

        update: async (id: number, data: OrganizationUpdateData): Promise<Organization> => {
            const response = await apiClient.patch<Organization>(`/api/organizations/${id}`, data);
            return response.data;
        },

        delete: async (id: number): Promise<void> => {
            await apiClient.delete(`/api/organizations/${id}`);
        },
    },

    // Teams
    teams: {
        list: async (orgIdOverride?: number): Promise<Team[]> => {
            const headers = orgIdOverride ? { 'X-Organization-Id': String(orgIdOverride) } : undefined;
            const response = await apiClient.get<Team[]>('/api/teams', { headers });
            return response.data;
        },

        get: async (id: number) => {
            const response = await apiClient.get(`/api/teams/${id}`);
            return response.data;
        },

        create: async (data: {
            name: string;
            description?: string;
            manager_id?: number;
            organization_id?: number;
        }): Promise<Team> => {
            const response = await apiClient.post<Team>('/api/teams', data);
            return response.data;
        },

        update: async (id: number, data: {
            name?: string;
            description?: string;
            manager_id?: number | null;
        }): Promise<Team> => {
            const response = await apiClient.patch<Team>(`/api/teams/${id}`, data);
            return response.data;
        },

        generateMatrix: async (id: number): Promise<{ url: string; message: string }> => {
            const response = await apiClient.post(`/api/teams/${id}/generate-matrix`);
            return response.data;
        },

        getMatrix: async (id: number) => {
            const response = await apiClient.get(`/api/teams/${id}/matrix`);
            return response.data;
        },

        removeMember: async (teamId: number, userId: number): Promise<void> => {
            await apiClient.delete(`/api/teams/${teamId}/members/${userId}`);
        },

        replaceMember: async (teamId: number, ghostUserId: number, existingUserId: number) => {
            const response = await apiClient.post(`/api/teams/${teamId}/replace-member`, {
                ghost_user_id: ghostUserId,
                existing_user_id: existingUserId,
            });
            return response.data;
        },
    },

    // Users
    users: {
        list: async (teamId?: number, orgIdOverride?: number) => {
            const params = teamId ? { team_id: teamId } : {};
            const headers = orgIdOverride ? { 'X-Organization-Id': String(orgIdOverride) } : undefined;
            const response = await apiClient.get('/api/users', { params, headers });
            return response.data;
        },

        get: async (id: number): Promise<User> => {
            const response = await apiClient.get<User>(`/api/users/${id}`);
            return response.data;
        },

        update: async (id: number, data: UserUpdateData): Promise<User> => {
            const response = await apiClient.patch<User>(`/api/users/${id}`, data);
            return response.data;
        },

        changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
            await apiClient.post('/api/users/me/change-password', {
                current_password: currentPassword,
                new_password: newPassword,
            });
        },

        create: async (data: { email: string; password: string; full_name: string; role?: string }) => {
            const response = await apiClient.post('/api/users', data);
            return response.data;
        },

        getDetail: async (id: number): Promise<UserDetailResponse> => {
            const response = await apiClient.get<UserDetailResponse>(`/api/users/${id}`);
            return response.data;
        },

        generateManual: async (userId: number, language?: string): Promise<{ superpowers: string; motivators: string; blockers: string; feedback_style: string }> => {
            const response = await apiClient.post(`/api/users/${userId}/generate-manual`, null, { params: language ? { language } : undefined });
            return response.data;
        },

        translateProfile: async (): Promise<{ job_title_en: string; superpowers_en: string; motivators_en: string; blockers_en: string; feedback_style_en: string }> => {
            const response = await apiClient.post('/api/users/me/translate-profile');
            return response.data;
        },

        delete: async (id: number): Promise<void> => {
            await apiClient.delete(`/api/users/${id}`);
        },

        replaceUser: async (ghostId: number, existingUserId: number) => {
            const response = await apiClient.post(`/api/users/${ghostId}/replace`, {
                existing_user_id: existingUserId,
            });
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

        getUserTalentsTyped: async (userId: number, language: string = 'pl'): Promise<UserTalentResponse[]> => {
            const response = await apiClient.get<UserTalentResponse[]>(`/api/users/${userId}/talents`, { params: { language } });
            return response.data;
        },

        getUserDomains: async (userId: number): Promise<DomainDistribution> => {
            const response = await apiClient.get<DomainDistribution>(`/api/users/${userId}/domains`);
            return response.data;
        },
    },

    // Invitations
    invitations: {
        createGhostInvite: async (data: GhostInviteRequest): Promise<GhostInviteResponse> => {
            const response = await apiClient.post<GhostInviteResponse>('/api/invitations/ghost', data);
            return response.data;
        },

        acceptInvite: async (token: string, password: string): Promise<AuthResponse> => {
            const response = await apiClient.post<AuthResponse>('/api/invitations/accept', { token, password });
            return response.data;
        },

        resendInvitation: async (userId: number): Promise<{ ok: boolean }> => {
            const response = await apiClient.post<{ ok: boolean }>(`/api/users/${userId}/resend-invitation`);
            return response.data;
        },

        moveOrganization: async (userId: number, data: { organization_id: number; team_id?: number }): Promise<{ ok: boolean }> => {
            const response = await apiClient.post<{ ok: boolean }>(`/api/users/${userId}/move-organization`, data);
            return response.data;
        },
    },

    // AI Tips
    tips: {
        getDaily: async (context?: string): Promise<DailyTipResponse> => {
            const params = context ? { context } : {};
            const response = await apiClient.get<DailyTipResponse>('/api/tips/daily', { params });
            return response.data;
        },

        getSynergy: async (targetUserId: number): Promise<SynergyTipResponse> => {
            const response = await apiClient.get<SynergyTipResponse>(`/api/tips/synergy/${targetUserId}`);
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

    // Admin
    admin: {
        listQueries: async (): Promise<QueryReview[]> => {
            const response = await apiClient.get<QueryReview[]>('/api/admin/queries');
            return response.data;
        },

        reviewAnswer: async (answerId: number, status: 'approved' | 'rejected', edited_text?: string) => {
            const response = await apiClient.patch(`/api/admin/answers/${answerId}`, {
                status,
                edited_text,
            });
            return response.data;
        },

        getSettings: async (): Promise<AdminSettings> => {
            const response = await apiClient.get<AdminSettings>('/api/admin/settings');
            return response.data;
        },

        updateSettings: async (settings: AdminSettingUpdate[]) => {
            const response = await apiClient.patch<AdminSettings>('/api/admin/settings', settings);
            return response.data;
        },

        listKnowledge: async (section?: string): Promise<KnowledgeItem[]> => {
            const response = await apiClient.get<KnowledgeItem[]>('/api/admin/knowledge', {
                params: section ? { section } : undefined,
            });
            return response.data;
        },

        createKnowledge: async (
            payload: {
                title: string;
                category: string;
                tags: string[];
                section: string;
                content: string;
                language?: string;
                metadata_json?: Record<string, unknown>;
            }
        ) => {
            const response = await apiClient.post<KnowledgeItem>('/api/admin/knowledge', {
                title: payload.title,
                category: payload.category,
                tags: payload.tags,
                section: payload.section,
                content: payload.content,
                language: payload.language ?? 'pl',
                metadata_json: payload.metadata_json ?? {},
            });
            return response.data;
        },

        updateKnowledge: async (
            knowledgeId: number,
            payload: {
                title?: string;
                category?: string;
                tags?: string[];
                section?: string;
                content?: string;
                language?: string;
                is_active?: boolean;
                metadata_json?: Record<string, unknown>;
            }
        ) => {
            const response = await apiClient.patch<KnowledgeItem>(`/api/admin/knowledge/${knowledgeId}`, payload);
            return response.data;
        },

        // Admin: Users Management
        getUsers: async (): Promise<User[]> => {
            const response = await apiClient.get<User[]>('/api/admin/users');
            return response.data;
        },
        createUser: async (data: {
            email: string;
            password: string;
            full_name: string;
            role: 'admin' | 'manager' | 'coach' | 'user';
            organization_id?: number | null;
        }): Promise<User> => {
            const response = await apiClient.post<User>('/api/admin/users', data);
            return response.data;
        },
        updateUserRole: async (userId: number, role: 'admin' | 'manager' | 'coach' | 'user'): Promise<User> => {
            const response = await apiClient.patch<User>(`/api/admin/users/${userId}/role`, { role });
            return response.data;
        },
        getOrganizations: async (): Promise<Organization[]> => {
            const response = await apiClient.get<Organization[]>('/api/admin/organizations');
            return response.data;
        },
        toggleOrganizationAccess: async (userId: number, organizationId: number, hasAccess: boolean): Promise<number[]> => {
            const response = await apiClient.post<number[]>(`/api/admin/users/${userId}/organization-access`, {
                organization_id: organizationId,
                has_access: hasAccess
            });
            return response.data;
        },
        updateUser: async (userId: number, data: Partial<UserUpdateData & { is_active?: boolean }>): Promise<User> => {
            const response = await apiClient.patch<User>(`/api/admin/users/${userId}`, data);
            return response.data;
        },
        deleteUser: async (userId: number): Promise<void> => {
            await apiClient.delete(`/api/admin/users/${userId}`);
        },

        // Admin: Talent content (CMS)
        listTalents: async (): Promise<AdminTalent[]> => {
            const response = await apiClient.get<AdminTalent[]>('/api/admin/talents');
            return response.data;
        },
        updateTalentTranslation: async (
            talentId: number,
            language: string,
            data: { name?: string; short_description?: string; description?: string },
        ): Promise<TalentTranslation> => {
            const response = await apiClient.patch<TalentTranslation>(
                `/api/admin/talents/${talentId}/translations/${language}`,
                data,
            );
            return response.data;
        },
    },

    // QA v1
    qa: {
        query: async (data: { context: string; question: string; target_user_id?: number; language?: string }): Promise<QAQueryResponse> => {
            const response = await apiClient.post<QAQueryResponse>('/api/v1/qa/query', data);
            return response.data;
        },

        submitFeedback: async (feedback: QAFeedbackRequest) => {
            const response = await apiClient.post('/api/v1/qa/feedback', feedback);
            return response.data;
        },

        getHistory: async (): Promise<QAHistoryItem[]> => {
            const response = await apiClient.get<QAHistoryItem[]>('/api/v1/qa/history');
            return response.data;
        },
    },

    // Compare
    compare: {
        users: async (userAId: number, userBId: number, language: string = 'pl'): Promise<CompareResponse> => {
            const response = await apiClient.get<CompareResponse>(`/api/compare/${userAId}/${userBId}`, {
                params: { language },
            });
            return response.data;
        },
    },

    // Public
    public: {
        getProfile: async (slugOrToken: string) => {
            const response = await apiClient.get(`/api/public/${slugOrToken}`);
            return response.data;
        },
        getPresentation: async (token: string) => {
            const response = await apiClient.get(`/api/public/presentations/${token}`);
            return response.data;
        },
    },

    // Dashboard aggregate (one call replaces 1 + N user-talent fetches)
    dashboard: {
        overview: async (): Promise<DashboardOverview> => {
            const response = await apiClient.get<DashboardOverview>('/api/dashboard/overview');
            return response.data;
        },
        coachOverview: async (): Promise<CoachDashboardOverview> => {
            const response = await apiClient.get<CoachDashboardOverview>('/api/dashboard/coach-overview');
            return response.data;
        },
    },

    tokenManager,
};

export default apiClient;

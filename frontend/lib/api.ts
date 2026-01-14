type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const safeJsonParse = (value: string | null) => {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

export const tokenManager = {
    getToken(): string | null {
        if (typeof window === "undefined") return null;
        return window.localStorage.getItem("tp_token");
    },
    setToken(token: string) {
        if (typeof window === "undefined") return;
        window.localStorage.setItem("tp_token", token);
    },
    removeToken() {
        if (typeof window === "undefined") return;
        window.localStorage.removeItem("tp_token");
        window.localStorage.removeItem("tp_user");
    },
    setUser(user: unknown) {
        if (typeof window === "undefined") return;
        window.localStorage.setItem("tp_user", JSON.stringify(user));
    },
    getUser<T = unknown>(): T | null {
        if (typeof window === "undefined") return null;
        return safeJsonParse(window.localStorage.getItem("tp_user"));
    },
};

const request = async <T>(
    path: string,
    method: HttpMethod = "GET",
    body?: unknown,
    authenticated = true
): Promise<T> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    if (authenticated) {
        const token = tokenManager.getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    }

    const response = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = typeof data === "string" ? data : data.detail || "Request failed";
        throw new Error(message);
    }

    return data as T;
};

export const api = {
    auth: {
        login: (payload: { email: string; password: string }) =>
            request<{ access_token: string; token_type: string }>(
                "/api/auth/login",
                "POST",
                payload,
                false
            ),
        register: (payload: {
            email: string;
            password: string;
            full_name: string;
            organization_name: string;
        }) =>
            request<{ access_token: string; token_type: string }>(
                "/api/auth/register",
                "POST",
                payload,
                false
            ),
        getCurrentUser: () => request("/api/auth/me"),
    },
    teams: {
        list: () => request("/api/teams"),
        get: (teamId: number) => request(`/api/teams/${teamId}`),
    },
    users: {
        list: (teamId?: number) =>
            request(teamId ? `/api/users?team_id=${teamId}` : "/api/users"),
        get: (userId: number) => request(`/api/users/${userId}`),
    },
    talents: {
        list: () => request("/api/talents", "GET", undefined, false),
        getUserTalents: (userId: number) =>
            request(`/api/users/${userId}/talents`),
        updateOrderNumbers: (
            updates: { name: string; order_number: number | null }[]
        ) => request("/api/talents/order-numbers", "PUT", updates),
    },
};

const TOKEN_KEY = 'murasalat_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handle(res: Response) {
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new Event('murasalat:unauthorized'));
    }
    throw new ApiError(data?.error || 'حدث خطأ في الاتصال بالخادم', res.status);
  }
  return data;
}

function headers(auth = true): HeadersInit {
  const h: Record<string, string> = {};
  const token = getToken();
  if (auth && token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export const api = {
  async get<T = any>(path: string): Promise<T> {
    const res = await fetch(path, { headers: headers() });
    return handle(res);
  },

  async post<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handle(res);
  },

  async put<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(path, {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handle(res);
  },

  async del<T = any>(path: string): Promise<T> {
    const res = await fetch(path, {
      method: 'DELETE',
      headers: headers(),
    });
    return handle(res);
  },

  async postForm<T = any>(path: string, form: FormData): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: headers(),
      body: form,
    });
    return handle(res);
  },

  async download(path: string, fileName: string) {
    const res = await fetch(path, { headers: headers() });
    if (!res.ok) {
      let msg = 'تعذر تنزيل المرفق';
      try {
        const d = await res.json();
        msg = d.error || msg;
      } catch { /* ignore */ }
      throw new ApiError(msg, res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // جلب المرفق بصلاحية المصادقة وفتحه للمعاينة في تبويب جديد (PDF/صور/نصوص)
  async blobUrl(path: string): Promise<string> {
    const res = await fetch(path, { headers: headers() });
    if (!res.ok) {
      let msg = 'تعذر فتح المرفق';
      try {
        const d = await res.json();
        msg = d.error || msg;
      } catch { /* ignore */ }
      throw new ApiError(msg, res.status);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};

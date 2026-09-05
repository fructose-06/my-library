export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

class ApiService {
  private token: string | null = localStorage.getItem('unilib_token');

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('unilib_token', token);
    } else {
      localStorage.removeItem('unilib_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers,
      });

      const data = await response.json();
      if (!response.ok && data.error) {
        return {
          success: false,
          error: data.error,
        };
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Unable to connect to UniLib Core backend API',
        },
      };
    }
  }

  // --- Auth ---
  async login(identifier: string, password: string = 'password123') {
    const res = await this.request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  async getMe() {
    return this.request<{ user: any; standing: any }>('/api/auth/me');
  }

  // --- Catalog ---
  async getBooks(params: { query?: string; category?: string; available_only?: boolean; limit?: number; offset?: number } = {}) {
    const q = new URLSearchParams();
    if (params.query) q.set('query', params.query);
    if (params.category) q.set('category', params.category);
    if (params.available_only) q.set('available_only', 'true');
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.offset) q.set('offset', params.offset.toString());

    return this.request<any[]>(`/api/books?${q.toString()}`);
  }

  async getBookById(id: string) {
    return this.request<any>(`/api/books/${id}`);
  }

  async createBook(data: { isbn: string; title: string; description?: string; publisher?: string; publication_year?: number; authors?: string[]; categories?: string[] }) {
    return this.request<any>('/api/books', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addPhysicalCopy(bookId: string, data: { barcode: string; acquisition_price: number; status?: string }) {
    return this.request<any>(`/api/books/${bookId}/copies`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Circulation ---
  async borrowBook(barcode: string, borrowerId?: string) {
    return this.request<any>('/api/circulation/borrow', {
      method: 'POST',
      body: JSON.stringify({ barcode, borrower_id: borrowerId }),
    });
  }

  async returnBook(loanId: string, condition: string = 'NORMAL', returnDate?: string) {
    return this.request<any>('/api/circulation/return', {
      method: 'POST',
      body: JSON.stringify({ loan_id: loanId, condition, return_date: returnDate }),
    });
  }

  async renewLoan(loanId: string) {
    return this.request<any>(`/api/circulation/renew/${loanId}`, {
      method: 'POST',
    });
  }

  async confirmLost(loanId: string, confirmDate?: string) {
    return this.request<any>('/api/circulation/confirm-lost', {
      method: 'POST',
      body: JSON.stringify({ loan_id: loanId, confirm_date: confirmDate }),
    });
  }

  async getMyLoans() {
    return this.request<any[]>('/api/circulation/my-loans');
  }

  async getMyHistory() {
    return this.request<any[]>('/api/circulation/my-history');
  }

  // --- Reservations ---
  async createReservation(bookId: string) {
    return this.request<any>('/api/reservations', {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId }),
    });
  }

  async cancelReservation(id: string) {
    return this.request<any>(`/api/reservations/${id}/cancel`, {
      method: 'POST',
    });
  }

  async getMyReservations() {
    return this.request<any[]>('/api/reservations/my-reservations');
  }

  // --- Fines ---
  async getMyFines() {
    return this.request<{ outstanding_balance: number; charges: any[]; payments: any[]; waivers: any[] }>('/api/fines/my-fines');
  }

  async payFine(userId: string, amount: number, notes?: string) {
    return this.request<any>('/api/fines/pay', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, amount, notes }),
    });
  }

  async waiveFine(userId: string, amount: number, reason: string) {
    return this.request<any>('/api/fines/waive', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, amount, reason }),
    });
  }

  // --- Admin & Reports ---
  async listUsers(search?: string) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<any[]>(`/api/admin/users${q}`);
  }

  async updateUserStatus(userId: string, status: 'ACTIVE' | 'DISABLED') {
    return this.request<any>(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async updateUserRole(userId: string, role: string) {
    return this.request<any>(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async getAuditLogs(params: { limit?: number; offset?: number } = {}) {
    return this.request<any[]>(`/api/admin/audit-logs?limit=${params.limit || 50}&offset=${params.offset || 0}`);
  }

  async getOverdueReport() {
    return this.request<any[]>('/api/reports/overdue');
  }

  async getInventoryReport() {
    return this.request<{ status: string; count: number }[]>('/api/reports/inventory');
  }

  async getPopularBooksReport() {
    return this.request<any[]>('/api/reports/popular-books');
  }

  async getOutstandingFinesReport() {
    return this.request<any[]>('/api/reports/outstanding-fines');
  }
}

export const api = new ApiService();

import { api } from '../services/api.js';

export interface PresetAccount {
  name: string;
  email: string;
  role: 'STUDENT' | 'LECTURER' | 'LIBRARIAN' | 'ADMIN';
  icon: string;
}

export const PRESET_ACCOUNTS: PresetAccount[] = [
  { name: 'Student 1', email: 'student1@unilib.ac.th', role: 'STUDENT', icon: '🎓' },
  { name: 'Student 2', email: 'student2@unilib.ac.th', role: 'STUDENT', icon: '🎓' },
  { name: 'Lecturer', email: 'lecturer1@unilib.ac.th', role: 'LECTURER', icon: '👨‍🏫' },
  { name: 'Librarian', email: 'librarian@unilib.ac.th', role: 'LIBRARIAN', icon: '📚' },
  { name: 'Admin', email: 'admin@unilib.ac.th', role: 'ADMIN', icon: '🛡️' },
];

export type ViewType = 'catalog' | 'circulation' | 'reservations' | 'fines' | 'librarian' | 'admin';

class AppStore {
  public currentUser: any = null;
  public userStanding: any = null;
  public currentView: ViewType = 'catalog';
  private listeners: (() => void)[] = [];

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  async setAccountByEmail(email: string) {
    showToast(`Switching to ${email}...`, 'info');
    const res = await api.login(email, 'password123');
    if (res.success && res.data) {
      await this.refreshUser();
      showToast(`Logged in as ${this.currentUser.full_name} (${this.currentUser.role})`, 'success');
      this.notify();
    } else {
      showToast(res.error?.message || 'Login failed', 'error');
    }
  }

  async refreshUser() {
    const res = await api.getMe();
    if (res.success && res.data) {
      this.currentUser = res.data.user;
      this.userStanding = res.data.standing;
    } else {
      this.currentUser = null;
      this.userStanding = null;
    }
    this.notify();
  }

  setView(view: ViewType) {
    this.currentView = view;
    this.notify();
  }
}

export const store = new AppStore();

// --- Toast System ---
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- Modal System ---
export function openModal(title: string, contentHtml: string, onConfirm?: (formData: Record<string, any>) => void) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body" id="modal-form-content">
          ${contentHtml}
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'modal-backdrop') {
      closeModal();
    }
  });

  const form = document.querySelector('#modal-form-content form') as HTMLFormElement;
  if (form && onConfirm) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data: Record<string, any> = {};
      formData.forEach((val, key) => (data[key] = val));
      onConfirm(data);
      closeModal();
    });
  }
}

export function closeModal() {
  const container = document.getElementById('modal-container');
  if (container) {
    container.innerHTML = '';
  }
}

import { store, PRESET_ACCOUNTS, ViewType } from './state/store.js';
import { renderCatalogView } from './views/catalog.view.js';
import { renderCirculationView } from './views/circulation.view.js';
import { renderReservationsView } from './views/reservations.view.js';
import { renderFinesView } from './views/fines.view.js';
import { renderLibrarianView } from './views/librarian.view.js';
import { renderAdminView } from './views/admin.view.js';

const appElement = document.getElementById('app')!;

function renderLayout() {
  const user = store.currentUser;
  const role = user?.role || 'STUDENT';

  appElement.innerHTML = `
    <!-- Top Quick Role Switcher Bar -->
    <header class="role-bar">
      <div class="role-bar-title">
        <span>⚡ Quick Role Switcher:</span>
      </div>
      <div class="role-chips">
        ${PRESET_ACCOUNTS.map((acc) => {
          const isActive = user?.email === acc.email;
          return `
            <button class="role-chip ${isActive ? 'active' : ''}" data-email="${acc.email}">
              <span>${acc.icon}</span>
              <span>${acc.name}</span>
            </button>
          `;
        }).join('')}
      </div>
    </header>

    <div class="app-container">
      <!-- Sidebar Navigation -->
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-icon">🏛️</div>
          <div class="brand-text">
            <h1>UniLib Core</h1>
            <span>Enterprise Edition</span>
          </div>
        </div>

        <nav class="nav-menu">
          <div class="nav-category">Main Library</div>
          <button class="nav-item ${store.currentView === 'catalog' ? 'active' : ''}" data-view="catalog">
            <span class="icon">📚</span>
            <span>Book Catalog</span>
          </button>
          <button class="nav-item ${store.currentView === 'circulation' ? 'active' : ''}" data-view="circulation">
            <span class="icon">🔄</span>
            <span>My Loans</span>
          </button>
          <button class="nav-item ${store.currentView === 'reservations' ? 'active' : ''}" data-view="reservations">
            <span class="icon">⏳</span>
            <span>My Reservations</span>
          </button>
          <button class="nav-item ${store.currentView === 'fines' ? 'active' : ''}" data-view="fines">
            <span class="icon">💳</span>
            <span>Fines & Ledger</span>
          </button>

          ${
            role === 'LIBRARIAN'
              ? `
              <div class="nav-category">Staff Counter</div>
              <button class="nav-item ${store.currentView === 'librarian' ? 'active' : ''}" data-view="librarian">
                <span class="icon">💼</span>
                <span>Librarian Desk</span>
              </button>
              `
              : ''
          }

          ${
            role === 'ADMIN'
              ? `
              <div class="nav-category">Governance</div>
              <button class="nav-item ${store.currentView === 'admin' ? 'active' : ''}" data-view="admin">
                <span class="icon">🛡️</span>
                <span>Admin Console</span>
              </button>
              `
              : ''
          }
        </nav>

        <!-- Current User Profile Footer -->
        <div class="user-profile-mini">
          <div class="avatar">${user?.full_name ? user.full_name.charAt(0) : 'U'}</div>
          <div class="user-info">
            <div class="user-name">${user?.full_name || 'Anonymous'}</div>
            <div class="user-role-badge badge-${(user?.role || 'student').toLowerCase()}">${user?.role || 'STUDENT'}</div>
          </div>
        </div>
      </aside>

      <!-- Dynamic View Container -->
      <main class="main-content" id="view-mount"></main>
    </div>
  `;

  // Attach Role Switcher Listeners
  appElement.querySelectorAll('.role-chip').forEach((chip) => {
    chip.addEventListener('click', async (e) => {
      const email = (e.currentTarget as HTMLElement).getAttribute('data-email')!;
      await store.setAccountByEmail(email);
    });
  });

  // Attach Navigation Listeners
  appElement.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const view = (e.currentTarget as HTMLElement).getAttribute('data-view')! as ViewType;
      store.setView(view);
    });
  });

  // Mount Current View
  const viewMount = document.getElementById('view-mount')!;
  switch (store.currentView) {
    case 'catalog':
      renderCatalogView(viewMount);
      break;
    case 'circulation':
      renderCirculationView(viewMount);
      break;
    case 'reservations':
      renderReservationsView(viewMount);
      break;
    case 'fines':
      renderFinesView(viewMount);
      break;
    case 'librarian':
      renderLibrarianView(viewMount);
      break;
    case 'admin':
      renderAdminView(viewMount);
      break;
    default:
      renderCatalogView(viewMount);
  }
}

// Subscribe to store changes to re-render layout
store.subscribe(renderLayout);

// Bootstrap: login as default student or verify existing token
async function bootstrap() {
  await store.refreshUser();
  if (!store.currentUser) {
    await store.setAccountByEmail('student1@unilib.ac.th');
  } else {
    renderLayout();
  }
}

bootstrap();

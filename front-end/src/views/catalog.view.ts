import { api } from '../services/api.js';
import { store, showToast, openModal, closeModal } from '../state/store.js';

export async function renderCatalogView(container: HTMLElement) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>📚 Library Book Catalog</h2>
        <p>Explore over 100,000 titles, check real-time copy availability, and borrow or reserve books.</p>
      </div>
      ${
        store.currentUser?.role === 'LIBRARIAN' || store.currentUser?.role === 'ADMIN'
          ? `<button class="btn btn-primary" id="btn-add-book">➕ Add New Book</button>`
          : ''
      }
    </div>

    <!-- Search & Filter Bar -->
    <div class="search-filter-bar">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input type="text" id="catalog-search" placeholder="Search by title, author, or ISBN-13..." />
      </div>
      <select class="filter-select" id="catalog-category-filter">
        <option value="">All Categories</option>
        <option value="Software Engineering">Software Engineering</option>
        <option value="Databases">Databases & Distributed Systems</option>
        <option value="Computer Science">Computer Science</option>
      </select>
      <label style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary); cursor: pointer; font-size: 0.9rem;">
        <input type="checkbox" id="catalog-avail-only" />
        Available only
      </label>
    </div>

    <!-- Book Grid Container -->
    <div class="book-grid" id="books-container">
      <div style="color: var(--text-muted); padding: 40px; text-align: center; grid-column: 1/-1;">
        Loading catalog...
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#catalog-search') as HTMLInputElement;
  const categoryFilter = container.querySelector('#catalog-category-filter') as HTMLSelectElement;
  const availOnly = container.querySelector('#catalog-avail-only') as HTMLInputElement;
  const booksContainer = container.querySelector('#books-container') as HTMLElement;

  async function loadBooks() {
    booksContainer.innerHTML = `<div style="color: var(--text-muted); padding: 40px; text-align: center; grid-column: 1/-1;">Searching books...</div>`;

    const res = await api.getBooks({
      query: searchInput.value.trim(),
      category: categoryFilter.value,
      available_only: availOnly.checked,
      limit: 30,
    });

    if (!res.success || !res.data || res.data.length === 0) {
      booksContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; grid-column: 1/-1; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">📖</div>
          <h3>No books found matching your criteria</h3>
          <p style="font-size: 0.85rem; margin-top: 4px;">Try adjusting your keywords or clearing the availability filter.</p>
        </div>
      `;
      return;
    }

    booksContainer.innerHTML = res.data
      .map((b) => {
        const isAvailable = b.available_copies_count > 0;
        const authors = b.authors && b.authors.length > 0 ? b.authors.join(', ') : 'Unknown Author';
        const categories = b.categories && b.categories.length > 0 ? b.categories.join(' • ') : 'General';

        return `
        <div class="book-card">
          <div class="book-badge-avail ${isAvailable ? 'badge-in-stock' : 'badge-out-stock'}">
            ${isAvailable ? `🟢 ${b.available_copies_count}/${b.total_copies_count} Available` : `🔴 0/${b.total_copies_count} Available`}
          </div>
          <div>
            <div class="book-meta">${categories}</div>
            <div class="book-title">${b.title}</div>
            <div class="book-author">✍️ ${authors}</div>
            <div class="book-desc">${b.description || 'No description provided.'}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 14px;">
              ISBN: <code>${b.isbn}</code>
            </div>
          </div>
          <div class="book-actions">
            <button class="btn btn-secondary btn-sm btn-view-copies" data-book-id="${b.id}">
              🔍 View Copies (${b.total_copies_count})
            </button>
            ${
              store.currentUser?.role === 'ADMIN'
                ? `<span style="font-size: 0.78rem; color: var(--text-muted); align-self: center; padding: 4px 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">🛡️ Admin (Governance)</span>`
                : store.currentUser?.role === 'LIBRARIAN'
                ? (isAvailable
                  ? `<button class="btn btn-primary btn-sm btn-borrow-book" data-book-id="${b.id}" data-book-title="${b.title}">
                      ⚡ Borrow on Behalf
                     </button>`
                  : `<span style="font-size: 0.78rem; color: var(--text-muted); align-self: center; padding: 4px 8px;">⏳ All Copies On Loan</span>`)
                : isAvailable
                ? `<button class="btn btn-primary btn-sm btn-borrow-book" data-book-id="${b.id}" data-book-title="${b.title}">
                    ⚡ Borrow
                   </button>`
                : `<button class="btn btn-warning btn-sm btn-reserve-book" data-book-id="${b.id}">
                    ⏳ Reserve (Queue)
                   </button>`
            }
          </div>
        </div>
      `;
      })
      .join('');

    // Attach button listeners
    booksContainer.querySelectorAll('.btn-view-copies').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const bookId = (e.currentTarget as HTMLElement).getAttribute('data-book-id')!;
        showCopiesModal(bookId);
      });
    });

    booksContainer.querySelectorAll('.btn-borrow-book').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const bookId = (e.currentTarget as HTMLElement).getAttribute('data-book-id')!;
        const bookTitle = (e.currentTarget as HTMLElement).getAttribute('data-book-title')!;
        showBorrowModal(bookId, bookTitle);
      });
    });

    booksContainer.querySelectorAll('.btn-reserve-book').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const bookId = (e.currentTarget as HTMLElement).getAttribute('data-book-id')!;
        await handleReserve(bookId);
      });
    });
  }

  // Handle Search Input with debounce
  let debounceTimeout: any;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(loadBooks, 300);
  });
  categoryFilter.addEventListener('change', loadBooks);
  availOnly.addEventListener('change', loadBooks);

  // Add Book button (Librarian/Admin)
  container.querySelector('#btn-add-book')?.addEventListener('click', () => {
    openModal(
      'Register New Book',
      `
      <form id="add-book-form">
        <div class="form-group">
          <label>ISBN-13 *</label>
          <input type="text" name="isbn" placeholder="e.g. 9780134494166" required />
        </div>
        <div class="form-group">
          <label>Book Title *</label>
          <input type="text" name="title" placeholder="Title of the publication" required />
        </div>
        <div class="form-group">
          <label>Authors (comma separated)</label>
          <input type="text" name="authors" placeholder="Robert C. Martin, Martin Kleppmann" />
        </div>
        <div class="form-group">
          <label>Categories (comma separated)</label>
          <input type="text" name="categories" placeholder="Software Engineering, Databases" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="3" placeholder="Brief book description..."></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-close-btn').click()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Book</button>
        </div>
      </form>
      `,
      async (data) => {
        const authors = data.authors ? data.authors.split(',').map((s: string) => s.trim()) : [];
        const categories = data.categories ? data.categories.split(',').map((s: string) => s.trim()) : [];

        const res = await api.createBook({
          isbn: data.isbn,
          title: data.title,
          description: data.description,
          authors,
          categories,
        });

        if (res.success) {
          showToast(`Book "${data.title}" created successfully!`, 'success');
          loadBooks();
        } else {
          showToast(res.error?.message || 'Failed to create book', 'error');
        }
      }
    );
  });

  async function showCopiesModal(bookId: string) {
    const res = await api.getBookById(bookId);
    if (!res.success || !res.data) {
      showToast('Failed to fetch book copies', 'error');
      return;
    }

    const b = res.data;
    const copiesHtml =
      b.copies && b.copies.length > 0
        ? `
        <div class="table-responsive" style="margin-top: 14px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Price (THB)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${b.copies
                .map((cp: any) => {
                  const statusClass = `status-${cp.status.toLowerCase().replace('_', '-')}`;
                  const canBorrow = cp.status === 'AVAILABLE';
                  return `
                  <tr>
                    <td><code>${cp.barcode}</code></td>
                    <td>฿${Number(cp.acquisition_price).toLocaleString()}</td>
                    <td><span class="status-pill ${statusClass}">${cp.status}</span></td>
                    <td>
                      ${
                        store.currentUser?.role === 'ADMIN'
                          ? `<span style="color: var(--text-muted); font-size: 0.8rem;">-</span>`
                          : canBorrow
                          ? `<button class="btn btn-primary btn-sm btn-borrow-copy" data-barcode="${cp.barcode}">Borrow</button>`
                          : `<span style="color: var(--text-muted); font-size: 0.8rem;">-</span>`
                      }
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `
        : `<p style="color: var(--text-muted); margin-top: 14px;">No physical copies registered for this book yet.</p>`;

    const addCopySection =
      store.currentUser?.role === 'LIBRARIAN' || store.currentUser?.role === 'ADMIN'
        ? `
        <div style="border-top: 1px solid var(--border-glass); margin-top: 20px; padding-top: 16px;">
          <h4 style="font-size: 0.95rem; margin-bottom: 10px;">➕ Add Physical Copy</h4>
          <form id="add-copy-form" style="display: flex; gap: 10px; align-items: flex-end;">
            <div style="flex: 2;">
              <label style="font-size: 0.75rem; color: var(--text-muted);">Unique Barcode</label>
              <input type="text" name="barcode" placeholder="e.g. CA-000006" required style="width: 100%; padding: 8px 12px; background: rgba(10,15,26,0.8); border: 1px solid var(--border-glass); border-radius: 6px; color: #fff;" />
            </div>
            <div style="flex: 1.5;">
              <label style="font-size: 0.75rem; color: var(--text-muted);">Price (THB)</label>
              <input type="number" step="0.01" name="acquisition_price" placeholder="950" required style="width: 100%; padding: 8px 12px; background: rgba(10,15,26,0.8); border: 1px solid var(--border-glass); border-radius: 6px; color: #fff;" />
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="padding: 9px 14px;">Add Copy</button>
          </form>
        </div>
      `
        : '';

    openModal(
      `Inventory: ${b.title}`,
      `
      <div>
        <p style="color: var(--text-secondary); font-size: 0.9rem;">ISBN: <code>${b.isbn}</code> • ${b.copies.length} Total Copies</p>
        ${copiesHtml}
        ${addCopySection}
      </div>
      `
    );

    // Attach borrow click for individual copy
    document.querySelectorAll('.btn-borrow-copy').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const barcode = (e.currentTarget as HTMLElement).getAttribute('data-barcode')!;
        closeModal();
        await handleBorrow(barcode);
      });
    });

    // Attach add copy submit
    const addCopyForm = document.getElementById('add-copy-form') as HTMLFormElement;
    if (addCopyForm) {
      addCopyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addCopyForm);
        const barcode = formData.get('barcode') as string;
        const price = parseFloat(formData.get('acquisition_price') as string);

        const res = await api.addPhysicalCopy(bookId, { barcode, acquisition_price: price });
        if (res.success) {
          showToast(`Physical copy ${barcode} added!`, 'success');
          closeModal();
          showCopiesModal(bookId);
          loadBooks();
        } else {
          showToast(res.error?.message || 'Failed to add copy', 'error');
        }
      });
    }
  }

  async function showBorrowModal(bookId: string, bookTitle: string) {
    const res = await api.getBookById(bookId);
    const availableCopies = res.data?.copies?.filter((c: any) => c.status === 'AVAILABLE') || [];

    if (availableCopies.length === 0) {
      showToast('No copies currently available to borrow', 'error');
      return;
    }

    const optionsHtml = availableCopies
      .map((c: any) => `<option value="${c.barcode}">${c.barcode} (฿${c.acquisition_price})</option>`)
      .join('');

    openModal(
      `Borrow Book: ${bookTitle}`,
      `
      <form id="borrow-form">
        <p style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 14px;">
          Select one of the currently available physical copies to borrow for 14 calendar days.
        </p>
        <div class="form-group">
          <label>Select Physical Copy Barcode *</label>
          <select name="barcode" class="filter-select" style="width: 100%;">
            ${optionsHtml}
          </select>
        </div>
        ${
          store.currentUser?.role === 'LIBRARIAN'
            ? `
            <div class="form-group">
              <label>Borrower ID (Student or Lecturer) *</label>
              <input type="text" name="borrower_id" placeholder="e.g. usr-stu-01 or 65010001" required style="width: 100%; padding: 10px 14px; background: rgba(10,15,26,0.8); border: 1px solid var(--border-glass); border-radius: 8px; color: #fff;" />
              <small style="color: var(--text-muted); font-size: 0.78rem; display: block; margin-top: 4px;">Librarians process circulation on behalf of students or lecturers only.</small>
            </div>
            `
            : ''
        }
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-close-btn').click()">Cancel</button>
          <button type="submit" class="btn btn-primary">Confirm Borrow</button>
        </div>
      </form>
      `,
      async (data) => {
        await handleBorrow(data.barcode, data.borrower_id);
      }
    );
  }

  async function handleBorrow(barcode: string, borrowerId?: string) {
    showToast(`Processing borrow for ${barcode}...`, 'info');
    const res = await api.borrowBook(barcode, borrowerId);

    if (res.success) {
      showToast(`Successfully borrowed copy ${barcode}! Due in 14 days.`, 'success');
      await store.refreshUser();
      loadBooks();
    } else {
      showToast(res.error?.message || 'Borrow failed', 'error');
    }
  }

  async function handleReserve(bookId: string) {
    showToast('Creating reservation...', 'info');
    const res = await api.createReservation(bookId);

    if (res.success) {
      showToast(`Reservation created! You are queue position #${res.data?.queue_position}`, 'success');
      loadBooks();
    } else {
      showToast(res.error?.message || 'Reservation failed', 'error');
    }
  }

  // Initial Load
  loadBooks();
}

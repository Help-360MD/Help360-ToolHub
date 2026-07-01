/**
 * Help360MD Tools Hub - Client Script
 * File: script.js
 */

// ==========================================================================
// CONFIGURATION
// ==========================================================================
// Paste your Google Apps Script Web App URL here after deployment.
// If left as "YOUR_APPS_SCRIPT_WEB_APP_URL" or empty, the application
// will automatically run in "Demo Mode" using browser localStorage.
const API_URL = "https://script.google.com/macros/s/AKfycbyK0kZqTTvzUGhUaDwPCugiZPuzrZFufmC0qgFxihn35gH8QJlavDEKFnMEi3ZCM0Vnxg/exec";

// ==========================================================================
// DATABASE / DEMO MODE FALLBACK
// ==========================================================================
const isDemoMode = !API_URL || API_URL.includes("YOUR_APPS_SCRIPT_WEB_APP_URL");

// Initialize Mock Database in localStorage if in Demo Mode
if (isDemoMode) {
  console.warn("Help360MD Tools Hub is running in Demo Mode (localStorage). Configure API_URL in script.js to connect to Google Sheets.");
  
  if (!localStorage.getItem('db_users')) {
    localStorage.setItem('db_users', JSON.stringify([
      { Username: "alan", Password: "123", FullName: "Alan Wake", Role: "Admin", Status: "Active", LastLogin: "" },
      { Username: "awais", Password: "abc", FullName: "Awais Raza", Role: "User", Status: "Active", LastLogin: "" }
    ]));
  }
  
  if (!localStorage.getItem('db_tools')) {
    localStorage.setItem('db_tools', JSON.stringify([
      { ToolName: "Vaccine Eligibility Tool", Description: "USCIS Vaccine Eligibility Verification Tool", URL: "https://help-360md.github.io/VaccinesEligiblitytool/", Icon: "fas fa-shield-halved", Status: "Active", Category: "Clinical" },
      { ToolName: "Cash Log", Description: "Patient Cash Collection Tracking System", URL: "https://help-360md.github.io/Cash-Log/", Icon: "fas fa-wallet", Status: "Active", Category: "Finance" },
      { ToolName: "Roaster Pro", Description: "Staff Scheduling and Workforce Management", URL: "https://help-360md.github.io/Roasterpro/", Icon: "fas fa-calendar-days", Status: "Active", Category: "Operations" }
    ]));
  }
  
  if (!localStorage.getItem('db_favorites')) {
    localStorage.setItem('db_favorites', JSON.stringify([]));
  }
  
  if (!localStorage.getItem('db_logs')) {
    localStorage.setItem('db_logs', JSON.stringify([]));
  }
}

// ==========================================================================
// TOOL NORMALIZATION (Failsafe for Sheets Header discrepancies)
// ==========================================================================
function normalizeTool(tool) {
  if (!tool) return null;
  return {
    ToolName: tool.ToolName || tool["Tool Name"] || "Unnamed Tool",
    Description: tool.Description || tool.description || "",
    URL: tool.URL || tool.url || "",
    Icon: tool.Icon || tool["Font Awesome Icon Class"] || tool.icon || "fas fa-link",
    Status: tool.Status || tool.status || "Active",
    Category: tool.Category || tool.category || "General"
  };
}

// ==========================================================================
// CENTRAL REQUEST CONTROLLER (CORS Bypass)
// ==========================================================================
async function fetchAPI(action, payload = {}) {
  // If running in Demo Mode, route to localStorage handlers
  if (isDemoMode) {
    return handleDemoAPI(action, payload);
  }

  // Live Mode: Inject current session parameters for authorization validation on Apps Script side
  const session = getUserSession();
  const requestPayload = {
    action: action,
    sessionUser: session ? session.Username : null,
    sessionPass: session ? session.Token : null, // password is used as token
    userAgent: navigator.userAgent,
    ...payload
  };

  try {
    // Content-Type: 'text/plain' triggers a "simple request", avoiding CORS OPTIONS preflight
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if server rejected authorization
    if (data.status === "unauthorized") {
      destroyUserSession();
      window.location.replace("login.html");
      return { status: "error", message: "Session expired. Please log in again." };
    }

    return data;
  } catch (error) {
    console.error("API Fetch Error:", error);
    return { status: "error", message: "Network connection failed. Please check backend setup." };
  }
}

// ==========================================================================
// SESSION MANAGEMENT
// ==========================================================================
function getUserSession() {
  const session = sessionStorage.getItem('help360_user');
  return session ? JSON.parse(session) : null;
}

function saveUserSession(userData) {
  sessionStorage.setItem('help360_user', JSON.stringify(userData));
}

function destroyUserSession() {
  sessionStorage.removeItem('help360_user');
}

function handleLogout(e) {
  if (e) e.preventDefault();
  destroyUserSession();
  window.location.replace('login.html');
}

// Global responsive navbar toggles
function toggleSidebar() {
  document.body.classList.toggle('sidebar-collapsed');
}

function toggleMobileSidebar() {
  document.body.classList.toggle('sidebar-active');
}

// Initialize layout elements for authenticated pages
function setupLayout(user) {
  // Hide or show admin links
  const adminLinks = document.querySelectorAll('.admin-only');
  adminLinks.forEach(link => {
    if (user.Role === 'Admin') {
      link.style.display = 'block';
    } else {
      link.style.display = 'none';
    }
  });

  // Display user info in headers
  const userNameEl = document.getElementById('headerUserName');
  const userRoleEl = document.getElementById('headerUserRole');
  const avatarEl = document.getElementById('headerAvatar');

  if (userNameEl) userNameEl.textContent = user.FullName;
  if (userRoleEl) userRoleEl.textContent = user.Role;
  if (avatarEl) avatarEl.textContent = user.FullName.charAt(0).toUpperCase();

  // Show hamburger menu on responsive widths
  const hamburger = document.getElementById('mobileHamburger');
  if (hamburger) {
    if (window.innerWidth <= 768) {
      hamburger.style.display = 'flex';
    }
    window.addEventListener('resize', () => {
      if (window.innerWidth <= 768) {
        hamburger.style.display = 'flex';
      } else {
        hamburger.style.display = 'none';
        document.body.classList.remove('sidebar-active');
      }
    });
  }
}

// Password show/hide toggle
function togglePasswordVisibility(fieldId, btn) {
  const input = document.getElementById(fieldId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// ==========================================================================
// TOAST NOTIFICATIONS & LOADERS
// ==========================================================================
function showToast(message, type = "success") {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = "fa-circle-check";
  if (type === "error") icon = "fa-circle-xmark";
  if (type === "warning") icon = "fa-triangle-exclamation";

  toast.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Animate and Remove
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showLoading(show, text = "Loading...") {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;

  const textEl = overlay.querySelector('.spinner-text');
  if (textEl) textEl.textContent = text;

  if (show) {
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

// ==========================================================================
// PAGE MODULES: 1. LOGIN PAGE
// ==========================================================================
async function handleLoginSubmit(event) {
  event.preventDefault();
  
  const usernameEl = document.getElementById('username');
  const passwordEl = document.getElementById('password');
  const errorAlert = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');

  if (!usernameEl || !passwordEl) return;

  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  errorAlert.style.display = 'none';
  showLoading(true, "Authenticating credentials...");

  const response = await fetchAPI("login", {
    username: username,
    password: password
  });

  showLoading(false);

  if (response.status === "success") {
    saveUserSession(response.user);
    window.location.replace("dashboard.html");
  } else {
    errorMessage.textContent = response.message || "Invalid username or password";
    errorAlert.style.display = 'flex';
    passwordEl.value = "";
    showToast(response.message || "Login failed", "error");
  }
}

// ==========================================================================
// PAGE MODULES: 2. DASHBOARD
// ==========================================================================
let allTools = [];
let userFavorites = [];
let currentCategory = "All";

async function initDashboard() {
  const user = getUserSession();
  if (!user) return;

  setupLayout(user);

  // Load active tools and favorites
  showLoading(true, "Loading tool library...");
  const response = await fetchAPI("getDashboardData");
  showLoading(false);

  if (response.status === "success") {
    allTools = (response.tools || []).map(normalizeTool);
    userFavorites = response.favorites || [];

    // Render filter chips
    renderCategoryFilters();

    // Render tools
    renderDashboard();

    // Check for focusSearch request from profile redirection
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('focusSearch') === 'true') {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.focus();
    }
  } else {
    showToast("Failed to fetch tools", "error");
  }
}

function renderCategoryFilters() {
  const container = document.getElementById('categoryFilters');
  if (!container) return;

  // Extract unique active categories
  const categories = new Set();
  allTools.forEach(t => {
    if (t.Category) categories.add(t.Category);
  });

  // Rebuild filter container starting with 'All'
  container.innerHTML = `<button class="filter-chip ${currentCategory === 'All' ? 'active' : ''}" onclick="filterByCategory('All')">All Tools</button>`;
  
  categories.forEach(cat => {
    container.innerHTML += `<button class="filter-chip ${currentCategory === cat ? 'active' : ''}" onclick="filterByCategory('${cat}')">${cat}</button>`;
  });
}

function filterByCategory(category) {
  currentCategory = category;
  
  // Highlight active filter chip
  const chips = document.querySelectorAll('.filter-chip');
  chips.forEach(chip => {
    if (chip.textContent.trim() === (category === 'All' ? 'All Tools' : category)) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  handleSearch();
}

function focusSearch(e) {
  e.preventDefault();
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.focus();
    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function handleSearch() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  
  // Filter active list based on category and query
  const filtered = allTools.filter(t => {
    const matchesCategory = currentCategory === "All" || t.Category === currentCategory;
    const matchesQuery = !query || 
      t.ToolName.toLowerCase().includes(query) || 
      (t.Category && t.Category.toLowerCase().includes(query)) ||
      (t.Description && t.Description.toLowerCase().includes(query));
      
    return matchesCategory && matchesQuery;
  });

  renderToolsGrid(filtered);
}

function renderDashboard() {
  renderToolsGrid(allTools);
}

function renderToolsGrid(toolsList) {
  const favoritesGrid = document.getElementById('favoritesGrid');
  const favoritesSection = document.getElementById('favoritesSection');
  const toolsGrid = document.getElementById('toolsGrid');

  if (!toolsGrid) return;

  // Separate favorites
  const favTools = toolsList.filter(t => userFavorites.includes(t.ToolName));
  const regularTools = toolsList; // Keep all tools in the main catalog, or filter them out of regular? The spec says: "Display favorite tools at the top." We'll render favorites section separately at the top and list all tools below.

  // Render Favorites Section
  if (favTools.length > 0) {
    favoritesSection.style.display = 'block';
    favoritesGrid.innerHTML = '';
    favTools.forEach(tool => {
      favoritesGrid.appendChild(createToolCard(tool, true));
    });
  } else {
    favoritesSection.style.display = 'none';
  }

  // Render All Tools Section
  if (toolsList.length > 0) {
    toolsGrid.innerHTML = '';
    toolsList.forEach(tool => {
      const isFav = userFavorites.includes(tool.ToolName);
      toolsGrid.appendChild(createToolCard(tool, isFav));
    });
  } else {
    toolsGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <h3>No Tools Found</h3>
        <p>No tools matched your search parameters. Try clearing the filters.</p>
      </div>
    `;
  }
}

function createToolCard(tool, isFav) {
  const card = document.createElement('div');
  card.className = 'tool-card';
  
  card.innerHTML = `
    <div class="card-top">
      <div class="tool-icon-wrapper">
        <i class="${tool.Icon || 'fas fa-link'}"></i>
      </div>
      <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${tool.ToolName}', this)" title="${isFav ? 'Remove from favorites' : 'Mark as favorite'}">
        <i class="${isFav ? 'fas' : 'far'} fa-star"></i>
      </button>
    </div>
    <span class="tool-category">${tool.Category || 'General'}</span>
    <h3 class="tool-name">${tool.ToolName}</h3>
    <p class="tool-desc">${tool.Description || 'No description provided'}</p>
    <div class="card-actions">
      <a href="${tool.URL}" target="_blank" class="btn btn-primary" style="flex-grow: 1;">
        <i class="fas fa-up-right-from-square"></i>
        <span>Open Tool</span>
      </a>
    </div>
  `;
  return card;
}

async function toggleFavorite(toolName, btn) {
  const isCurrentlyFav = btn.classList.contains('active');
  const newFavState = !isCurrentlyFav;

  // Optimistic UI updates
  if (newFavState) {
    userFavorites.push(toolName);
  } else {
    userFavorites = userFavorites.filter(name => name !== toolName);
  }
  
  // Update state immediately
  handleSearch();

  // Sync to database in background
  const response = await fetchAPI("saveFavorite", {
    toolName: toolName,
    isFavorite: newFavState
  });

  if (response.status !== "success") {
    showToast("Failed to update favorite status", "error");
    // Revert state if error
    if (newFavState) {
      userFavorites = userFavorites.filter(name => name !== toolName);
    } else {
      userFavorites.push(toolName);
    }
    handleSearch();
  } else {
    showToast(newFavState ? `Added ${toolName} to favorites` : `Removed ${toolName} from favorites`, "success");
  }
}

// ==========================================================================
// PAGE MODULES: 3. PROFILE PAGE
// ==========================================================================
function initProfile() {
  const user = getUserSession();
  if (!user) return;

  setupLayout(user);

  // Populate card details
  document.getElementById('profileFullName').textContent = user.FullName;
  document.getElementById('profileRoleBadge').textContent = user.Role;
  document.getElementById('profileUsername').textContent = user.Username;
  document.getElementById('profileRole').textContent = user.Role;
  document.getElementById('profileLastLogin').textContent = user.LastLogin || "Never logged in";
  
  const avatar = document.getElementById('profileAvatar');
  if (avatar) avatar.textContent = user.FullName.charAt(0).toUpperCase();
}

async function handleChangePassword(event) {
  event.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match", "error");
    return;
  }

  showLoading(true, "Updating database password...");
  const response = await fetchAPI("changePassword", {
    currentPassword: currentPassword,
    newPassword: newPassword
  });
  showLoading(false);

  if (response.status === "success") {
    showToast("Password changed successfully", "success");
    document.getElementById('changePasswordForm').reset();
    
    // Update token in sessionStorage
    const user = getUserSession();
    user.Token = newPassword;
    saveUserSession(user);
  } else {
    showToast(response.message || "Failed to change password", "error");
  }
}

// ==========================================================================
// PAGE MODULES: 4. ADMIN PANEL PAGE
// ==========================================================================
let adminUsers = [];
let adminTools = [];

async function initAdminPanel() {
  const user = getUserSession();
  if (!user) return;

  setupLayout(user);

  // Retrieve administration records
  await loadAdminData();
}

async function loadAdminData() {
  showLoading(true, "Fetching administrative records...");
  
  const usersRes = await fetchAPI("getUsers");
  const toolsRes = await fetchAPI("getDashboardData"); // Dashboard fetches all tools for admin
  const logsRes = await fetchAPI("getLoginHistory");

  showLoading(false);

  if (usersRes.status === "success") {
    adminUsers = usersRes.users || [];
    renderAdminUsers();
  }
  
  if (toolsRes.status === "success") {
    // In live mode, admin gets all tools. In demo mode getDashboardData returns active.
    // The server-side doGet/doPost returns all tools if admin role is authenticated.
    adminTools = (toolsRes.tools || []).map(normalizeTool);
    renderAdminTools();
  }

  if (logsRes.status === "success") {
    renderAdminLogs(logsRes.history || []);
  }

  updateMetrics();
}

function updateMetrics() {
  const totalUsersEl = document.getElementById('statTotalUsers');
  const totalToolsEl = document.getElementById('statTotalTools');
  const activeToolsEl = document.getElementById('statActiveTools');

  if (totalUsersEl) totalUsersEl.textContent = adminUsers.length;
  if (totalToolsEl) totalToolsEl.textContent = adminTools.length;
  
  const activeCount = adminTools.filter(t => t.Status === "Active").length;
  if (activeToolsEl) activeToolsEl.textContent = activeCount;
}

// Tab controller inside Admin page
function switchAdminTab(tabId, btn) {
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));

  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(b => b.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}

// Render administrative users table
function renderAdminUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (adminUsers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No users found in database.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  adminUsers.forEach(user => {
    const tr = document.createElement('tr');
    
    const roleBadge = user.Role === 'Admin' ? 'badge-admin' : 'badge-user';
    const statusBadge = user.Status === 'Active' ? 'badge-active' : 'badge-disabled';

    tr.innerHTML = `
      <td style="font-weight: 600;">${user.FullName}</td>
      <td>${user.Username}</td>
      <td><span class="badge ${roleBadge}">${user.Role}</span></td>
      <td><span class="badge ${statusBadge}">${user.Status}</span></td>
      <td style="font-size: 11px; color: var(--text-muted);">${user.LastLogin || 'Never'}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="openEditUserModal('${user.Username}')" title="Edit Account details"><i class="fas fa-pen"></i></button>
          <button class="btn-icon" onclick="openResetPasswordModal('${user.Username}')" title="Reset Password"><i class="fas fa-key"></i></button>
          <button class="btn-icon delete" onclick="deleteUser('${user.Username}')" title="Remove User"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render tools catalog table
function renderAdminTools() {
  const tbody = document.getElementById('toolsTableBody');
  if (!tbody) return;

  if (adminTools.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No tools found in catalog.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  adminTools.forEach(tool => {
    const tr = document.createElement('tr');
    
    const statusBadge = tool.Status === 'Active' ? 'badge-active' : 'badge-disabled';

    tr.innerHTML = `
      <td style="font-weight: 600;"><i class="${tool.Icon}" style="margin-right: 8px; color: var(--primary-color);"></i> ${tool.ToolName}</td>
      <td><span class="badge badge-user">${tool.Category || 'General'}</span></td>
      <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tool.Description}</td>
      <td><span class="badge ${statusBadge}">${tool.Status}</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="openEditToolModal('${tool.ToolName}')" title="Edit Tool Details"><i class="fas fa-pen"></i></button>
          <button class="btn-icon delete" onclick="deleteTool('${tool.ToolName}')" title="Remove Tool"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render security audit logs
function renderAdminLogs(history) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No login events logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  history.forEach(log => {
    const tr = document.createElement('tr');
    
    const isSuccess = log.Status === 'Success';
    const statusBadge = isSuccess ? 'badge-active' : 'badge-disabled';

    tr.innerHTML = `
      <td style="font-weight: 600;">${log.Username}</td>
      <td style="font-size:11px; color: var(--text-muted);">${log.Timestamp}</td>
      <td><span class="badge ${statusBadge}">${log.Status}</span></td>
      <td style="font-size:11px; color: var(--text-muted); max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log['User Agent']}">${log['User Agent']}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function refreshLoginLogs() {
  showLoading(true, "Refreshing audit trail...");
  const logsRes = await fetchAPI("getLoginHistory");
  showLoading(false);
  
  if (logsRes.status === "success") {
    renderAdminLogs(logsRes.history || []);
    showToast("Audit logs synchronized", "success");
  } else {
    showToast("Failed to refresh logs", "error");
  }
}

// Modals Management
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// USER CRUD OPERATIONS
function openAddUserModal() {
  document.getElementById('userForm').reset();
  document.getElementById('editUserKey').value = "";
  document.getElementById('userUsername').disabled = false;
  document.getElementById('userPasswordGroup').style.display = 'block';
  document.getElementById('userPassword').required = true;
  document.getElementById('userModalTitle').textContent = "Add New User";
  openModal('userModal');
}

function openEditUserModal(username) {
  const user = adminUsers.find(u => u.Username === username);
  if (!user) return;

  document.getElementById('editUserKey').value = user.Username;
  document.getElementById('userFullName').value = user.FullName;
  document.getElementById('userUsername').value = user.Username;
  document.getElementById('userUsername').disabled = true; // Cannot edit username
  document.getElementById('userRole').value = user.Role;
  document.getElementById('userStatus').value = user.Status;
  
  // Hide password fields in main edit modal; reset is done via separate modal
  document.getElementById('userPasswordGroup').style.display = 'none';
  document.getElementById('userPassword').required = false;
  document.getElementById('userModalTitle').textContent = `Edit Details: ${user.FullName}`;
  openModal('userModal');
}

async function handleUserSubmit(event) {
  event.preventDefault();

  const editKey = document.getElementById('editUserKey').value;
  const fullName = document.getElementById('userFullName').value.trim();
  const username = document.getElementById('userUsername').value.trim();
  const role = document.getElementById('userRole').value;
  const status = document.getElementById('userStatus').value;

  const userData = {
    FullName: fullName,
    Username: username,
    Role: role,
    Status: status
  };

  showLoading(true, "Updating database...");
  let response;

  if (editKey) {
    // Edit Mode
    response = await fetchAPI("updateUser", {
      username: editKey,
      userData: userData
    });
  } else {
    // Add Mode
    userData.Password = document.getElementById('userPassword').value;
    response = await fetchAPI("addUser", {
      userData: userData
    });
  }

  showLoading(false);

  if (response.status === "success") {
    closeModal('userModal');
    showToast(response.message, "success");
    loadAdminData(); // Refresh Tables
  } else {
    showToast(response.message || "Failed to save user details", "error");
  }
}

async function deleteUser(username) {
  const session = getUserSession();
  if (session && session.Username.toLowerCase() === username.toLowerCase()) {
    showToast("You cannot delete your own administrative account!", "error");
    return;
  }

  if (!confirm(`Are you sure you want to permanently delete user account "${username}"?`)) {
    return;
  }

  showLoading(true, "Deleting record...");
  const response = await fetchAPI("deleteUser", {
    username: username
  });
  showLoading(false);

  if (response.status === "success") {
    showToast(response.message, "success");
    loadAdminData();
  } else {
    showToast(response.message || "Deletion failed", "error");
  }
}

function openResetPasswordModal(username) {
  document.getElementById('resetPasswordForm').reset();
  document.getElementById('resetPasswordUserKey').value = username;
  document.getElementById('resetPasswordLabel').textContent = username;
  openModal('resetPasswordModal');
}

async function handleResetPasswordSubmit(event) {
  event.preventDefault();

  const username = document.getElementById('resetPasswordUserKey').value;
  const password = document.getElementById('resetNewPassword').value;

  showLoading(true, "Resetting user password...");
  const response = await fetchAPI("updateUser", {
    username: username,
    userData: { Password: password }
  });
  showLoading(false);

  if (response.status === "success") {
    closeModal('resetPasswordModal');
    showToast(`Password reset successfully for ${username}`, "success");
    loadAdminData();
  } else {
    showToast(response.message || "Password reset failed", "error");
  }
}

// TOOL CRUD OPERATIONS
function openAddToolModal() {
  document.getElementById('toolForm').reset();
  document.getElementById('editToolKey').value = "";
  document.getElementById('toolModalTitle').textContent = "Add New Tool";
  openModal('toolModal');
}

function openEditToolModal(toolName) {
  const tool = adminTools.find(t => t.ToolName === toolName);
  if (!tool) return;

  document.getElementById('editToolKey').value = tool.ToolName;
  document.getElementById('toolNameField').value = tool.ToolName;
  document.getElementById('toolDescription').value = tool.Description;
  document.getElementById('toolURL').value = tool.URL;
  document.getElementById('toolIcon').value = tool.Icon;
  document.getElementById('toolCategory').value = tool.Category;
  document.getElementById('toolStatus').value = tool.Status;

  document.getElementById('toolModalTitle').textContent = `Edit Tool: ${tool.ToolName}`;
  openModal('toolModal');
}

async function handleToolSubmit(event) {
  event.preventDefault();

  const editKey = document.getElementById('editToolKey').value;
  const toolName = document.getElementById('toolNameField').value.trim();
  const description = document.getElementById('toolDescription').value.trim();
  const url = document.getElementById('toolURL').value.trim();
  const icon = document.getElementById('toolIcon').value.trim();
  const category = document.getElementById('toolCategory').value.trim();
  const status = document.getElementById('toolStatus').value;

  const toolData = {
    ToolName: toolName,
    Description: description,
    URL: url,
    Icon: icon,
    Category: category,
    Status: status
  };

  showLoading(true, "Updating database catalog...");
  let response;

  if (editKey) {
    response = await fetchAPI("updateTool", {
      toolName: editKey,
      toolData: toolData
    });
  } else {
    response = await fetchAPI("addTool", {
      toolData: toolData
    });
  }

  showLoading(false);

  if (response.status === "success") {
    closeModal('toolModal');
    showToast(response.message, "success");
    loadAdminData();
  } else {
    showToast(response.message || "Failed to update tool records", "error");
  }
}

async function deleteTool(toolName) {
  if (!confirm(`Are you sure you want to permanently delete tool "${toolName}"?`)) {
    return;
  }

  showLoading(true, "Deleting record...");
  const response = await fetchAPI("deleteTool", {
    toolName: toolName
  });
  showLoading(false);

  if (response.status === "success") {
    showToast(response.message, "success");
    loadAdminData();
  } else {
    showToast(response.message || "Deletion failed", "error");
  }
}

// ==========================================================================
// LOCAL DEMO MODE ENGINE (LOCALSTORAGE EMULATION)
// ==========================================================================
function handleDemoAPI(action, payload) {
  // Simple latency emulator
  return new Promise((resolve) => {
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('db_users'));
      const tools = JSON.parse(localStorage.getItem('db_tools'));
      const favorites = JSON.parse(localStorage.getItem('db_favorites'));
      const logs = JSON.parse(localStorage.getItem('db_logs'));

      const now = new Date();
      const timestampStr = now.toISOString().replace('T', ' ').substring(0, 19);

      switch (action) {
        case "login":
          const user = users.find(u => u.Username.toLowerCase() === payload.username.toLowerCase());
          if (!user) {
            logs.unshift({ Username: payload.username, Timestamp: timestampStr, Status: "Failed", "User Agent": navigator.userAgent });
            localStorage.setItem('db_logs', JSON.stringify(logs));
            return resolve({ status: "error", message: "Username not found" });
          }
          if (user.Status !== "Active") {
            logs.unshift({ Username: payload.username, Timestamp: timestampStr, Status: "Failed (Inactive)", "User Agent": navigator.userAgent });
            localStorage.setItem('db_logs', JSON.stringify(logs));
            return resolve({ status: "error", message: "Your account is disabled. Contact Admin." });
          }
          if (user.Password !== payload.password) {
            logs.unshift({ Username: payload.username, Timestamp: timestampStr, Status: "Failed (Password)", "User Agent": navigator.userAgent });
            localStorage.setItem('db_logs', JSON.stringify(logs));
            return resolve({ status: "error", message: "Incorrect password" });
          }
          // Update User Login time
          user.LastLogin = timestampStr;
          localStorage.setItem('db_users', JSON.stringify(users));

          // Log history
          logs.unshift({ Username: payload.username, Timestamp: timestampStr, Status: "Success", "User Agent": navigator.userAgent });
          localStorage.setItem('db_logs', JSON.stringify(logs));

          return resolve({
            status: "success",
            user: {
              Username: user.Username,
              FullName: user.FullName,
              Role: user.Role,
              LastLogin: timestampStr,
              Token: user.Password
            }
          });

        case "getDashboardData":
          // Return active tools only for non-admin, all tools for admin in admin panel
          // In demo mode we check role of current page
          const isUserAdmin = getUserSession() && getUserSession().Role === 'Admin';
          const filteredTools = isUserAdmin && window.location.pathname.includes('admin.html') ? tools : tools.filter(t => t.Status === "Active");
          
          const session = getUserSession();
          const userFavs = favorites
            .filter(f => f.Username.toLowerCase() === (session ? session.Username.toLowerCase() : ""))
            .map(f => f.ToolName);

          return resolve({
            status: "success",
            tools: filteredTools,
            favorites: userFavs
          });

        case "changePassword":
          const uIndex = users.findIndex(u => u.Username.toLowerCase() === payload.sessionUser.toLowerCase());
          if (uIndex !== -1) {
            if (users[uIndex].Password !== payload.currentPassword) {
              return resolve({ status: "error", message: "Incorrect current password" });
            }
            users[uIndex].Password = payload.newPassword;
            localStorage.setItem('db_users', JSON.stringify(users));
            return resolve({ status: "success", message: "Password updated successfully" });
          }
          return resolve({ status: "error", message: "User not found" });

        case "saveFavorite":
          let favIndex = favorites.findIndex(f => f.Username.toLowerCase() === payload.sessionUser.toLowerCase() && f.ToolName === payload.toolName);
          if (payload.isFavorite) {
            if (favIndex === -1) {
              favorites.push({ Username: payload.sessionUser, ToolName: payload.toolName });
            }
          } else {
            if (favIndex !== -1) {
              favorites.splice(favIndex, 1);
            }
          }
          localStorage.setItem('db_favorites', JSON.stringify(favorites));
          return resolve({ status: "success", message: "Favorites updated" });

        case "getUsers":
          // Redact password
          const safeUsers = users.map(u => ({
            Username: u.Username,
            FullName: u.FullName,
            Role: u.Role,
            Status: u.Status,
            LastLogin: u.LastLogin
          }));
          return resolve({ status: "success", users: safeUsers });

        case "addUser":
          if (users.find(u => u.Username.toLowerCase() === payload.userData.Username.toLowerCase())) {
            return resolve({ status: "error", message: "Username already exists" });
          }
          users.push({
            Username: payload.userData.Username,
            Password: payload.userData.Password,
            FullName: payload.userData.FullName,
            Role: payload.userData.Role,
            Status: payload.userData.Status || "Active",
            LastLogin: ""
          });
          localStorage.setItem('db_users', JSON.stringify(users));
          return resolve({ status: "success", message: "User added successfully" });

        case "updateUser":
          const idx = users.findIndex(u => u.Username.toLowerCase() === payload.username.toLowerCase());
          if (idx !== -1) {
            if (payload.userData.Password) users[idx].Password = payload.userData.Password;
            if (payload.userData.FullName) users[idx].FullName = payload.userData.FullName;
            if (payload.userData.Role) users[idx].Role = payload.userData.Role;
            if (payload.userData.Status) users[idx].Status = payload.userData.Status;
            
            localStorage.setItem('db_users', JSON.stringify(users));
            return resolve({ status: "success", message: "User details updated successfully" });
          }
          return resolve({ status: "error", message: "User not found" });

        case "deleteUser":
          const dIdx = users.findIndex(u => u.Username.toLowerCase() === payload.username.toLowerCase());
          if (dIdx !== -1) {
            users.splice(dIdx, 1);
            localStorage.setItem('db_users', JSON.stringify(users));
            
            // Clean favorites
            const cleanFavs = favorites.filter(f => f.Username.toLowerCase() !== payload.username.toLowerCase());
            localStorage.setItem('db_favorites', JSON.stringify(cleanFavs));

            return resolve({ status: "success", message: "User account deleted successfully" });
          }
          return resolve({ status: "error", message: "User not found" });

        case "addTool":
          if (tools.find(t => t.ToolName.toLowerCase() === payload.toolData.ToolName.toLowerCase())) {
            return resolve({ status: "error", message: "Tool Name already exists" });
          }
          tools.push({
            ToolName: payload.toolData.ToolName,
            Description: payload.toolData.Description,
            URL: payload.toolData.URL,
            Icon: payload.toolData.Icon || "fas fa-link",
            Status: payload.toolData.Status || "Active",
            Category: payload.toolData.Category || "General"
          });
          localStorage.setItem('db_tools', JSON.stringify(tools));
          return resolve({ status: "success", message: "Tool added successfully" });

        case "updateTool":
          const tIdx = tools.findIndex(t => t.ToolName.toLowerCase() === payload.toolName.toLowerCase());
          if (tIdx !== -1) {
            tools[tIdx] = {
              ToolName: payload.toolData.ToolName,
              Description: payload.toolData.Description,
              URL: payload.toolData.URL,
              Icon: payload.toolData.Icon,
              Category: payload.toolData.Category,
              Status: payload.toolData.Status
            };
            localStorage.setItem('db_tools', JSON.stringify(tools));
            return resolve({ status: "success", message: "Tool details updated successfully" });
          }
          return resolve({ status: "error", message: "Tool not found" });

        case "deleteTool":
          const dtIdx = tools.findIndex(t => t.ToolName.toLowerCase() === payload.toolName.toLowerCase());
          if (dtIdx !== -1) {
            tools.splice(dtIdx, 1);
            localStorage.setItem('db_tools', JSON.stringify(tools));
            
            // Delete favorites associated with tool
            const cleanFavs = favorites.filter(f => f.ToolName.toLowerCase() !== payload.toolName.toLowerCase());
            localStorage.setItem('db_favorites', JSON.stringify(cleanFavs));

            return resolve({ status: "success", message: "Tool deleted successfully" });
          }
          return resolve({ status: "error", message: "Tool not found" });

        case "getLoginHistory":
          return resolve({ status: "success", history: logs.slice(0, 100) });

        default:
          return resolve({ status: "error", message: "Action not emulated in demo: " + action });
      }
    }, 400); // 400ms lag simulation
  });
}

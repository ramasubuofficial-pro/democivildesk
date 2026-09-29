import axios from 'axios';

// .env: VITE_API_BASE_URL=http://localhost:8080/api
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    withCredentials: true,
    headers: { Accept: 'application/json' },
    timeout: 30000,
});

api.interceptors.request.use((config) => {
    if (config.data instanceof FormData && config.headers) {
        delete config.headers['Content-Type'];
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const normalized = {
            status: error.response?.status || 0,
            message: error.response?.data?.message || error.message || 'Request failed.',
            errors: error.response?.data?.errors || null,
            data: error.response?.data || null,
            original: error,
        };
        const url = error.config?.url || '';
        const isAuthUrl = url.includes('/auth/login') || url.includes('/auth/logout') || url.includes('/auth/me');
        if (normalized.status === 401 && !isAuthUrl) {
            window.dispatchEvent(new CustomEvent('api:unauthorized', { detail: normalized }));
        }
        return Promise.reject(normalized);
    },
);

const data = (response) => response.data;
const enc = (value) => encodeURIComponent(String(value));
const formData = (values) => {
    if (values instanceof FormData) return values;
    const body = new FormData();
    Object.entries(values || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) value.forEach((item) => body.append(`${key}[]`, item));
        else body.append(key, value);
    });
    return body;
};

export const request = {
    get: (url, params, config = {}) => api.get(url, { ...config, params }).then(data),
    post: (url, body = {}, config = {}) => api.post(url, body, config).then(data),
    put: (url, body = {}, config = {}) => api.put(url, body, config).then(data),
    patch: (url, body = {}, config = {}) => api.patch(url, body, config).then(data),
    delete: (url, body, config = {}) => api.delete(url, { ...config, data: body }).then(data),
    upload: (url, values, method = 'post') => api.request({ url, method, data: formData(values) }).then(data),
    download: (url, params) => api.get(url, { params, responseType: 'blob' }).then((r) => r.data),
};

const crud = (base) => ({
    list: (params) => request.get(base, params),
    get: (id, params) => request.get(`${base}/${enc(id)}`, params),
    create: (payload) => request.post(base, payload),
    update: (id, payload) => request.patch(`${base}/${enc(id)}`, payload),
    replace: (id, payload) => request.put(`${base}/${enc(id)}`, payload),
    remove: (id, payload) => request.delete(`${base}/${enc(id)}`, payload),
});

const action = (base, id, name, payload = {}) =>
    request.post(`${base}/${enc(id)}/${enc(name)}`, payload);

const nestedCrud = (baseForParent) => ({
    list: (parentId, params) => request.get(baseForParent(parentId), params),
    get: (parentId, id, params) => request.get(`${baseForParent(parentId)}/${enc(id)}`, params),
    create: (parentId, payload) => request.post(baseForParent(parentId), payload),
    update: (parentId, id, payload) => request.patch(`${baseForParent(parentId)}/${enc(id)}`, payload),
    replace: (parentId, id, payload) => request.put(`${baseForParent(parentId)}/${enc(id)}`, payload),
    remove: (parentId, id, payload) => request.delete(`${baseForParent(parentId)}/${enc(id)}`, payload),
});

export const authApi = {
    login: (email, password, remember = false) => request.post('/auth/login', {
        email,
        password,
        remember,
    }),
    me: () => request.get('/auth/me'),
    logout: () => request.post('/auth/logout'),
    changePassword: (payload) => request.post('/auth/change-password', payload),
};

export const mastersApi = { all: (params) => request.get('/masters', params) };
export const companiesApi = {
    list: (params) => request.get('/companies', params),
    get: (id) => request.get(`/companies/${enc(id)}`),
    update: (id, payload) => request.patch(`/companies/${enc(id)}`, payload),
};
export const branchesApi = {
    list: (params) => request.get('/branches', params),
    get: (id) => request.get(`/branches/${enc(id)}`),
    create: (payload) => request.post('/branches', payload),
    update: (id, payload) => request.patch(`/branches/${enc(id)}`, payload),
    remove: (id) => request.delete(`/branches/${enc(id)}`),
};
export const usersApi = {
    list: (params) => request.get('/users', params),
    get: (id) => request.get(`/users/${enc(id)}`),
    create: (payload) => request.post('/users', payload),
    update: (id, payload) => request.patch(`/users/${enc(id)}`, payload),
    delete: (id) => request.delete(`/users/${enc(id)}`),
    remove: (id) => request.delete(`/users/${enc(id)}`),
};
export const rolesApi = {
    list: (params) => request.get('/roles', params),
    get: (id) => request.get(`/roles/${enc(id)}`),
    updatePermissions: (id, payload) => request.put(`/roles/${enc(id)}/permissions`, payload),
};
export const userRolesApi = rolesApi;
export const permissionsApi = {
    list: (params) => request.get('/permissions', params),
    byRole: (roleId) => rolesApi.get(roleId).then((response) => response?.data?.role?.permissions ?? []),
    updateRolePermissions: (roleId, permissionIds) => rolesApi.updatePermissions(roleId, {
        permission_ids: permissionIds,
    }),
};
export const navigationApi = {
    list: () => request.get('/navigation').then((response) => response?.data?.navigation ?? []),
};
const masterList = (key) => mastersApi.all().then((response) => response?.data?.[key] ?? response?.[key] ?? []);
export const userTypeMastersApi = {
    list: () => masterList('user_types'),
};
export const accessLevelMastersApi = {
    list: () => masterList('access_levels'),
};
export const userStatusesApi = {
    list: () => masterList('user_statuses'),
};

export const clientsApi = {
    ...crud('/clients'),
    addresses: nestedCrud((clientId) => `/clients/${enc(clientId)}/addresses`),
    contacts: nestedCrud((clientId) => `/clients/${enc(clientId)}/contacts`),
    documents: {
        ...nestedCrud((clientId) => `/clients/${enc(clientId)}/documents`),
        upload: (clientId, payload) => request.upload(`/clients/${enc(clientId)}/documents`, payload),
        download: (clientId, documentId) => request.download(`/clients/${enc(clientId)}/documents/${enc(documentId)}/download`),
    },
};
export const clientStatusesApi = {
    list: () => masterList('client_statuses'),
};
export const clientSourcesApi = {
    list: () => masterList('client_sources'),
};
export const clientDocumentsApi = { ...crud('/client-documents') };
export const clientContactsApi = { ...crud('/client-contacts') };
export const clientAddressesApi = { ...crud('/client-addresses') };

export const projectsApi = {
    ...crud('/projects'),
    statusHistory: (id, params) => request.get(`/projects/${enc(id)}/status-history`, params),
    changeStatus: (id, payload) => request.post(`/projects/${enc(id)}/change-status`, payload),
    teamMembers: nestedCrud((projectId) => `/projects/${enc(projectId)}/team-members`),
};
export const projectTypesApi = { ...crud('/project-types') };
export const financialYearsApi = { ...crud('/financial-years') };
export const unitsApi = { ...crud('/units-of-measurement') };
export const workCategoriesApi = { ...crud('/work-categories') };

export const sitesApi = {
    ...crud('/sites'),
    statusHistory: (id, params) => request.get(`/sites/${enc(id)}/status-history`, params),
    changeStatus: (id, payload) => request.post(`/sites/${enc(id)}/change-status`, payload),
    teamMembers: nestedCrud((siteId) => `/sites/${enc(siteId)}/team-members`),
};
export const siteZonesApi = { ...crud('/site-zones') };
export const workLocationsApi = { ...crud('/work-locations') };
export const projectDocumentsApi = {
    list: (params) => request.get('/project-documents', params),
    get: (id, params) => request.get(`/project-documents/${enc(id)}`, params),
    create: (payload) => request.upload('/project-documents', payload),
    upload: (payload) => request.upload('/project-documents', payload),
    update: (id, payload) => request.patch(`/project-documents/${enc(id)}`, payload),
    replace: (id, payload) => request.put(`/project-documents/${enc(id)}`, payload),
    download: (id) => request.download(`/project-documents/${enc(id)}/download`),
    remove: (id) => request.delete(`/project-documents/${enc(id)}`),
};
export const projectMilestonesApi = {
    ...crud('/project-milestones'),
};

export const boqApi = {
    ...crud('/project-boqs'),
    submit: (id, payload) => action('/project-boqs', id, 'submit', payload),
    approve: (id, payload) => action('/project-boqs', id, 'approve', payload),
    reject: (id, payload) => action('/project-boqs', id, 'reject', payload),
    sections: nestedCrud((boqId) => `/project-boqs/${enc(boqId)}/sections`),
    items: nestedCrud((boqId) => `/project-boqs/${enc(boqId)}/items`),
    rateComponents: {
        list: (boqId, itemId, params) => request.get(`/project-boqs/${enc(boqId)}/items/${enc(itemId)}/rate-components`, params),
        get: (boqId, itemId, id) => request.get(`/project-boqs/${enc(boqId)}/items/${enc(itemId)}/rate-components/${enc(id)}`),
        create: (boqId, itemId, payload) => request.post(`/project-boqs/${enc(boqId)}/items/${enc(itemId)}/rate-components`, payload),
        update: (boqId, itemId, id, payload) => request.patch(`/project-boqs/${enc(boqId)}/items/${enc(itemId)}/rate-components/${enc(id)}`, payload),
        remove: (boqId, itemId, id) => request.delete(`/project-boqs/${enc(boqId)}/items/${enc(itemId)}/rate-components/${enc(id)}`),
    },
};

export const budgetsApi = {
    ...crud('/project-budgets'),
    submit: (id, payload) => action('/project-budgets', id, 'submit', payload),
    approve: (id, payload) => action('/project-budgets', id, 'approve', payload),
    reject: (id, payload) => action('/project-budgets', id, 'reject', payload),
    approvalHistory: (id, params) => request.get(`/project-budgets/${enc(id)}/approval-history`, params),
    lines: nestedCrud((budgetId) => `/project-budgets/${enc(budgetId)}/lines`),
    revisions: {
        ...nestedCrud((budgetId) => `/project-budgets/${enc(budgetId)}/revisions`),
        submit: (budgetId, revisionId, payload) => request.post(`/project-budgets/${enc(budgetId)}/revisions/${enc(revisionId)}/submit`, payload),
        approve: (budgetId, revisionId, payload) => request.post(`/project-budgets/${enc(budgetId)}/revisions/${enc(revisionId)}/approve`, payload),
        reject: (budgetId, revisionId, payload) => request.post(`/project-budgets/${enc(budgetId)}/revisions/${enc(revisionId)}/reject`, payload),
        history: (budgetId, revisionId, params) => request.get(`/project-budgets/${enc(budgetId)}/revisions/${enc(revisionId)}/history`, params),
        createLine: (budgetId, revisionId, payload) => request.post(`/project-budgets/${enc(budgetId)}/revisions/${enc(revisionId)}/lines`, payload),
        updateLine: (budgetId, revisionId, lineId, payload) => request.patch(`/project-budgets/${enc(budgetId)}/revisions/${enc(revisionId)}/lines/${enc(lineId)}`, payload),
        removeLine: (budgetId, revisionId, lineId) => request.delete(`/project-budgets/${enc(budgetId)}/revisions/${enc(revisionId)}/lines/${enc(lineId)}`),
    },
};

export const labourApi = {
    masters: (params) => request.get('/labour/masters', params),
    categories: crud('/labour/categories'),
    contractors: crud('/labour/contractors'),
    workers: {
        ...crud('/labour/workers'),
        documents: {
            list: (workerId, params) => request.get(`/labour/workers/${enc(workerId)}/documents`, params),
            upload: (workerId, payload) => request.upload(`/labour/workers/${enc(workerId)}/documents`, payload),
            update: (workerId, documentId, payload) => request.patch(`/labour/workers/${enc(workerId)}/documents/${enc(documentId)}`, payload),
            verify: (workerId, documentId, payload) => request.post(`/labour/workers/${enc(workerId)}/documents/${enc(documentId)}/verify`, payload),
            remove: (workerId, documentId) => request.delete(`/labour/workers/${enc(workerId)}/documents/${enc(documentId)}`),
        },
    },
    assignments: crud('/labour/assignments'),
};

export const attendanceApi = {
    list: (params) => request.get('/labour-attendance', params),
    get: (id) => request.get(`/labour-attendance/${enc(id)}`),
    create: (payload) => request.post('/labour-attendance', payload),
    createEntry: (registerId, payload) => request.post(`/labour-attendance/${enc(registerId)}/entries`, payload),
    updateEntry: (registerId, entryId, payload) => request.patch(`/labour-attendance/${enc(registerId)}/entries/${enc(entryId)}`, payload),
    removeEntry: (registerId, entryId) => request.delete(`/labour-attendance/${enc(registerId)}/entries/${enc(entryId)}`),
    submit: (id, payload) => action('/labour-attendance', id, 'submit', payload),
    approve: (id, payload) => action('/labour-attendance', id, 'approve', payload),
    reject: (id, payload) => action('/labour-attendance', id, 'reject', payload),
    lock: (id, payload) => action('/labour-attendance', id, 'lock', payload),
    exceptions: {
        ...crud('/labour-attendance/exceptions'),
        submit: (id, payload) => action('/labour-attendance/exceptions', id, 'submit', payload),
        approve: (id, payload) => action('/labour-attendance/exceptions', id, 'approve', payload),
        reject: (id, payload) => action('/labour-attendance/exceptions', id, 'reject', payload),
    },
};

export const wagesApi = {
    list: (params) => request.get('/labour-wages', params),
    get: (id) => request.get(`/labour-wages/${enc(id)}`),
    create: (payload) => request.post('/labour-wages', payload),
    update: (id, payload) => request.patch(`/labour-wages/${enc(id)}`, payload),
    replace: (id, payload) => request.put(`/labour-wages/${enc(id)}`, payload),
    calculate: (id, payload) => action('/labour-wages', id, 'calculate', payload),
    updateLine: (id, lineId, payload) => request.patch(`/labour-wages/${enc(id)}/lines/${enc(lineId)}`, payload),
    submit: (id, payload) => action('/labour-wages', id, 'submit', payload),
    approve: (id, payload) => action('/labour-wages', id, 'approve', payload),
    cancel: (id, payload) => action('/labour-wages', id, 'cancel', payload),
};


// Karur-style Daily Wages / Daily Resource Cost Register
// Kept separate from attendance-based labour-wages payroll.
export const dailyWagesApi = {
    // Setup data for dropdowns / page initialization.
    // Optional params: project_id, site_id, subcontractor_id, date
    setup: (params) => request.get('/daily-wages/setup', params),

    // Reusable subcontractor daily-wage item templates.
    templates: {
        list: (params) => request.get('/daily-wages/templates', params),
        get: (id, params) => request.get(`/daily-wages/templates/${enc(id)}`, params),
        create: (payload) => request.post('/daily-wages/templates', payload),
        update: (id, payload) => request.patch(`/daily-wages/templates/${enc(id)}`, payload),
        replace: (id, payload) => request.put(`/daily-wages/templates/${enc(id)}`, payload),
        remove: (id) => request.delete(`/daily-wages/templates/${enc(id)}`),
    },

    // Daily wage register.
    list: (params) => request.get('/daily-wages', params),
    get: (id, params) => request.get(`/daily-wages/${enc(id)}`, params),
    create: (payload) => request.post('/daily-wages', payload),
    update: (id, payload) => request.patch(`/daily-wages/${enc(id)}`, payload),
    replace: (id, payload) => request.put(`/daily-wages/${enc(id)}`, payload),

    // Register workflow.
    cancel: (id, payload = {}) => request.post(`/daily-wages/${enc(id)}/cancel`, payload),
};

export const labourPaymentsApi = {
    list: (params) => request.get('/labour-payments', params),
    get: (id) => request.get(`/labour-payments/${enc(id)}`),
    create: (payload) => request.post('/labour-payments', payload),
    submit: (id, payload) => action('/labour-payments', id, 'submit', payload),
    approve: (id, payload) => action('/labour-payments', id, 'approve', payload),
    markPaid: (id, payload) => action('/labour-payments', id, 'mark-paid', payload),
    cancel: (id, payload) => action('/labour-payments', id, 'cancel', payload),
};

export const labourContractorBillsApi = {
    masters: () => request.get('/labour-contractor-bills/masters'),
    ...crud('/labour-contractor-bills'),
    addEntry: (id, payload) => request.post(`/labour-contractor-bills/${enc(id)}/entries`, payload),
    updateEntry: (id, entryId, payload) => request.patch(`/labour-contractor-bills/${enc(id)}/entries/${enc(entryId)}`, payload),
    removeEntry: (id, entryId) => request.delete(`/labour-contractor-bills/${enc(id)}/entries/${enc(entryId)}`),
    submit: (id, payload) => action('/labour-contractor-bills', id, 'submit', payload),
    verify: (id, payload) => action('/labour-contractor-bills', id, 'verify', payload),
    reject: (id, payload) => action('/labour-contractor-bills', id, 'reject', payload),
    price: (id, payload) => action('/labour-contractor-bills', id, 'price', payload),
    addCharge: (id, payload) => request.post(`/labour-contractor-bills/${enc(id)}/charges`, payload),
    updateCharge: (id, chargeId, payload) => request.patch(`/labour-contractor-bills/${enc(id)}/charges/${enc(chargeId)}`, payload),
    removeCharge: (id, chargeId) => request.delete(`/labour-contractor-bills/${enc(id)}/charges/${enc(chargeId)}`),
    approve: (id, payload) => action('/labour-contractor-bills', id, 'approve', payload),
    recordPayment: (id, payload) => request.post(`/labour-contractor-bills/${enc(id)}/payments`, payload),
    printUrl: (id) => `${api.defaults.baseURL}/labour-contractor-bills/${enc(id)}/print`,
};

export const materialsApi = {
    masters: (params) => request.get('/materials/masters', params),
    categories: crud('/materials/categories'),
    brands: crud('/materials/brands'),
    catalogue: crud('/materials/catalogue'),
    suppliers: crud('/materials/suppliers'),
};

const materialDocument = (type) => ({
    ...crud(`/material-management/${type}`),
    addItem: (id, payload) => request.post(`/material-management/${type}/${enc(id)}/items`, payload),
    updateItem: (id, itemId, payload) => request.patch(`/material-management/${type}/${enc(id)}/items/${enc(itemId)}`, payload),
    removeItem: (id, itemId) => request.delete(`/material-management/${type}/${enc(id)}/items/${enc(itemId)}`),
    action: (id, name, payload) => action(`/material-management/${type}`, id, name, payload),
});

export const materialManagementApi = {
    requests: materialDocument('requests'),
    purchaseOrders: materialDocument('purchase-orders'),
    receipts: {
        ...materialDocument('receipts'),
        inspect: (id, payload) => action('/material-management/receipts', id, 'inspect', payload),
        post: (id, payload) => action('/material-management/receipts', id, 'post', payload),
    },
    transactions: {
        ...materialDocument('transactions'),
        post: (id, payload) => action('/material-management/transactions', id, 'post', payload),
    },
    stock: (params) => request.get('/material-management/stock', params),
    exportStock: (params) => request.download('/material-management/stock/export', params),
    ledger: (params) => request.get('/material-management/ledger', params),
};

const dailyEntry = (type) => ({
    list: (reportId, params) => request.get(`/daily-site-reports/${enc(reportId)}/${type}`, params),
    get: (reportId, id) => request.get(`/daily-site-reports/${enc(reportId)}/${type}/${enc(id)}`),
    create: (reportId, payload) => request.post(`/daily-site-reports/${enc(reportId)}/${type}`, payload),
    update: (reportId, id, payload) => request.patch(`/daily-site-reports/${enc(reportId)}/${type}/${enc(id)}`, payload),
    remove: (reportId, id) => request.delete(`/daily-site-reports/${enc(reportId)}/${type}/${enc(id)}`),
});

export const dailyReportsApi = {
    masters: (params) => request.get('/daily-operations/masters', params),
    ...crud('/daily-site-reports'),
    submit: (id, payload) => action('/daily-site-reports', id, 'submit', payload),
    review: (id, payload) => action('/daily-site-reports', id, 'review', payload),
    approve: (id, payload) => action('/daily-site-reports', id, 'approve', payload),
    reject: (id, payload) => action('/daily-site-reports', id, 'reject', payload),
    reopen: (id, payload) => action('/daily-site-reports', id, 'reopen', payload),
    cancel: (id, payload) => action('/daily-site-reports', id, 'cancel', payload),
    workProgress: {
        ...dailyEntry('work-progress'),
        inspect: (reportId, id, payload) => request.post(`/daily-site-reports/${enc(reportId)}/work-progress/${enc(id)}/inspect`, payload),
    },
    manpower: dailyEntry('manpower'),
    equipment: dailyEntry('equipment'),
    weather: dailyEntry('weather'),
    issues: dailyEntry('issues'),
    visitors: dailyEntry('visitors'),
    materialConsumption: dailyEntry('material-consumption'),
    photos: {
        upload: (reportId, payload) => request.upload(`/daily-site-reports/${enc(reportId)}/photos`, payload),
        update: (reportId, photoId, payload) => request.patch(`/daily-site-reports/${enc(reportId)}/photos/${enc(photoId)}`, payload),
        download: (reportId, photoId) => request.download(`/daily-site-reports/${enc(reportId)}/photos/${enc(photoId)}/download`),
        remove: (reportId, photoId) => request.delete(`/daily-site-reports/${enc(reportId)}/photos/${enc(photoId)}`),
    },
};

const subcontractDocument = (type, hasItems = true) => ({
    ...crud(`/subcontracts/${type}`),
    ...(hasItems ? {
        addItem: (id, payload) => request.post(`/subcontracts/${type}/${enc(id)}/items`, payload),
        updateItem: (id, itemId, payload) => request.patch(`/subcontracts/${type}/${enc(id)}/items/${enc(itemId)}`, payload),
    } : {}),
    action: (id, name, payload) => action(`/subcontracts/${type}`, id, name, payload),
});

export const subcontractsApi = {
    masters: (params) => request.get('/subcontracts/masters', params),
    contractorTypes: {
        ...crud('/subcontracts/contractor-types'),
    },
    contractors: {
        ...crud('/subcontracts/contractors'),
        uploadDocument: (id, payload) => request.upload(`/subcontracts/contractors/${enc(id)}/documents`, payload),
        verifyDocument: (id, documentId, payload) => request.post(`/subcontracts/contractors/${enc(id)}/documents/${enc(documentId)}/verify`, payload),
    },
    workOrders: {
        ...subcontractDocument('work-orders'),
        returnForRevision: (id, payload = {}) => request.post(`/subcontracts/work-orders/${enc(id)}/return`, payload),
        integrations: (id, params) => request.get(`/subcontracts/work-orders/${enc(id)}/integrations`, params),
    },
    measurements: subcontractDocument('measurements'),
    raBills: {
        ...subcontractDocument('ra-bills'),
        returnForRevision: (id, payload = {}) => request.post(`/subcontracts/ra-bills/${enc(id)}/return`, payload),
    },
    payments: subcontractDocument('payments', false),
    weeklyPayments: subcontractDocument('weekly-payments', false),
};

export const expensesApi = {
    masters: (params) => request.get('/expenses/masters', params),
    categories: {
        list: (params) => request.get('/expenses/categories', params),
        create: (payload) => request.post('/expenses/categories', payload),
        update: (id, payload) => request.patch(`/expenses/categories/${enc(id)}`, payload),
    },
    requests: {
        list: (params) => request.get('/expenses/requests', params),
        get: (id) => request.get(`/expenses/requests/${enc(id)}`),
        create: (payload) => request.post('/expenses/requests', payload),
        update: (id, payload) => request.patch(`/expenses/requests/${enc(id)}`, payload),
        addItem: (id, payload) => request.post(`/expenses/requests/${enc(id)}/items`, payload),
        action: (id, name, payload) => action('/expenses/requests', id, name, payload),
    },
    bills: {
        list: (params) => request.get('/expenses/bills', params),
        get: (id) => request.get(`/expenses/bills/${enc(id)}`),
        create: (payload) => request.post('/expenses/bills', payload),
        update: (id, payload) => request.patch(`/expenses/bills/${enc(id)}`, payload),
        addItem: (id, payload) => request.post(`/expenses/bills/${enc(id)}/items`, payload),
        uploadDocument: (id, payload) => request.upload(`/expenses/bills/${enc(id)}/documents`, payload),
        allocate: (id, itemId, payload) => request.post(`/expenses/bills/${enc(id)}/items/${enc(itemId)}/allocations`, payload),
        action: (id, name, payload) => action('/expenses/bills', id, name, payload),
    },
    payments: {
        list: (params) => request.get('/expenses/payments', params),
        get: (id) => request.get(`/expenses/payments/${enc(id)}`),
        create: (payload) => request.post('/expenses/payments', payload),
        update: (id, payload) => request.patch(`/expenses/payments/${enc(id)}`, payload),
        action: (id, name, payload) => action('/expenses/payments', id, name, payload),
    },
};

export const projectCostingApi = {
    summary: (projectId, params) => request.get(`/project-costing/projects/${enc(projectId)}/summary`, params),
    snapshots: (params) => request.get('/project-costing/snapshots', params),
    generateSnapshot: (payload) => request.post('/project-costing/snapshots/generate', payload),
};

export const approvalsApi = {
    list: (params) => request.get('/approvals', params),
    summary: (params) => request.get('/approvals/summary', params),
    history: (params) => request.get('/approvals/history', params),
    get: (type, id, params) => request.get(`/approvals/${enc(type)}/${enc(id)}`, params),
    action: (type, id, name, payload) => request.post(`/approvals/${enc(type)}/${enc(id)}/${enc(name)}`, payload),
};

export const notificationsApi = {
    list: (params) => request.get('/notifications', params),
    markRead: (id) => request.patch(`/notifications/${enc(id)}/read`),
    markAllRead: () => request.patch('/notifications/read-all'),
};

export const dashboardApi = {
    masters: (params) => request.get('/dashboard/masters', params),
    overview: (params) => request.get('/dashboard/overview', params),
    projectPerformance: (params) => request.get('/dashboard/project-performance', params),
    alerts: (params) => request.get('/dashboard/alerts', params),
    createAlert: (payload) => request.post('/dashboard/alerts', payload),
    alertAction: (id, name, payload) => request.post(`/dashboard/alerts/${enc(id)}/${enc(name)}`, payload),
};

export const reportsApi = {
    dailyProgress: (params) => request.get('/reports/daily-progress', params),
    projectCost: (params) => request.get('/reports/project-cost', params),
    labour: (params) => request.get('/reports/labour', params),
    materials: (params) => request.get('/reports/materials', params),
    subcontracts: (params) => request.get('/reports/subcontracts', params),
    expenses: (params) => request.get('/reports/expenses', params),
};

export const managementReviewsApi = {
    list: (params) => request.get('/management-reviews', params),
    create: (payload) => request.post('/management-reviews', payload),
    action: (id, name, payload) => request.post(`/management-reviews/${enc(id)}/${enc(name)}`, payload),
};

export const systemAdminApi = {
    masters: (params) => request.get('/system-admin/masters', params),
    integrity: (params) => request.get('/system-admin/integrity', params),
    notificationSummary: (params) => request.get('/system-admin/notifications/summary', params),
    notifications: (params) => request.get('/system-admin/notifications', params),
    auditLogs: (params) => request.get('/system-admin/audit-logs', params),
    recordAudit: (payload) => request.post('/system-admin/audit-logs', payload),
    auditDetail: (id) => request.get(`/system-admin/audit-logs/${enc(id)}`),
    loginHistory: (params) => request.get('/system-admin/login-history', params),
};

export default api;

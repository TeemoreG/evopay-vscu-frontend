const API_BASE = '/api';

const ENDPOINTS = {
  // Items
  GET_ITEMS: `${API_BASE}/items`,
  SAVE_ITEM: `${API_BASE}/items`,
  
  // Sales
  SAVE_SALES: `${API_BASE}/sales`,
  
  // Stock
  GET_STOCK: `${API_BASE}/stock`,
  
  // Purchases
  GET_PURCHASES: `${API_BASE}/purchases`,
  SAVE_PURCHASE: `${API_BASE}/purchases`,
  
  // Imports
  GET_IMPORT_ITEMS: `${API_BASE}/imports`,
  UPDATE_IMPORT_ITEMS: `${API_BASE}/imports`,
  
  // Branches
  GET_BRANCHES: `${API_BASE}/branches`,
  SAVE_BRANCH: `${API_BASE}/branches`,
  
  // Settings
  GET_SETTINGS: `${API_BASE}/settings`,
  UPDATE_SETTINGS: `${API_BASE}/settings`,
  
  // Data
  GET_TAX_RATES: `${API_BASE}/data/tax-rates`,
  GET_PAYMENT_TYPES: `${API_BASE}/data/payment-types`,
  GET_UNIT_CODES: `${API_BASE}/data/unit-codes`,
  GET_CLASSIFICATIONS: `${API_BASE}/data/classifications`,
  
  // Sync
  PROCESS_SYNC: `${API_BASE}/sync/process`,
  SYNC_STATUS: `${API_BASE}/sync/status`,
  
  // VSCU
  VSCU_STATUS: `${API_BASE}/health`,

  // Users 
  LOGIN: `${API_BASE}/users/login`,
  GET_USERS: `${API_BASE}/users`,
  CREATE_USER: `${API_BASE}/users`,
  DELETE_USER: `${API_BASE}/users`,

  // ===== NEW VSCU ENDPOINTS =====
  INITIALIZE: `${API_BASE}/initializer/selectInitInfo`,
  GET_CODE_LIST: `${API_BASE}/data/code/selectCodes`,
  GET_ITEM_CLASSIFICATIONS: `${API_BASE}/data/itemClass/selectItemsClass`,
  GET_CUSTOMER_BY_PIN: `${API_BASE}/customers/selectCustomer`,
  GET_BRANCHES_FROM_VSCU: `${API_BASE}/branches/selectBranches`,
  GET_NOTICES: `${API_BASE}/notices/selectNotices`,
  SAVE_BRANCH_CUSTOMER: `${API_BASE}/branches/saveBrancheCustomers`,
  SAVE_BRANCH_USER: `${API_BASE}/branches/saveBrancheUsers`,
  SAVE_BRANCH_INSURANCE: `${API_BASE}/branches/saveBrancheInsurances`,
  GET_ITEMS_FROM_VSCU: `${API_BASE}/items/selectItems`,
  SEND_ITEM: `${API_BASE}/items/saveItems`,
  SEND_ITEM_COMPOSITION: `${API_BASE}/items/saveItemComposition`,
  GET_IMPORT_ITEMS_FROM_VSCU: `${API_BASE}/imports/selectImportItems`,
  GET_PURCHASES_FROM_VSCU: `${API_BASE}/purchases/selectTrnsPurchaseSales`,
  SYNC_STOCK: `${API_BASE}/stock/sync`,
  GET_STOCK_FROM_VSCU: `${API_BASE}/stock/selectStockItems`,
  SAVE_STOCK_MASTER: `${API_BASE}/stock/stockMaster/saveStockMaster`,
  X_REPORT: `${API_BASE}/reports/x-report`,
  Z_REPORT: `${API_BASE}/reports/z-report`,
  ITEM_REPORT: `${API_BASE}/reports/items`,
  TAX_REPORT: `${API_BASE}/reports/tax`,
};

export default ENDPOINTS;

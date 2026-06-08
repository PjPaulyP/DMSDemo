    const FALLBACK_NA = '#NA';
    const SQL_SITE_REPOSITORY = window.SQL_SITE_REPOSITORY || null;
    const DOC_REPOSITORY = window.DOC_REPOSITORY || null;
    const BEST_PRACTICES_REPOSITORY = window.BEST_PRACTICES_REPOSITORY || null;
    const EQUIP_DATASHEET = window.EQUIPMENT_DATA?.EQUIP_DATASHEET || {};
    const EQUIP_DATASHEET_FIELDS = window.EQUIPMENT_DATA?.EQUIP_DATASHEET_FIELDS || {};
    const FOLDER_TYPE_POLICY = window.EQUIPMENT_DATA?.FOLDER_TYPE_POLICY || {};

    function buildTreeFromSqlRepository(sqlRepository, folderPolicy) {
      const tables = sqlRepository?.tables;
      if (!tables) return null;

      const sites = Array.isArray(tables.sites) ? tables.sites : [];
      const units = Array.isArray(tables.units) ? tables.units : [];
      const equipmentGroups = Array.isArray(tables.equipment_groups) ? tables.equipment_groups : [];
      const equipment = Array.isArray(tables.equipment) ? tables.equipment : [];
      const folders = Array.isArray(tables.equipment_folders) ? tables.equipment_folders : [];

      if (!sites.length) return null;

      const folderLabelByCode = {};
      Object.values(folderPolicy || {}).forEach(policy => {
        if (policy?.code && policy?.label) {
          folderLabelByCode[policy.code] = policy.label;
        }
      });

      const groupChildrenByParent = new Map();
      equipmentGroups.forEach(group => {
        const parent = group.parent_group_id || null;
        if (!groupChildrenByParent.has(parent)) groupChildrenByParent.set(parent, []);
        groupChildrenByParent.get(parent).push(group);
      });

      const groupsByUnit = new Map();
      equipmentGroups.forEach(group => {
        if (!groupsByUnit.has(group.unit_id)) groupsByUnit.set(group.unit_id, []);
        groupsByUnit.get(group.unit_id).push(group);
      });

      const equipmentByGroup = new Map();
      equipment.forEach(eq => {
        const groupId = eq.group_id || '';
        if (!equipmentByGroup.has(groupId)) equipmentByGroup.set(groupId, []);
        equipmentByGroup.get(groupId).push(eq);
      });

      const foldersByEquipment = new Map();
      folders.forEach(folder => {
        const equipmentId = folder.equipment_id || '';
        if (!foldersByEquipment.has(equipmentId)) foldersByEquipment.set(equipmentId, []);
        foldersByEquipment.get(equipmentId).push(folder);
      });

      function buildFolderNodes(equipmentId) {
        const eqFolders = foldersByEquipment.get(equipmentId) || [];
        const sorted = [...eqFolders].sort((a, b) => {
          const aCode = String(a.folder_type_code || '');
          const bCode = String(b.folder_type_code || '');
          return aCode.localeCompare(bCode, undefined, { numeric: true, sensitivity: 'base' });
        });

        return sorted.map(folder => ({
          id: folder.folder_id,
          label: folderLabelByCode[folder.folder_type_code] || folder.folder_label || folder.folder_id,
          type: 'folder',
        }));
      }

      function buildGroupNode(group) {
        const childGroups = (groupChildrenByParent.get(group.group_id) || []).map(buildGroupNode);
        const childEquipment = (equipmentByGroup.get(group.group_id) || []).map(eq => ({
          id: eq.equipment_id,
          label: eq.display_label || [eq.equipment_tag, eq.equipment_name].filter(Boolean).join(' - ') || eq.equipment_id,
          type: 'equip',
          children: buildFolderNodes(eq.equipment_id),
        }));

        return {
          id: group.group_id,
          label: group.group_label,
          type: 'eqgroup',
          children: [...childGroups, ...childEquipment],
        };
      }

      function buildUnitNode(unit) {
        const allUnitGroups = groupsByUnit.get(unit.unit_id) || [];
        const rootGroups = allUnitGroups.filter(group => !group.parent_group_id);
        return {
          id: unit.unit_id,
          label: unit.display_label || [unit.unit_number, unit.unit_name].filter(Boolean).join(' '),
          type: 'unit',
          children: rootGroups.map(buildGroupNode),
        };
      }

      return sites.map(site => ({
        id: site.site_id,
        label: site.display_label || [site.site_code, site.site_name].filter(Boolean).join(' '),
        type: 'site',
        children: units
          .filter(unit => unit.site_id === site.site_id)
          .map(buildUnitNode),
      }));
    }

    function mapDocRepositoryToSeedDocs(docRepository) {
      const documents = Array.isArray(docRepository?.documents) ? docRepository.documents : [];
      return documents.map((doc, index) => {
        const tags = doc?.metadataTags || {};
        return {
          id: doc.documentId || `repo-${index + 1}`,
          Site: tags.site || '',
          Unit: tags.unit || '',
          primaryEquipment: tags.primaryEquipment || '',
          secondaryEquipment: tags.secondaryEquipment || '',
          primaryDocumentType: tags.primaryDocumentType || '',
          secondaryDocumentType: tags.secondaryDocumentType || '',
          name: doc.fileName || '',
          rev: doc.revision || '-',
          ext: doc.extension || '',
          size: doc.fileSize || '0 KB',
          date: doc.documentDate || '',
          status: tags.status || 'For Review',
          uploader: tags.uploader || 'System',
          folder: tags.legacyFolder || '',
          uploadedBy: tags.uploadedBy || tags.uploader || 'System',
          uploadedAt: tags.uploadedAt || doc.documentDate || '',
          latestChangedBy: tags.latestChangedBy || tags.uploader || 'System',
          latestChangedAt: tags.latestChangedAt || doc.documentDate || '',
          mocId: tags.mocId || '',
          mocInitiator: tags.mocInitiator || '',
          pendingApprover: tags.pendingApprover || '',
          supersededBy: tags.supersededBy || '',
          supersededAt: tags.supersededAt || '',
          trainingFolder: tags.trainingFolder || '',
        };
      });
    }

    function normalizeDisciplineKey(value) {
      return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    function mapBestPracticesRepositoryDocs(repository) {
      const documents = Array.isArray(repository?.documents) ? repository.documents : [];
      return documents.map((doc, index) => ({
        id: doc.documentId || `bp-${index + 1}`,
        name: doc.title || `Best Practice ${index + 1}`,
        rev: doc.revision || '-',
        ext: (doc.fileType || 'pdf').toLowerCase(),
        size: doc.fileSize || '0 KB',
        date: doc.effectiveDate || '',
        status: doc.status || 'Approved',
        uploader: doc.owner || 'Corporate Standards Team',
        folder: '',
        bpDiscipline: normalizeDisciplineKey(doc.disciplineId || ''),
        uploadedBy: doc.uploadedBy || doc.owner || 'Corporate Standards Team',
        uploadedAt: doc.uploadedAt || doc.effectiveDate || '',
        latestChangedBy: doc.latestChangedBy || doc.owner || 'Corporate Standards Team',
        latestChangedAt: doc.latestChangedAt || doc.effectiveDate || '',
        approvedBy: doc.approvedBy || doc.owner || 'Corporate Standards Team',
        approvedAt: doc.approvedAt || doc.effectiveDate || '',
        pendingApprover: doc.pendingApprover || '',
        mocInitiator: doc.mocInitiator || '',
        supersededBy: doc.supersededBy || '',
        supersededAt: doc.supersededAt || '',
      }));
    }

    function mapTrainingDocs(rawDocs) {
      const documents = Array.isArray(rawDocs) ? rawDocs : [];
      return documents.map((doc, index) => {
        const tags = doc?.metadataTags || {};
        return {
          id: doc.documentId || `training-${index + 1}`,
          name: doc.fileName || `Training Module ${index + 1}`,
          rev: doc.revision || 'R1',
          ext: (doc.extension || 'pdf').toLowerCase(),
          size: doc.fileSize || '0 KB',
          date: doc.documentDate || '',
          status: tags.status || 'Approved',
          uploader: tags.uploader || 'Training Team',
          folder: '',
          trainingFolder: tags.trainingFolder || '',
          site: tags.site || '',
          unit: tags.unit || '',
          primaryDocumentType: tags.primaryDocumentType || 'Training Module',
          secondaryDocumentType: tags.secondaryDocumentType || '',
          uploadedBy: tags.uploadedBy || tags.uploader || 'Training Team',
          uploadedAt: tags.uploadedAt || doc.documentDate || '',
          latestChangedBy: tags.latestChangedBy || tags.uploader || 'Training Team',
          latestChangedAt: tags.latestChangedAt || doc.documentDate || '',
          approvedBy: tags.approvedBy || tags.uploader || 'Training Team',
          approvedAt: tags.approvedAt || doc.documentDate || '',
          pendingApprover: tags.pendingApprover || '',
          mocId: tags.mocId || '',
          mocInitiator: tags.mocInitiator || '',
          supersededBy: tags.supersededBy || '',
          supersededAt: tags.supersededAt || '',
        };
      });
    }

    const TREE = buildTreeFromSqlRepository(SQL_SITE_REPOSITORY, FOLDER_TYPE_POLICY)
      || (Array.isArray(window.EQUIPMENT_DATA?.TREE) ? window.EQUIPMENT_DATA.TREE : []);
    const REPO_SEED_DOCS = mapDocRepositoryToSeedDocs(DOC_REPOSITORY);
    const BEST_PRACTICE_DOCS = mapBestPracticesRepositoryDocs(BEST_PRACTICES_REPOSITORY);
    const TRAINING_DOCS = mapTrainingDocs(window.TRAINING_DOCS || window.POC_MOCK_DATA?.TRAINING_DOCS || []);

    // ─── Sample Seed Documents ─────────────────────────────────────────────────
    const SEED_DOCS = REPO_SEED_DOCS.length
      ? REPO_SEED_DOCS
      : (Array.isArray(window.POC_MOCK_DATA?.SEED_DOCS) ? window.POC_MOCK_DATA.SEED_DOCS : []);

    // ─── App State ─────────────────────────────────────────────────────────────
    // ─── Integration Mock Data ─────────────────────────────────────────────────
    // JD Edwards EnterpriseOne — Spare Parts Inventory (Branch/Plant: WHM-01)
    const JDE_PARTS = window.POC_MOCK_DATA?.JDE_PARTS || {};

    // IBM Maximo — Work Orders (CMMS)
    const MAXIMO_WOS = window.POC_MOCK_DATA?.MAXIMO_WOS || {};

    function getDatasheetFieldSet(sheet) {
      if (!sheet || !EQUIP_DATASHEET_FIELDS || typeof EQUIP_DATASHEET_FIELDS !== 'object') return FALLBACK_NA;
      return EQUIP_DATASHEET_FIELDS[sheet.class] || EQUIP_DATASHEET_FIELDS.default;
    }

    function formatImperialValue(rawValue) {
      if (rawValue == null) return '';
      let value = String(rawValue);

      const round = (num, digits = 1) => {
        const n = Number(num);
        if (!Number.isFinite(n)) return num;
        const p = 10 ** digits;
        return (Math.round(n * p) / p).toString();
      };

      // Convert common SI process units to imperial display units.
      value = value.replace(/(-?\d+(?:\.\d+)?)\s*m3\/h\b/gi, (_, n) => `${round(Number(n) * 4.4029)} gpm`);
      value = value.replace(/(-?\d+(?:\.\d+)?)\s*m3\b/gi, (_, n) => `${round(Number(n) * 35.3147)} ft3`);
      value = value.replace(/(-?\d+(?:\.\d+)?)\s*\bm\b/gi, (_, n) => `${round(Number(n) * 3.28084)} ft`);
      value = value.replace(/(-?\d+(?:\.\d+)?)\s*barg\b/gi, (_, n) => `${round(Number(n) * 14.5038)} psig`);
      value = value.replace(/(-?\d+(?:\.\d+)?)\s*\bC\b/gi, (_, n) => `${round((Number(n) * 9 / 5) + 32)} F`);
      value = value.replace(/(-?\d+(?:\.\d+)?)\s*kW\b/gi, (_, n) => `${round(Number(n) * 1.34102)} hp`);

      return value;
    }

    function renderDatasheetFields(sheet) {
      const fieldSet = getDatasheetFieldSet(sheet);
      if (fieldSet === FALLBACK_NA) return `<div><span class="text-slate-700">#NA</span></div>`;
      return fieldSet.map(([label, key]) => {
        const value = sheet?.[key];
        if (value == null || value === '' || value === 'N/A') return '';
        return `<div><span class="text-slate-400">${label}:</span> <span class="text-slate-700">${formatImperialValue(value)}</span></div>`;
      }).join('');
    }

    const WO_STATUS_STYLE = {
      'COMP':   { label: 'Complete',      cls: 'bg-slate-100 text-slate-500' },
      'INPRG':  { label: 'In Progress',   cls: 'bg-blue-100 text-blue-700' },
      'WPCOND': { label: 'Wait Condition',cls: 'bg-amber-100 text-amber-700' },
      'APPR':   { label: 'Approved',      cls: 'bg-emerald-100 text-emerald-700' },
      'WAPPR':  { label: 'Wait Approval', cls: 'bg-orange-100 text-orange-700' },
    };

    const JDE_STOCK_STYLE = {
      'Active':   'bg-emerald-100 text-emerald-700',
      'Low Stock':'bg-amber-100 text-amber-700',
      'On Order': 'bg-blue-100 text-blue-700',
    };

    function inferFolderIdFromDoc(doc) {
      const equipment = (doc?.primaryEquipment || '').trim();
      const primaryType = (doc?.primaryDocumentType || '').trim();
      const secondaryType = (doc?.secondaryDocumentType || '').trim();
      if (!equipment) return '';

      if (primaryType === 'Procedures') {
        if (secondaryType === 'Maintenance Procedure' || secondaryType === 'Engineering Procedure') {
          return `${equipment}-MP`;
        }
        return `${equipment}-OP`;
      }

      const typeMap = {
        'Drawings': 'TD',
        'Equipment Data': 'TD',
        'Reports': 'RH',
        'Other': 'MOC',
      };
      const typeCode = typeMap[primaryType] || 'TD';
      return `${equipment}-${typeCode}`;
    }

    function normalizeDocForTree(doc) {
      if (!doc || typeof doc !== 'object') return doc;
      if (doc.folder) return doc;
      const inferredFolder = inferFolderIdFromDoc(doc);
      return inferredFolder ? { ...doc, folder: inferredFolder } : doc;
    }

    // ─── App State ─────────────────────────────────────────────────────────────
    const localDocsRaw = JSON.parse(localStorage.getItem('dms_poc_docs') || 'null');
    const localDocs = Array.isArray(localDocsRaw) ? localDocsRaw : null;
    const seedDocs = Array.isArray(SEED_DOCS) ? SEED_DOCS : [];
    let allDocs = (localDocs || [...seedDocs]).map(normalizeDocForTree);
    let activeFolder = null;   // current folder id
    let pendingFiles = [];     // files queued for upload modal
    let viewHistory = [];      // navigation history stack (past)
    let forwardHistory = [];   // forward history stack (future)
    let NODE_REGISTRY = new Map();
    let activeNodeId = null;
    let isRestoringHistory = false;
    const defaultEmptyPlaceholderHTML = document.getElementById('emptyPlaceholder')?.innerHTML || '';
    const defaultEmptyPlaceholderClassName = document.getElementById('emptyPlaceholder')?.className || '';
    const HOME_VIEW_ID = '__home_landing__';
    const PLANT_SELECTION_VIEW_ID = '__plant_selection__';
    const BEST_PRACTICES_VIEW_ID = '__best_practices__';
    const BEST_PRACTICES_DISCIPLINE_PREFIX = '__best_practices__discipline__';
    const AI_CHAT_STORAGE_KEY = 'dms_poc_ai_chat_history';
    const AI_CHAT_PANEL_WIDTH_KEY = 'dms_poc_ai_chat_panel_width';
    const AI_CHAT_MAX_MESSAGES = 40;
    let aiChatMessages = [];

    function setEmptyPlaceholderMode(mode = 'empty') {
      const emptyPlaceholder = document.getElementById('emptyPlaceholder');
      if (!emptyPlaceholder) return;
      if (mode === 'content') {
        emptyPlaceholder.className = 'w-full text-left';
        return;
      }
      emptyPlaceholder.className = defaultEmptyPlaceholderClassName;
    }

    // ─── Icon helpers ──────────────────────────────────────────────────────────
    const TYPE_ICONS = {
      site:    `<svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M3 10.5l9-7.5 9 7.5V21"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 21v-6h6v6"/></svg>`,
      unit:    `<svg class="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path stroke-linecap="round" d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>`,
      eqgroup: `<svg class="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>`,
      equip:   `<svg class="w-4 h-4 text-cyan-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>`,
      folder:  `<svg class="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>`,
    };

    const EXT_ICONS = {
      pdf:  { icon: 'PDF',  color: 'bg-red-100 text-red-700' },
      dwg:  { icon: 'DWG',  color: 'bg-purple-100 text-purple-700' },
      xlsx: { icon: 'XLS',  color: 'bg-green-100 text-green-700' },
      docx: { icon: 'DOC',  color: 'bg-blue-100 text-blue-700' },
      txt:  { icon: 'TXT',  color: 'bg-slate-100 text-slate-600' },
      url:  { icon: 'URL',  color: 'bg-sky-100 text-sky-700' },
    };

    const STATUS_STYLE = {
      'Approved':   'bg-emerald-100 text-emerald-700',
      'For Review': 'bg-amber-100 text-amber-700',
      'Superseded': 'bg-slate-100 text-slate-500',
      'Open':       'bg-orange-100 text-orange-700',
      'Closed':     'bg-slate-100 text-slate-500',
    };

    const BEST_PRACTICES_PENDING_APPROVER = {
      machinery: 'Corporate Reliability Lead',
      'process-engineering': 'Process Engineering Manager',
      'fixed-equipment': 'Integrity Manager',
      civil: 'Civil Discipline Lead',
      instrumentation: 'Instrumentation Lead',
      electrical: 'Electrical Lead',
    };

    const TRAINING_VIEW_ID = '__training__';
    const TRAINING_FOLDER_PREFIX = '__training__folder__';
    const TRAINING_FOLDERS = [
      {
        key: 'onboarding',
        label: 'Onboarding',
        description: 'Orientation material, site access basics, and first-week learning.',
        accent: 'from-amber-50 to-amber-100 border-amber-200',
        icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6l8 4-8 4-8-4 8-4z"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 10v6l8 4 8-4v-6"/></svg>`,
        match: doc => {
          if ((doc?.trainingFolder || '').toLowerCase() === 'onboarding') return true;
          const text = `${doc?.name || ''} ${doc?.primaryDocumentType || ''} ${doc?.secondaryDocumentType || ''}`.toLowerCase();
          return text.includes('onboarding') || text.includes('orientation') || text.includes('induction') || text.includes('welcome');
        },
      },
      {
        key: 'sarnia-chemical-plant-process',
        label: 'Aromatics Unit Process',
        description: 'Unit process learning for aromatics operations and key workflows.',
        accent: 'from-sky-50 to-sky-100 border-sky-200',
        icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M3 10.5l9-7.5 9 7.5V21"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 21v-6h6v6"/></svg>`,
        match: doc => {
          if ((doc?.trainingFolder || '').toLowerCase() === 'sarnia-chemical-plant-process') return true;
          const text = `${doc?.Site || ''} ${doc?.Unit || ''} ${doc?.name || ''}`.toLowerCase();
          return text.includes('sarnia') || text.includes('c072');
        },
      },
      {
        key: 'kearl-lake-process',
        label: 'Hydrotreating Unit Process',
        description: 'Unit process learning for hydrotreating operations and safe rounds.',
        accent: 'from-cyan-50 to-cyan-100 border-cyan-200',
        icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M5 8h14M5 16h14"/></svg>`,
        match: doc => {
          if ((doc?.trainingFolder || '').toLowerCase() === 'kearl-lake-process') return true;
          const text = `${doc?.Site || ''} ${doc?.Unit || ''} ${doc?.name || ''}`.toLowerCase();
          return text.includes('kearl') || text.includes('c073');
        },
      },
      {
        key: 'maintenance',
        label: 'Maintenance',
        description: 'Maintenance procedures, job aids, and reliability references.',
        accent: 'from-rose-50 to-rose-100 border-rose-200',
        icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6M9 16h6M9 8h6"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 4h14v16H5z"/></svg>`,
        match: doc => {
          if ((doc?.trainingFolder || '').toLowerCase() === 'maintenance') return true;
          const text = `${doc?.name || ''} ${doc?.primaryDocumentType || ''} ${doc?.secondaryDocumentType || ''}`.toLowerCase();
          return text.includes('maintenance') || text.includes('preventive') || text.includes('reliability');
        },
      },
      {
        key: 'inventory',
        label: 'Inventory',
        description: 'Parts, stock, and materials control references.',
        accent: 'from-emerald-50 to-emerald-100 border-emerald-200',
        icon: `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16"/><path stroke-linecap="round" stroke-linejoin="round" d="M7 7v10M12 7v10M17 7v10"/></svg>`,
        match: doc => {
          if ((doc?.trainingFolder || '').toLowerCase() === 'inventory') return true;
          const text = `${doc?.name || ''} ${doc?.primaryDocumentType || ''} ${doc?.secondaryDocumentType || ''}`.toLowerCase();
          return text.includes('inventory') || text.includes('stock') || text.includes('spare') || text.includes('part');
        },
      },
    ];

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"]|'/g, match => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[match]));
    }

    function normalizeStatusLabel(status) {
      if (status === 'For Review' || status === 'Pending') return 'Pending';
      return status || 'Unknown';
    }

    function formatStatusDate(value) {
      return value || '—';
    }

    function getStatusTooltipData(doc) {
      const status = String(doc?.status || '').trim();
      const isPending = status === 'For Review' || status === 'Pending';
      const uploadedBy = doc?.uploadedBy || doc?.uploader || '—';
      const uploadedAt = formatStatusDate(doc?.uploadedAt || doc?.date);
      const latestBy = doc?.latestChangedBy || uploadedBy;
      const latestAt = formatStatusDate(doc?.latestChangedAt || doc?.date);
      const approvedBy = doc?.approvedBy || latestBy;
      const approvedAt = formatStatusDate(doc?.approvedAt || doc?.latestChangedAt || doc?.date);
      const mocId = doc?.mocId || (status === 'Approved' || status === 'Superseded' ? (doc?.folder && String(doc.folder).toUpperCase().includes('MOC') ? doc.folder : '') : '');
      const mocInitiator = doc?.mocInitiator || uploadedBy;
      const pendingApprover = doc?.pendingApprover || (doc?.bpDiscipline ? BEST_PRACTICES_PENDING_APPROVER[doc.bpDiscipline] : '') || 'Document Control';
      const supersededBy = doc?.supersededBy || '';
      const supersededAt = formatStatusDate(doc?.supersededAt || doc?.latestChangedAt || doc?.date);

      const rows = [
        `<div><span class="text-slate-400">Uploaded by:</span> <span class="text-slate-100 font-medium">${escapeHtml(uploadedBy)}</span></div>`,
        `<div><span class="text-slate-400">Uploaded on:</span> <span class="text-slate-100 font-medium">${escapeHtml(uploadedAt)}</span></div>`,
        `<div><span class="text-slate-400">Latest changes by:</span> <span class="text-slate-100 font-medium">${escapeHtml(latestBy)}</span></div>`,
        `<div><span class="text-slate-400">Latest changes on:</span> <span class="text-slate-100 font-medium">${escapeHtml(latestAt)}</span></div>`,
        `<div><span class="text-slate-400">Approved by:</span> <span class="text-slate-100 font-medium">${escapeHtml(approvedBy)}</span></div>`,
        `<div><span class="text-slate-400">Approved on:</span> <span class="text-slate-100 font-medium">${escapeHtml(approvedAt)}</span></div>`,
      ];

      if (mocId) {
        rows.push(`<div><span class="text-slate-400">MOC:</span> <span class="text-slate-100 font-medium">${escapeHtml(mocId)}</span></div>`);
        rows.push(`<div><span class="text-slate-400">MOC initiator:</span> <span class="text-slate-100 font-medium">${escapeHtml(mocInitiator)}</span></div>`);
      }

      if (isPending) {
        rows.push(`<div><span class="text-slate-400">Review Pending:</span> <span class="text-slate-100 font-medium">${escapeHtml(pendingApprover)}</span></div>`);
      }

      if (status === 'Superseded') {
        rows.push(`<div><span class="text-slate-400">Superseded on:</span> <span class="text-slate-100 font-medium">${escapeHtml(supersededAt)}</span></div>`);
        if (supersededBy) {
          rows.push(`<div><span class="text-slate-400">Superseded by:</span> <span class="text-slate-100 font-medium">${escapeHtml(supersededBy)}</span></div>`);
        }
      }

      return {
        statusLabel: normalizeStatusLabel(status),
        body: rows.join(''),
      };
    }

    function ensureStatusTooltip() {
      let tooltip = document.getElementById('statusTooltip');
      if (tooltip) return tooltip;
      tooltip = document.createElement('div');
      tooltip.id = 'statusTooltip';
      tooltip.className = 'status-tooltip hidden';
      document.body.appendChild(tooltip);
      return tooltip;
    }

    function positionStatusTooltip(tooltip, x, y) {
      const offset = 16;
      const maxX = window.innerWidth - tooltip.offsetWidth - 12;
      const maxY = window.innerHeight - tooltip.offsetHeight - 12;
      tooltip.style.left = `${Math.min(x + offset, Math.max(12, maxX))}px`;
      tooltip.style.top = `${Math.min(y + offset, Math.max(12, maxY))}px`;
    }

    function showStatusTooltip(doc, event, anchorEl) {
      const tooltip = ensureStatusTooltip();
      const data = getStatusTooltipData(doc);
      tooltip.innerHTML = `
        <div class="text-[10px] uppercase tracking-wide text-slate-300 mb-2">${escapeHtml(data.statusLabel)} details</div>
        <div class="space-y-1 text-xs leading-5">${data.body}</div>
      `;
      tooltip.classList.remove('hidden');
      tooltip.style.visibility = 'hidden';
      tooltip.style.left = '0px';
      tooltip.style.top = '0px';
      const rect = anchorEl?.getBoundingClientRect?.();
      if (rect) {
        positionStatusTooltip(tooltip, rect.right, rect.top);
      } else if (event) {
        positionStatusTooltip(tooltip, event.clientX, event.clientY);
      }
      tooltip.style.visibility = 'visible';
    }

    function moveStatusTooltip(event, anchorEl) {
      const tooltip = document.getElementById('statusTooltip');
      if (!tooltip || tooltip.classList.contains('hidden')) return;
      const rect = anchorEl?.getBoundingClientRect?.();
      if (rect) {
        positionStatusTooltip(tooltip, rect.right, rect.top);
      } else if (event) {
        positionStatusTooltip(tooltip, event.clientX, event.clientY);
      }
    }

    function hideStatusTooltip() {
      const tooltip = document.getElementById('statusTooltip');
      if (!tooltip) return;
      tooltip.classList.add('hidden');
      tooltip.style.visibility = 'hidden';
    }

    let currentPrimaryActionMode = 'default';
    let currentFolderControlled = false;

    function getFolderTypeCode(folderId) {
      if (!folderId) return '';
      const parts = folderId.split('-');
      return parts.length >= 3 ? (parts[parts.length - 1] || '').toUpperCase() : '';
    }

    function getEquipmentIdFromFolderId(folderId) {
      if (!folderId) return '';
      const parts = folderId.split('-');
      if (parts.length < 3) return '';
      return parts.slice(0, parts.length - 1).join('-');
    }

    function displayEquipmentId(equipmentId) {
      if (!equipmentId) return '';
      return equipmentId.startsWith('TAG-') ? equipmentId.slice(4) : equipmentId;
    }

    function docHasTaxonomy(doc) {
      return !!(doc?.primaryEquipment && doc?.primaryDocumentType);
    }

    function matchesFolderTaxonomy(doc, folderTypeCode) {
      const primaryType = (doc?.primaryDocumentType || '').trim();
      const secondaryType = (doc?.secondaryDocumentType || '').trim();

      if (folderTypeCode === 'TD') {
        return primaryType === 'Drawings' || primaryType === 'Equipment Data';
      }
      if (folderTypeCode === 'OP') {
        return primaryType === 'Procedures' && secondaryType === 'Ops Procedure';
      }
      if (folderTypeCode === 'MP') {
        return primaryType === 'Procedures' && (secondaryType === 'Maintenance Procedure' || secondaryType === 'Engineering Procedure');
      }
      if (folderTypeCode === 'MOC') {
        return primaryType === 'Other' && secondaryType === 'Change Notice';
      }
      if (folderTypeCode === 'RH') {
        return primaryType === 'Reports' && (
          secondaryType === 'Investigation Report' ||
          secondaryType === 'Inspection Report' ||
          secondaryType === 'Performance Report' ||
          secondaryType === 'Repair Report'
        );
      }
      return false;
    }

    function matchesUnitAutoFolder(doc, autoFolder) {
      if (!autoFolder || autoFolder.scope !== 'unit') return false;

      const docSite = (doc?.Site || doc?.site || '').trim();
      const docUnit = (doc?.Unit || doc?.unit || '').trim();
      const primaryType = (doc?.primaryDocumentType || '').trim();
      const secondaryType = (doc?.secondaryDocumentType || '').trim();
      const status = (doc?.status || '').trim();

      if (status === 'Superseded') return false;
      if ((autoFolder.unitCode || '').trim() !== docUnit) return false;
      if ((autoFolder.siteCode || '').trim() && docSite && (autoFolder.siteCode || '').trim() !== docSite) return false;

      if (autoFolder.kind === 'pids') {
        return primaryType === 'Drawings' && secondaryType === 'P&ID';
      }
      if (autoFolder.kind === 'procedures') {
        return primaryType === 'Procedures';
      }
      return false;
    }

    function getDocsForFolderId(folderId) {
      const folderNode = findNode(folderId);
      const autoFolder = folderNode?.autoFolder || null;
      if (autoFolder?.scope === 'unit') {
        return allDocs.filter(doc => matchesUnitAutoFolder(doc, autoFolder));
      }

      const folderTypeCode = getFolderTypeCode(folderId);
      const equipmentId = getEquipmentIdFromFolderId(folderId);
      if (!folderTypeCode || !equipmentId) {
        return allDocs.filter(doc => doc.folder === folderId);
      }

      return allDocs.filter(doc => {
        if (docHasTaxonomy(doc)) {
          return (doc.primaryEquipment || '').trim() === equipmentId && matchesFolderTaxonomy(doc, folderTypeCode);
        }
        return doc.folder === folderId;
      });
    }

    function getDocsForFolderIds(folderIds) {
      const byId = new Map();
      folderIds.forEach(folderId => {
        getDocsForFolderId(folderId).forEach(doc => {
          byId.set(doc.id, doc);
        });
      });
      return Array.from(byId.values());
    }

    function getDocsForEquipmentId(equipmentId) {
      if (!equipmentId) return [];
      return allDocs.filter(doc => {
        if (docHasTaxonomy(doc)) return (doc.primaryEquipment || '').trim() === equipmentId;
        return (doc.folder || '').startsWith(`${equipmentId}-`);
      });
    }

    function getStatusLabelForChat(doc) {
      const status = String(doc?.status || '').trim();
      if (status === 'For Review') return 'Pending';
      return status || 'Unknown';
    }

    function getScopeDocsAndLabel() {
      if (!activeNodeId && !activeFolder) {
        return { label: 'All documents', docs: allDocs };
      }

      if (activeNodeId && activeNodeId.startsWith(BEST_PRACTICES_DISCIPLINE_PREFIX)) {
        const disciplineKey = activeNodeId.replace(BEST_PRACTICES_DISCIPLINE_PREFIX, '');
        const discipline = getBestPracticeDisciplines().find(item => item.key === disciplineKey);
        return {
          label: discipline ? `Best Practices / ${discipline.label}` : 'Best Practices',
          docs: getBestPracticesDocsByDiscipline(disciplineKey),
        };
      }

      if (activeNodeId && activeNodeId.startsWith(TRAINING_FOLDER_PREFIX)) {
        const folderKey = activeNodeId.replace(TRAINING_FOLDER_PREFIX, '');
        const folder = getTrainingFolderByKey(folderKey);
        return {
          label: folder ? `Training / ${folder.label}` : 'Training',
          docs: getTrainingFolderDocs(folderKey),
        };
      }

      if (activeNodeId === BEST_PRACTICES_VIEW_ID) {
        return { label: 'Best Practices', docs: BEST_PRACTICE_DOCS };
      }

      if (activeNodeId === TRAINING_VIEW_ID) {
        return { label: 'Training', docs: TRAINING_DOCS };
      }

      if (activeFolder) {
        const folderNode = findNode(activeFolder);
        return {
          label: folderNode ? folderNode.label : 'Selected folder',
          docs: getDocsForFolderId(activeFolder),
        };
      }

      const node = activeNodeId ? findNode(activeNodeId) : null;
      if (!node) {
        return { label: 'All documents', docs: allDocs };
      }

      if (node.type === 'equip') {
        return { label: node.label, docs: getDocsForEquipmentId(node.id) };
      }

      if (node.type === 'folder' || node.type === 'incident') {
        return { label: node.label, docs: getDocsForFolderId(node.id) };
      }

      const descendantFolders = getDescendantFolderNodes(node);
      return {
        label: node.label,
        docs: getDocsForFolderIds(descendantFolders.map(folder => folder.id)),
      };
    }

    function countByStatus(docs) {
      return docs.reduce((acc, doc) => {
        const key = getStatusLabelForChat(doc);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    }

    function summarizeTopStatuses(docs) {
      const map = countByStatus(docs);
      const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
      if (!entries.length) return 'No documents found.';
      return entries.slice(0, 4).map(([status, count]) => `${status}: ${count}`).join(' | ');
    }

    function extractSearchTokens(query) {
      const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'for', 'from', 'to', 'of', 'and', 'or', 'with', 'show', 'find', 'search', 'list', 'documents', 'docs']);
      return query
        .toLowerCase()
        .split(/[^a-z0-9&-]+/)
        .map(token => token.trim())
        .filter(token => token.length >= 2 && !stopWords.has(token));
    }

    function formatChatDocHit(doc) {
      const equipment = displayEquipmentId((doc?.primaryEquipment || '').trim() || getEquipmentIdFromFolderId(doc?.folder || '')) || 'N/A';
      return `- ${doc.name} | ${getStatusLabelForChat(doc)} | ${doc.date || 'N/A'} | ${equipment}`;
    }

    function buildAiSummaryResponse() {
      const scope = getScopeDocsAndLabel();
      const siteCount = Array.isArray(TREE) ? TREE.filter(node => node?.type === 'site').length : 0;
      const equipCount = Array.isArray(TREE)
        ? TREE.reduce((acc, siteNode) => acc + getDescendantEquipNodes(siteNode).length, 0)
        : 0;
      const pendingCount = allDocs.filter(doc => getStatusLabelForChat(doc) === 'Pending').length;
      const approvedCount = allDocs.filter(doc => getStatusLabelForChat(doc) === 'Approved').length;

      return [
        `System snapshot:`,
        `- Total documents: ${allDocs.length}`,
        `- Current scope: ${scope.label} (${scope.docs.length} docs)`,
        `- Sites: ${siteCount} | Equipment assets: ${equipCount}`,
        `- Approved: ${approvedCount} | Pending: ${pendingCount}`,
        `- Top statuses in current scope: ${summarizeTopStatuses(scope.docs)}`,
      ].join('\n');
    }

    function buildCurrentContextResponse() {
      const scope = getScopeDocsAndLabel();
      const node = activeNodeId ? findNode(activeNodeId) : null;
      if (!activeNodeId && !activeFolder) {
        return 'No specific node is selected right now. You are on a general view, so I will answer using all loaded documents.';
      }

      if (!node && activeFolder) {
        return `Current selection is a folder-like view with ${scope.docs.length} document(s).`;
      }

      const nodeType = node?.type || (activeFolder ? 'folder' : 'view');
      return [
        `Current selection: ${scope.label}`,
        `- Type: ${nodeType}`,
        `- Documents in scope: ${scope.docs.length}`,
        `- Status mix: ${summarizeTopStatuses(scope.docs)}`,
      ].join('\n');
    }

    function buildBestPracticesResponse() {
      const rows = getBestPracticeDisciplines().map(discipline => {
        const docs = getBestPracticesDocsByDiscipline(discipline.key);
        return `- ${discipline.label}: ${docs.length}`;
      });
      return ['Best Practices by discipline:', ...rows].join('\n');
    }

    function buildTrainingResponse() {
      const rows = getTrainingFolders().map(folder => {
        const docs = getTrainingFolderDocs(folder.key);
        return `- ${folder.label}: ${docs.length}`;
      });
      return ['Training documents by folder:', ...rows].join('\n');
    }

    function resolveRequestedStatus(query) {
      const normalized = query.toLowerCase();
      if (normalized.includes('pending') || normalized.includes('for review')) return 'Pending';
      if (normalized.includes('approved')) return 'Approved';
      if (normalized.includes('superseded')) return 'Superseded';
      if (normalized.includes('open')) return 'Open';
      if (normalized.includes('closed')) return 'Closed';
      return '';
    }

    function generateAiChatResponse(rawQuery) {
      const query = String(rawQuery || '').trim();
      if (!query) return 'Please enter a question.';

      const normalized = query.toLowerCase();
      const scope = getScopeDocsAndLabel();

      if (/^(hi|hello|hey)\b/.test(normalized)) {
        return 'Hello. I can summarize documents, check current context, count statuses, and find files by name.';
      }

      if (normalized.includes('help') || normalized.includes('what can you do')) {
        return [
          'I can help with:',
          '- System summary and current selection context',
          '- Document counts by status (Approved, Pending, Superseded, etc.)',
          '- Finding documents by title keywords',
          '- Best Practices and Training breakdowns',
          'Try: "summary", "where am I", "pending docs", or "find compressor procedure"',
        ].join('\n');
      }

      if (normalized.includes('summary') || normalized.includes('overview') || normalized.includes('snapshot')) {
        return buildAiSummaryResponse();
      }

      if (normalized.includes('where am i') || normalized.includes('current folder') || normalized.includes('current selection') || normalized.includes('selected')) {
        return buildCurrentContextResponse();
      }

      if (normalized.includes('best practice') || normalized.includes('discipline standards')) {
        return buildBestPracticesResponse();
      }

      if (normalized.includes('training')) {
        return buildTrainingResponse();
      }

      const requestedStatus = resolveRequestedStatus(normalized);
      if (requestedStatus || normalized.includes('status')) {
        const statusToCount = requestedStatus;
        if (statusToCount) {
          const count = scope.docs.filter(doc => getStatusLabelForChat(doc) === statusToCount).length;
          return `${statusToCount} documents in ${scope.label}: ${count}`;
        }
        return `Status distribution in ${scope.label}: ${summarizeTopStatuses(scope.docs)}`;
      }

      const looksLikeSearch = /\b(find|show|list|search|locate)\b/.test(normalized) || normalized.length >= 8;
      if (looksLikeSearch) {
        const tokens = extractSearchTokens(query);
        if (tokens.length) {
          const strictHits = scope.docs.filter(doc => {
            const hay = `${doc.name || ''} ${doc.primaryDocumentType || ''} ${doc.secondaryDocumentType || ''} ${doc.folder || ''}`.toLowerCase();
            return tokens.every(token => hay.includes(token));
          });
          const relaxedHits = scope.docs.filter(doc => {
            const hay = `${doc.name || ''} ${doc.primaryDocumentType || ''} ${doc.secondaryDocumentType || ''} ${doc.folder || ''}`.toLowerCase();
            return tokens.some(token => hay.includes(token));
          });
          const hits = strictHits.length ? strictHits : relaxedHits;
          if (hits.length) {
            const preview = hits.slice(0, 6).map(formatChatDocHit);
            const suffix = hits.length > 6 ? `\n...and ${hits.length - 6} more.` : '';
            return [`Found ${hits.length} matching document(s) in ${scope.label}:`, ...preview].join('\n') + suffix;
          }
          return `No matches found in ${scope.label}. Try broader terms or switch to a larger scope.`;
        }
      }

      return [
        `I could not confidently map that request yet.`,
        `Current scope is ${scope.label} with ${scope.docs.length} docs.`,
        `Try: "summary", "pending docs", "best practices", or "find P&ID".`,
      ].join('\n');
    }

    function getAiChatElements() {
      return {
        toggle: document.getElementById('aiChatToggle'),
        panel: document.getElementById('aiChatPanel'),
        panelResizer: document.getElementById('aiChatResizer'),
        close: document.getElementById('aiChatClose'),
        clear: document.getElementById('aiChatClear'),
        form: document.getElementById('aiChatForm'),
        input: document.getElementById('aiChatInput'),
        messages: document.getElementById('aiChatMessages'),
      };
    }

    function persistAiChatHistory() {
      try {
        localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(aiChatMessages));
      } catch {
        console.warn('Unable to persist AI chat history');
      }
    }

    function loadAiChatHistory() {
      const raw = localStorage.getItem(AI_CHAT_STORAGE_KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string')
          .slice(-AI_CHAT_MAX_MESSAGES);
      } catch {
        return [];
      }
    }

    function formatAiTimestamp(value) {
      const date = value ? new Date(value) : new Date();
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function renderAiChatMessages() {
      const { messages } = getAiChatElements();
      if (!messages) return;
      messages.innerHTML = aiChatMessages.map(item => {
        const isUser = item.role === 'user';
        const wrapperClass = isUser ? 'justify-end' : 'justify-start';
        const bubbleClass = isUser
          ? 'bg-blue-600 text-white border border-blue-600'
          : 'bg-white text-slate-700 border border-slate-200';
        const safeText = escapeHtml(item.text).replace(/\n/g, '<br>');
        return `
          <div class="flex ${wrapperClass}">
            <div class="max-w-[88%] rounded-xl px-3 py-2 text-xs leading-5 shadow-sm ${bubbleClass}">
              <div>${safeText}</div>
              <div class="mt-1 text-[10px] ${isUser ? 'text-blue-100' : 'text-slate-400'}">${formatAiTimestamp(item.ts)}</div>
            </div>
          </div>`;
      }).join('');
      messages.scrollTop = messages.scrollHeight;
    }

    function pushAiMessage(role, text) {
      aiChatMessages.push({ role, text: String(text || ''), ts: new Date().toISOString() });
      if (aiChatMessages.length > AI_CHAT_MAX_MESSAGES) {
        aiChatMessages = aiChatMessages.slice(-AI_CHAT_MAX_MESSAGES);
      }
      persistAiChatHistory();
      renderAiChatMessages();
    }

    function setAiChatOpen(open) {
      const { panel, panelResizer, toggle, input } = getAiChatElements();
      if (!panel || !toggle || !panelResizer) return;
      panel.classList.toggle('hidden', !open);
      panel.classList.toggle('flex', open);
      panel.classList.toggle('flex-col', open);
      panelResizer.classList.toggle('hidden', !open);
      toggle.classList.toggle('bg-slate-800', !open);
      toggle.classList.toggle('bg-blue-700', open);
      toggle.classList.toggle('border-slate-600', !open);
      toggle.classList.toggle('border-blue-500', open);
      toggle.setAttribute('aria-pressed', open ? 'true' : 'false');
      if (open && input) input.focus();
    }

    function applyStoredAiChatPanelWidth() {
      const { panel } = getAiChatElements();
      if (!panel) return;
      const raw = localStorage.getItem(AI_CHAT_PANEL_WIDTH_KEY);
      const width = Number(raw);
      if (!Number.isFinite(width)) return;
      const safeWidth = Math.max(300, Math.min(620, width));
      panel.style.width = `${safeWidth}px`;
    }

    function initAiChatResize() {
      const { panel, panelResizer } = getAiChatElements();
      if (!panel || !panelResizer) return;

      let dragging = false;

      panelResizer.addEventListener('mousedown', (event) => {
        dragging = true;
        panelResizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        event.preventDefault();
      });

      document.addEventListener('mousemove', (event) => {
        if (!dragging) return;
        const desired = window.innerWidth - event.clientX;
        const width = Math.max(300, Math.min(620, desired));
        panel.style.width = `${width}px`;
        localStorage.setItem(AI_CHAT_PANEL_WIDTH_KEY, String(width));
      });

      document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        panelResizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      });
    }

    function initAiChat() {
      const elements = getAiChatElements();
      if (!elements.toggle || !elements.panel || !elements.form || !elements.input || !elements.messages) return;

      aiChatMessages = loadAiChatHistory();
      if (!aiChatMessages.length) {
        aiChatMessages = [{
          role: 'assistant',
          text: 'AI assistant is ready. Ask me for a summary, current context, status counts, or document search.',
          ts: new Date().toISOString(),
        }];
      }
      renderAiChatMessages();

      applyStoredAiChatPanelWidth();
      initAiChatResize();
      setAiChatOpen(false);

      elements.toggle.addEventListener('click', () => {
        const isOpen = !elements.panel.classList.contains('hidden');
        setAiChatOpen(!isOpen);
      });
      if (elements.close) {
        elements.close.addEventListener('click', () => setAiChatOpen(false));
      }
      if (elements.clear) {
        elements.clear.addEventListener('click', () => {
          aiChatMessages = [];
          persistAiChatHistory();
          pushAiMessage('assistant', 'Chat cleared. Ask a new question anytime.');
        });
      }

      elements.form.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = elements.input.value.trim();
        if (!text) return;
        pushAiMessage('user', text);
        const reply = generateAiChatResponse(text);
        pushAiMessage('assistant', reply);
        elements.input.value = '';
      });

      elements.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          elements.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      });
    }

    function getFolderPolicyByFolderId(folderId) {
      const typeCode = getFolderTypeCode(folderId);
      if (!typeCode) return null;
      return FOLDER_TYPE_POLICY[typeCode] || null;
    }

    function getFolderPolicy(node) {
      if (!node || (node.type !== 'folder' && node.type !== 'incident')) return null;
      if (node.type === 'incident' && node.parentFolderId) {
        const byParent = getFolderPolicyByFolderId(node.parentFolderId);
        if (byParent) return byParent;
      }
      const byId = getFolderPolicyByFolderId(node.id);
      if (byId) return byId;
      return Object.values(FOLDER_TYPE_POLICY).find(policy => policy.label === node.label) || null;
    }

    function closeCreateNewMenu() {
      const menu = document.getElementById('createNewMenu');
      if (menu) menu.classList.add('hidden');
    }

    function setPrimaryActionEnabled(enabled) {
      const uploadBtn = document.getElementById('uploadBtn');
      if (!uploadBtn) return;

      uploadBtn.disabled = !enabled;
      uploadBtn.className = enabled
        ? 'flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm'
        : 'flex items-center gap-1.5 bg-slate-300 text-slate-500 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-not-allowed transition-colors shadow-sm';
    }

    function updatePrimaryAction(node) {
      const textEl = document.getElementById('uploadBtnText');
      const caretEl = document.getElementById('uploadBtnCaret');
      if (!textEl || !caretEl) return;

      if (!node || (node.type !== 'folder' && node.type !== 'incident')) {
        currentPrimaryActionMode = 'default';
        textEl.textContent = 'Upload';
        caretEl.classList.add('hidden');
        setPrimaryActionEnabled(false);
        closeCreateNewMenu();
        return;
      }

      const policy = getFolderPolicy(node);
      currentPrimaryActionMode = policy?.actionMode || 'create-new';
      const isRequestMode = currentPrimaryActionMode === 'request-changes';
      textEl.textContent = isRequestMode ? 'Request Changes' : 'Create New+';
      caretEl.classList.toggle('hidden', isRequestMode);
      setPrimaryActionEnabled(true);
      if (isRequestMode) closeCreateNewMenu();
    }

    function setFolderControlBadge(node) {
      const badgeEl = document.getElementById('folderControlBadge');
      if (!badgeEl) return;

      if (!node || (node.type !== 'folder' && node.type !== 'incident')) {
        currentFolderControlled = false;
        badgeEl.classList.add('hidden');
        badgeEl.textContent = '';
        updatePrimaryAction(node);
        return;
      }

      const policy = getFolderPolicy(node);
      const isControlled = !!policy?.controlled;
      currentFolderControlled = isControlled;
      badgeEl.textContent = isControlled ? 'Controlled' : 'Uncontrolled';
      badgeEl.className = isControlled
        ? 'text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border bg-emerald-100 text-emerald-700 border-emerald-400'
        : 'text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border bg-slate-100 text-slate-700 border-slate-400';
      updatePrimaryAction(node);
    }

    function setVirtualFolderControlBadge(isControlled) {
      const badgeEl = document.getElementById('folderControlBadge');
      if (!badgeEl) return;

      currentFolderControlled = !!isControlled;
      if (!isControlled) {
        badgeEl.classList.add('hidden');
        badgeEl.textContent = '';
        return;
      }

      badgeEl.classList.remove('hidden');
      badgeEl.textContent = 'Controlled';
      badgeEl.className = 'text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border bg-emerald-100 text-emerald-700 border-emerald-400';
    }

    function isControlledFolderId(folderId) {
      const policy = getFolderPolicyByFolderId(folderId);
      return !!policy?.controlled;
    }

    function canDeleteFolderId(folderId) {
      const policy = getFolderPolicyByFolderId(folderId);
      if (!policy) return true;
      if (policy.controlled) return false;
      return policy.allowDelete !== false;
    }

    function stripFileExtension(name) {
      return (name || '').replace(/\.[^.]+$/, '').trim();
    }

    function formatEquipmentTypeLabel(rawClass) {
      const text = String(rawClass || '').trim();
      if (!text) return '—';
      return text
        .split('-')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
    }

    function buildIncidentTitleFromDoc(doc) {
      const raw = stripFileExtension(doc?.name || 'Incident');
      return raw.replace(/^\d{4}-\d{2}(?:-\d{2})?\s+/, '').trim() || 'Incident';
    }

    function getIncidentKeyForDoc(doc) {
      if (!doc) return '';
      if (doc.incidentKey) return doc.incidentKey;
      const date = (doc.date || '').trim() || 'unknown-date';
      const title = buildIncidentTitleFromDoc(doc)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return `${date}::${title || 'incident'}`;
    }

    function getIncidentDocsForNode(node) {
      if (!node || node.type !== 'incident') return [];
      return getDocsForFolderId(node.parentFolderId).filter(doc => getIncidentKeyForDoc(doc) === node.incidentKey);
    }

    function getIncidentNodesForRepairFolder(folderId) {
      const docs = getDocsForFolderId(folderId);
      const incidentMap = new Map();

      docs.forEach(doc => {
        const incidentKey = getIncidentKeyForDoc(doc);
        const incidentTitle = buildIncidentTitleFromDoc(doc);
        const date = (doc.date || '').trim() || 'Unknown Date';
        if (!incidentMap.has(incidentKey)) {
          incidentMap.set(incidentKey, {
            id: `${folderId}--INC--${incidentKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            label: `${date} ${incidentTitle}`,
            type: 'incident',
            parentFolderId: folderId,
            incidentKey,
            incidentDate: date,
          });
        }
      });

      return Array.from(incidentMap.values())
        .sort((a, b) => (b.incidentDate || '').localeCompare(a.incidentDate || ''));
    }

    function getTreeChildren(node) {
      if (!node) return [];
      const children = [...(node.children || [])];
      if (node.type === 'folder' && getFolderTypeCode(node.id) === 'RH') {
        children.push(...getIncidentNodesForRepairFolder(node.id));
      }
      return children;
    }

    function getDescendantEquipNodes(node) {
      if (!node) return [];
      const out = [];
      const stack = [...getTreeChildren(node)];
      while (stack.length) {
        const current = stack.pop();
        if (!current) continue;
        if (current.type === 'equip') out.push(current);
        stack.push(...getTreeChildren(current));
      }
      return out;
    }

    function getDescendantFolderNodes(node) {
      if (!node) return [];
      const out = [];
      const stack = [...getTreeChildren(node)];
      while (stack.length) {
        const current = stack.pop();
        if (!current) continue;
        if (current.type === 'folder') out.push(current);
        stack.push(...getTreeChildren(current));
      }
      return out;
    }

    function buildChildNodeCards(node) {
      const children = getTreeChildren(node);
      if (!children.length) return '';

      return `
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div class="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Subfolders</div>
          <div class="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            ${children.map(child => {
              const childDocs = child.type === 'incident'
                ? getIncidentDocsForNode(child)
                : child.type === 'folder'
                  ? getDocsForFolderId(child.id)
                  : [];
              const icon = TYPE_ICONS[child.type] || TYPE_ICONS.folder;
              const typeLabel = {
                incident: 'Incident workspace',
                eqgroup: 'Equipment group',
                unit: 'Unit',
                site: 'Site',
                equip: 'Equipment',
                folder: 'Folder',
              };
              const suffix = typeLabel[child.type] || 'Folder';
              return `
                <button type="button" onclick="selectNode('${child.id}')" class="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2.5">
                  <span class="mt-0.5">${icon}</span>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-slate-800 truncate">${child.label}</div>
                  </div>
                  <div class="text-xs text-slate-500 whitespace-nowrap">${childDocs.length ? `${childDocs.length} document${childDocs.length !== 1 ? 's' : ''}` : suffix}</div>
                </button>`;
            }).join('')}
          </div>
        </div>`;
    }

    function renderHierarchyPane(node) {
      if (!node) return;
      const ancestors = getAncestors(node.id) || [];
      const breadcrumbEl = document.getElementById('breadcrumb');
      breadcrumbEl.innerHTML = buildBreadcrumbHTML(ancestors);

      document.getElementById('folderTitle').textContent = node.label;
      setFolderControlBadge(null);

      const childNodes = getTreeChildren(node);
      const equipNodes = getDescendantEquipNodes(node);
      const folderNodes = getDescendantFolderNodes(node);
      const docCount = getDocsForFolderIds(folderNodes.map(f => f.id)).length;
      const woCount = equipNodes.reduce((acc, eq) => acc + (Array.isArray(MAXIMO_WOS?.[eq.id]) ? MAXIMO_WOS[eq.id].length : 0), 0);
      const openWOs = equipNodes.reduce((acc, eq) => {
        const wos = Array.isArray(MAXIMO_WOS?.[eq.id]) ? MAXIMO_WOS[eq.id] : [];
        return acc + wos.filter(w => w.status === 'INPRG' || w.status === 'WPCOND' || w.status === 'WAPPR').length;
      }, 0);

      const classCounts = {};
      equipNodes.forEach(eq => {
        const cls = EQUIP_DATASHEET?.[eq.id]?.class || 'unknown';
        classCounts[cls] = (classCounts[cls] || 0) + 1;
      });

      document.getElementById('folderMeta').textContent =
        `${childNodes.length} direct subfolder${childNodes.length !== 1 ? 's' : ''} · ${equipNodes.length} equipment · ${docCount} document${docCount !== 1 ? 's' : ''}`;

      const statsBar = document.getElementById('statsBar');
      statsBar.classList.remove('hidden');
      document.getElementById('statCount').textContent = docCount;
      document.getElementById('statSize').textContent = `${equipNodes.length} equipment`;
      document.getElementById('statLastMod').textContent = `${openWOs}/${woCount} active WOs`;

      document.getElementById('tableWrapper').classList.add('hidden');
      const panel = document.getElementById('emptyPlaceholder');
      setEmptyPlaceholderMode('content');
      panel.classList.remove('hidden');

      const sortedClasses = Object.entries(classCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([cls, count]) => `<span class="badge-status bg-slate-100 text-slate-700">${formatEquipmentTypeLabel(cls)}: ${count}</span>`)
        .join('') || '<span class="text-xs text-slate-400">No equipment class data</span>';

      const topEquipRows = equipNodes
        .slice(0, 8)
        .map(eq => {
          const escapedEqId = (eq.id || '').replace(/'/g, "\\'");
          const folders = getTreeChildren(eq).filter(ch => ch.type === 'folder');
          const eqDocs = getDocsForFolderIds(folders.map(f => f.id)).length;
          const eqClass = formatEquipmentTypeLabel(EQUIP_DATASHEET?.[eq.id]?.class);
          const eqOpenWos = (MAXIMO_WOS?.[eq.id] || []).filter(w => w.status === 'INPRG' || w.status === 'WPCOND' || w.status === 'WAPPR').length;
          return `<tr class="hover:bg-slate-50 transition-colors">
            <td class="px-3 py-2 text-slate-700 font-medium"><button type="button" onclick="selectNode('${escapedEqId}')" class="text-left text-slate-700 hover:text-blue-600 transition-colors">${eq.label}</button></td>
            <td class="px-3 py-2 text-slate-500">${eqClass}</td>
            <td class="px-3 py-2 text-center text-slate-700">${eqDocs}</td>
            <td class="px-3 py-2 text-center text-slate-700">${eqOpenWos}</td>
          </tr>`;
        }).join('');

      panel.innerHTML = `
        <div class="w-full text-left space-y-4">
          ${buildChildNodeCards(node)}

          <div class="grid grid-cols-3 gap-3">
            <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div class="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Documents</div>
              <div class="text-2xl font-bold text-slate-800">${docCount}</div>
              <div class="text-xs text-slate-400 mt-0.5">Across all descendants</div>
            </div>
            <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div class="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Equipment</div>
              <div class="text-2xl font-bold text-slate-800">${equipNodes.length}</div>
              <div class="text-xs text-slate-400 mt-0.5">In selected branch</div>
            </div>
            <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div class="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Open Work Orders</div>
              <div class="text-2xl font-bold text-slate-800">${openWOs}</div>
              <div class="text-xs text-slate-400 mt-0.5">of ${woCount} total linked WOs</div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Technical Snapshot</div>
            <div class="flex flex-wrap gap-1.5">${sortedClasses}</div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-700 uppercase tracking-wide">Equipment In Scope</span>
              <span class="text-xs text-slate-400">Top 8</span>
            </div>
            <table class="w-full text-xs">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wide">
                  <th class="px-3 py-2 text-left">Equipment</th>
                  <th class="px-3 py-2 text-left">Type</th>
                  <th class="px-3 py-2 text-center">Docs</th>
                  <th class="px-3 py-2 text-center">Open WOs</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">${topEquipRows || '<tr><td colspan="4" class="px-3 py-5 text-center text-slate-300">No equipment in this branch</td></tr>'}</tbody>
            </table>
          </div>
        </div>`;
    }

    function renderHomeLanding() {
      activeFolder = null;
      activeNodeId = HOME_VIEW_ID;
      setFolderControlBadge(null);

      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
      document.getElementById('breadcrumb').innerHTML = '<span class="text-slate-700 font-medium">Home</span>';
      document.getElementById('folderTitle').textContent = 'Document Hub';
      document.getElementById('folderMeta').textContent = 'Choose a workspace to begin.';
      document.getElementById('statsBar').classList.add('hidden');
      document.getElementById('tableWrapper').classList.add('hidden');

      const panel = document.getElementById('emptyPlaceholder');
      setEmptyPlaceholderMode('content');
      panel.classList.remove('hidden');
      panel.innerHTML = `
        <div class="w-full max-w-5xl mx-auto py-8">
          <div class="mb-6">
            <h3 class="text-2xl font-semibold text-slate-800">Welcome</h3>
            <p class="text-sm text-slate-500 mt-1">Select a destination to open your workspace.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button type="button" onclick="openHomeSection('site-documents')" class="text-left bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div class="flex items-start gap-3">
                <span class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-sky-600 text-white">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M3 10.5l9-7.5 9 7.5V21"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 21v-6h6v6"/></svg>
                </span>
                <div>
                  <div class="text-lg font-semibold text-slate-800">Equipment Documents</div>
                  <div class="text-xs text-slate-600 mt-1">Browse site, unit, equipment, and folder hierarchies.</div>
                </div>
              </div>
            </button>

            <button type="button" onclick="openHomeSection('best-practices')" class="text-left bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div class="flex items-start gap-3">
                <span class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-600 text-white">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 4h10l4 4v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 13h6M9 17h6M9 9h2"/></svg>
                </span>
                <div>
                  <div class="text-lg font-semibold text-slate-800">Best Practices</div>
                  <div class="text-xs text-slate-600 mt-1">Open standards, guidance, and recommended methods.</div>
                </div>
              </div>
            </button>

            <button type="button" onclick="openHomeSection('training')" class="text-left bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div class="flex items-start gap-3">
                <span class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-amber-600 text-white">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6l8 4-8 4-8-4 8-4z"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 10v6l8 4 8-4v-6"/></svg>
                </span>
                <div>
                  <div class="text-lg font-semibold text-slate-800">Training</div>
                  <div class="text-xs text-slate-600 mt-1">Review onboarding material and operator learning content.</div>
                </div>
              </div>
            </button>

            <button type="button" onclick="openHomeSection('procedures')" class="text-left bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div class="flex items-start gap-3">
                <span class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-rose-600 text-white">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6M9 16h6M9 8h6"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 4h14v16H5z"/></svg>
                </span>
                <div>
                  <div class="text-lg font-semibold text-slate-800">Procedures</div>
                  <div class="text-xs text-slate-600 mt-1">View operations and maintenance procedures across sites.</div>
                </div>
              </div>
            </button>
          </div>
        </div>`;
    }

    function getTrainingFolders() {
      return TRAINING_FOLDERS;
    }

    function getTrainingFolderByKey(folderKey) {
      return getTrainingFolders().find(folder => folder.key === folderKey) || null;
    }

    function getTrainingFolderDocs(folderKey) {
      const folder = getTrainingFolderByKey(folderKey);
      if (!folder) return [];
      return TRAINING_DOCS.filter(doc => folder.match(doc));
    }

    function renderTrainingLanding() {
      activeFolder = null;
      activeNodeId = TRAINING_VIEW_ID;
      setVirtualFolderControlBadge(true);

      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
      document.getElementById('breadcrumb').innerHTML = '<span class="text-slate-400">Home</span><span class="breadcrumb-sep">/</span><span class="text-slate-700 font-medium">Training</span>';
      document.getElementById('folderTitle').textContent = 'Training';
      document.getElementById('folderMeta').textContent = 'Choose a training folder to browse learning modules.';
      document.getElementById('statsBar').classList.add('hidden');
      document.getElementById('tableWrapper').classList.add('hidden');

      const panel = document.getElementById('emptyPlaceholder');
      setEmptyPlaceholderMode('content');
      panel.classList.remove('hidden');

      panel.innerHTML = `
        <div class="w-full max-w-5xl mx-auto py-8">
          <div class="mb-6">
            <h3 class="text-2xl font-semibold text-slate-800">Training</h3>
            <p class="text-sm text-slate-500 mt-1">Open a folder to review role-specific learning material.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${getTrainingFolders().map(folder => {
              const docs = getTrainingFolderDocs(folder.key);
              return `
                <button type="button" onclick="openTrainingFolder('${folder.key}')" class="text-left bg-gradient-to-br ${folder.accent} border rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div class="flex items-start gap-3">
                    <span class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-700 text-white">
                      ${folder.icon}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-3">
                        <div class="text-lg font-semibold text-slate-800">${escapeHtml(folder.label)}</div>
                        <div class="text-xs font-semibold text-slate-600 whitespace-nowrap">${docs.length} document${docs.length === 1 ? '' : 's'}</div>
                      </div>
                      <div class="text-xs text-slate-600 mt-1">${escapeHtml(folder.description)}</div>
                    </div>
                  </div>
                </button>`;
            }).join('')}
          </div>
        </div>`;
    }

    function openTrainingFolder(folderKey) {
      if (!isRestoringHistory) {
        saveViewState();
      }

      const folder = getTrainingFolderByKey(folderKey);
      if (!folder) {
        renderTrainingLanding();
        return;
      }

      const docs = getTrainingFolderDocs(folderKey);
      activeFolder = null;
      activeNodeId = `${TRAINING_FOLDER_PREFIX}${folderKey}`;
      setVirtualFolderControlBadge(true);

      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
      document.getElementById('breadcrumb').innerHTML = `<span class="text-slate-400">Home</span><span class="breadcrumb-sep">/</span><span class="text-slate-400">Training</span><span class="breadcrumb-sep">/</span><span class="text-slate-700 font-medium">${escapeHtml(folder.label)}</span>`;
      document.getElementById('folderTitle').textContent = folder.label;
      document.getElementById('folderMeta').textContent = folder.description;
      document.getElementById('statsBar').classList.add('hidden');
      document.getElementById('emptyPlaceholder').classList.add('hidden');
      document.getElementById('tableWrapper').classList.remove('hidden');
      renderDocTable(docs, '', '', true);
    }

    function renderHomeSectionDocs(section, title, subtitle, docs, isControlled = false) {
      activeFolder = null;
      activeNodeId = `__home_section__${(section || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      setVirtualFolderControlBadge(isControlled);

      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
      document.getElementById('breadcrumb').innerHTML = `<span class="text-slate-400">Home</span><span class="breadcrumb-sep">/</span><span class="text-slate-700 font-medium">${section}</span>`;
      document.getElementById('folderTitle').textContent = title;
      document.getElementById('folderMeta').textContent = subtitle;
      document.getElementById('statsBar').classList.add('hidden');
      document.getElementById('emptyPlaceholder').classList.add('hidden');
      document.getElementById('tableWrapper').classList.remove('hidden');
      renderDocTable(docs, '', '', isControlled);
    }

    function getBestPracticeDisciplines() {
      return [
        { key: 'machinery', label: 'Machinery', accent: 'from-cyan-50 to-cyan-100 border-cyan-200' },
        { key: 'process-engineering', label: 'Process Engineering', accent: 'from-blue-50 to-blue-100 border-blue-200' },
        { key: 'fixed-equipment', label: 'Fixed Equipment', accent: 'from-slate-50 to-slate-100 border-slate-200' },
        { key: 'civil', label: 'Civil', accent: 'from-amber-50 to-amber-100 border-amber-200' },
        { key: 'instrumentation', label: 'Instrumentation', accent: 'from-violet-50 to-violet-100 border-violet-200' },
        { key: 'electrical', label: 'Electrical', accent: 'from-emerald-50 to-emerald-100 border-emerald-200' },
      ];
    }

    function getBestPracticesDocsByDiscipline(disciplineKey) {
      const normalized = normalizeDisciplineKey(disciplineKey);
      return BEST_PRACTICE_DOCS.filter(doc => doc.bpDiscipline === normalized);
    }

    function renderBestPracticesLanding() {
      activeFolder = null;
      activeNodeId = BEST_PRACTICES_VIEW_ID;
      setVirtualFolderControlBadge(true);

      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
      document.getElementById('breadcrumb').innerHTML = '<span class="text-slate-400">Home</span><span class="breadcrumb-sep">/</span><span class="text-slate-700 font-medium">Best Practices</span>';
      document.getElementById('folderTitle').textContent = 'Best Practices';
      document.getElementById('folderMeta').textContent = 'Corporate standards by discipline.';
      document.getElementById('statsBar').classList.add('hidden');
      document.getElementById('tableWrapper').classList.add('hidden');

      const panel = document.getElementById('emptyPlaceholder');
      setEmptyPlaceholderMode('content');
      panel.classList.remove('hidden');

      const disciplines = getBestPracticeDisciplines()
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
      panel.innerHTML = `
        <div class="w-full max-w-4xl mx-auto py-8">
          <div class="mb-6">
            <h3 class="text-2xl font-semibold text-slate-800">Best Practices</h3>
            <p class="text-sm text-slate-500 mt-1">Select a category to view discipline standards.</p>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            ${disciplines.map(d => {
              const docs = getBestPracticesDocsByDiscipline(d.key);
              const latest = docs
                .map(doc => doc.date || '')
                .filter(Boolean)
                .sort((a, b) => b.localeCompare(a))[0] || 'N/A';
              const fileLabel = `${docs.length} file${docs.length === 1 ? '' : 's'}`;
              const subtitle = `${fileLabel} • Last updated ${latest}`;
              return `
              <button type="button" onclick="openBestPracticesDiscipline('${d.key}')" class="w-full text-left px-4 py-3 hover:bg-sky-50 transition-colors flex items-center justify-between gap-3">
                <div>
                  <div class="text-sm font-semibold text-slate-800">${d.label}</div>
                  <div class="text-xs text-slate-500 mt-0.5">${subtitle}</div>
                </div>
                <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            `;
            }).join('')}
          </div>
        </div>`;
    }

    function openBestPracticesDiscipline(disciplineKey) {
      const disciplines = getBestPracticeDisciplines();
      const selected = disciplines.find(d => d.key === disciplineKey);
      if (!selected) return;

      if (!isRestoringHistory) {
        saveViewState();
      }

      const docs = getBestPracticesDocsByDiscipline(disciplineKey);
      activeFolder = null;
      activeNodeId = `${BEST_PRACTICES_DISCIPLINE_PREFIX}${disciplineKey}`;
      setVirtualFolderControlBadge(true);

      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
      document.getElementById('breadcrumb').innerHTML = `<span class="text-slate-400">Home</span><span class="breadcrumb-sep">/</span><button type="button" onclick="renderBestPracticesLanding()" class="text-slate-400 hover:text-blue-600 transition-colors">Best Practices</button><span class="breadcrumb-sep">/</span><span class="text-slate-700 font-medium">${selected.label}</span>`;
      document.getElementById('folderTitle').textContent = `Best Practices - ${selected.label}`;
      document.getElementById('folderMeta').textContent = `${docs.length} corporate standard document(s) from the Best Practices database.`;
      document.getElementById('statsBar').classList.add('hidden');
      document.getElementById('emptyPlaceholder').classList.add('hidden');
      document.getElementById('tableWrapper').classList.remove('hidden');
      renderDocTable(docs, '', '', true);
    }

    function renderPlantSelectionView() {
      activeFolder = null;
      activeNodeId = PLANT_SELECTION_VIEW_ID;
      setFolderControlBadge(null);

      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
      document.getElementById('breadcrumb').innerHTML = '<span class="text-slate-400">Home</span><span class="breadcrumb-sep">/</span><span class="text-slate-700 font-medium">Equipment Documents</span>';
      document.getElementById('folderTitle').textContent = 'Select a Plant';
      document.getElementById('folderMeta').textContent = 'Choose a plant to open its site document hierarchy.';
      document.getElementById('statsBar').classList.add('hidden');
      document.getElementById('tableWrapper').classList.add('hidden');

      const sites = (Array.isArray(TREE) ? TREE : []).filter(node => node?.type === 'site');
      const panel = document.getElementById('emptyPlaceholder');
      setEmptyPlaceholderMode('content');
      panel.classList.remove('hidden');

      panel.innerHTML = `
        <div class="w-full max-w-5xl mx-auto py-8">
          <div class="mb-6">
            <h3 class="text-2xl font-semibold text-slate-800">Plants</h3>
            <p class="text-sm text-slate-500 mt-1">Select a plant to continue.</p>
          </div>

          ${sites.length ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${sites.map(site => {
              const siteId = (site.id || '').replace(/'/g, "\\'");
              const unitCount = Array.isArray(site.children) ? site.children.filter(ch => ch?.type === 'unit').length : 0;
              return `
                <button type="button" onclick="openPlantFromSelection('${siteId}')" class="text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-sky-300 hover:-translate-y-0.5 transition-all">
                  <div class="flex items-start gap-3">
                    <span class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-sky-600 text-white">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M3 10.5l9-7.5 9 7.5V21"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 21v-6h6v6"/></svg>
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="text-lg font-semibold text-slate-800 truncate">${site.label || site.id}</div>
                      <div class="text-xs text-slate-500 mt-1">${unitCount} unit${unitCount !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </button>`;
            }).join('')}
          </div>` : `
          <div class="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-500">No plants are currently available in the site tree.</div>`}
        </div>`;
    }

    function openPlantFromSelection(siteId) {
      if (!siteId) return;

      // Force-add the plant picker as the immediate previous view.
      saveViewState();

      // Navigate without allowing selectNode to push another history snapshot.
      const wasRestoring = isRestoringHistory;
      isRestoringHistory = true;
      selectNode(siteId);
      isRestoringHistory = wasRestoring;
    }

    function openHomeSection(section) {
      if (!isRestoringHistory) {
        saveViewState();
      }

      if (section === 'site-documents') {
        renderPlantSelectionView();
        return;
      }

      if (section === 'procedures') {
        const docs = allDocs.filter(doc => (doc.primaryDocumentType || '').trim() === 'Procedures');
        renderHomeSectionDocs('Procedures', 'Procedures', `${docs.length} procedure document(s) found`, docs, true);
        return;
      }

      if (section === 'best-practices') {
        renderBestPracticesLanding();
        return;
      }

      if (section === 'training') {
        renderTrainingLanding();
        return;
      }

      renderHomeLanding();
    }

    function getDocumentTarget(folderLikeId) {
      const node = findNode(folderLikeId);
      if (node && node.type === 'incident') {
        return {
          folder: node.parentFolderId,
          incidentKey: node.incidentKey,
        };
      }
      return {
        folder: folderLikeId,
        incidentKey: '',
      };
    }

    // ─── Tree Rendering ────────────────────────────────────────────────────────
    function buildTree(nodes, depth = 0, path = []) {
      return nodes.map(node => {
        const currentPath = [...path, node];
        NODE_REGISTRY.set(node.id, { ...node, _path: currentPath });

        const childNodes = [...(node.children || [])];
        if (node.type === 'folder' && getFolderTypeCode(node.id) === 'RH') {
          childNodes.push(...getIncidentNodesForRepairFolder(node.id));
        }

        const hasChildren = childNodes.length > 0;
        const indent = depth * 14;
        const icon = TYPE_ICONS[node.type] || TYPE_ICONS.folder;
        const isFolderLike = node.type === 'folder' || node.type === 'incident';
        const docCount = node.type === 'incident'
          ? getIncidentDocsForNode(node).length
          : isFolderLike ? getDocsForFolderId(node.id).length : null;

        const children = hasChildren
          ? `<div class="tree-children" id="tc-${node.id}">${buildTree(childNodes, depth + 1, currentPath)}</div>` : '';

        const chevron = hasChildren
          ? `<svg class="chevron w-3 h-3 flex-shrink-0" id="cv-${node.id}" onclick="toggleNode('${node.id}', event)" fill="none" stroke="currentColor"
                  stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
             </svg>` : `<span class="w-3 flex-shrink-0"></span>`;

        const badge = docCount !== null
          ? `<span class="ml-auto text-xs font-semibold bg-slate-100 text-slate-500 rounded-full px-1.5 py-0 leading-5">${docCount}</span>` : '';

        const clickHandler = `onclick="selectNode('${node.id}')"`;

        return `
          <div id="tn-${node.id}">
            <div class="tree-node-label" id="tl-${node.id}" style="padding-left:${8 + indent}px" ${clickHandler}>
              ${chevron}
              ${icon}
              <span class="truncate flex-1">${node.label}</span>
              ${badge}
            </div>
            ${children}
          </div>`;
      }).join('');
    }

    function renderTree() {
      if (!Array.isArray(TREE)) {
        document.getElementById('assetTree').innerHTML = `<div class="px-2 py-2 text-xs text-slate-400">#NA</div>`;
        return;
      }
      NODE_REGISTRY = new Map();
      document.getElementById('assetTree').innerHTML = buildTree(TREE);
      applyTreeFilter(document.getElementById('treeSearch').value || '');
    }

    function setTreeExpanded(id, open) {
      const tc = document.getElementById('tc-' + id);
      const cv = document.getElementById('cv-' + id);
      if (tc) tc.classList.toggle('open', open);
      if (cv) cv.classList.toggle('open', open);
    }

    function applyTreeFilter(rawQuery) {
      if (!Array.isArray(TREE)) return;
      const q = rawQuery.trim().toLowerCase();
      const visible = new Set();
      const expanded = new Set();

      if (!q) {
        document.querySelectorAll('[id^="tn-"]').forEach(nodeEl => {
          nodeEl.style.display = '';
        });
      }

      function visit(node) {
        const selfMatch = node.label.toLowerCase().includes(q);
        let childMatch = false;
        (node.children || []).forEach(child => {
          if (visit(child)) childMatch = true;
        });

        const showNode = !q || selfMatch || childMatch;
        if (showNode) visible.add(node.id);
        if (q && (selfMatch || childMatch) && node.children && node.children.length) {
          expanded.add(node.id);
        }

        return showNode;
      }

      TREE.forEach(visit);

      if (q) {
        document.querySelectorAll('[id^="tn-"]').forEach(nodeEl => {
          const id = nodeEl.id.replace('tn-', '');
          if (visible.has(id)) {
            nodeEl.style.display = '';
            return;
          }

          const node = NODE_REGISTRY.get(id);
          if (node && node.type === 'incident') {
            const selfMatch = (node.label || '').toLowerCase().includes(q);
            const parentVisible = !!node.parentFolderId && visible.has(node.parentFolderId);
            nodeEl.style.display = selfMatch || parentVisible ? '' : 'none';
            return;
          }

          nodeEl.style.display = 'none';
        });
      }

      document.querySelectorAll('.tree-children').forEach(el => el.classList.remove('open'));
      document.querySelectorAll('.chevron').forEach(el => el.classList.remove('open'));

      if (q) {
        expanded.forEach(id => setTreeExpanded(id, true));
      }

      // Keep current active node visible after filtering where possible.
      document.querySelectorAll('.tree-node-label.active').forEach(el => {
        const parent = el.closest('[id^="tn-"]');
        if (parent && parent.style.display === 'none') {
          el.classList.remove('active');
        }
      });
    }

    function collapseAllFolders() {
      document.querySelectorAll('.tree-children').forEach(el => el.classList.remove('open'));
      document.querySelectorAll('.chevron').forEach(el => el.classList.remove('open'));
    }

    function resetDisplay() {
      // Clear all filters and selections
      const treeSearch = document.getElementById('treeSearch');
      if (treeSearch) treeSearch.value = '';

      const docSearch = document.getElementById('docSearch');
      if (docSearch) docSearch.value = '';

      // Close any open modals
      closeAdvancedFilterModal();
      closeUploadModal();
      closePreviewModal();

      // Clear advanced filter inputs
      clearAdvancedFilterInputs();

      // Clear active selection
      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
      activeFolder = null;
      activeNodeId = null;

      // Collapse all folders
      collapseAllFolders();

      document.getElementById('documentList').innerHTML = '';
      document.getElementById('noResults').classList.add('hidden');

      // Re-render tree without filters
      renderTree();
      renderHomeLanding();
    }

    function wildcardMatch(value, token) {
      if (!token) return true;
      const text = (value || '').toString();
      const pattern = token.includes('*') ? token : `*${token}*`;
      return wildcardToRegExp(pattern).test(text);
    }

    function parseAdvancedContext(node, branch) {
      const siteNode = branch.find(n => n.type === 'site');
      const unitNode = branch.find(n => n.type === 'unit');
      const equipNode = branch.find(n => n.type === 'equip');

      const siteLabel = siteNode?.label || '';
      const unitLabel = unitNode?.label || '';
      const equipLabel = equipNode?.label || '';
      const folderType = node.type === 'folder' ? (node.id.split('-').pop() || '') : '';
      const folderLabel = node.type === 'folder' ? node.label : '';

      const siteCodeMatch = siteLabel.match(/^([A-Za-z]\d{3})\s+/);
      const unitNumberMatch = unitLabel.match(/^(\d+)\s+/);
      const equipParts = equipLabel.split('—').map(s => s.trim());

      const siteCode = siteCodeMatch ? siteCodeMatch[1] : '';
      const siteName = siteCodeMatch ? siteLabel.replace(siteCodeMatch[0], '') : siteLabel;
      const unitNumber = unitNumberMatch ? unitNumberMatch[1] : '';
      const unitName = unitNumberMatch ? unitLabel.replace(unitNumberMatch[0], '') : unitLabel;
      const equipTag = equipParts[0] || '';
      const equipName = equipParts[1] || equipLabel;
      const equipClass = equipNode ? (EQUIP_DATASHEET?.[equipNode.id]?.class || '') : '';
      const equipment = equipLabel; // Full combined equipment label

      return {
        site: siteLabel,
        unit: unitLabel,
        equipment,
        equipTag,
        equipName,
        equipClass,
        folderType,
        folderLabel,
      };
    }

    function getAdvancedFilterRows() {
      if (!Array.isArray(TREE)) return [];
      const rows = [];

      function walk(node, path = []) {
        const branch = [...path, node];
        if (node.type === 'folder') {
          rows.push({ ...parseAdvancedContext(node, branch), label: node.label });
        }
        (node.children || []).forEach(child => walk(child, branch));
      }

      TREE.forEach(node => walk(node, []));
      return rows;
    }

    function getAdvancedDropdownFields() {
      return [
        { id: 'afSite', key: 'site' },
        { id: 'afUnit', key: 'unit' },
        { id: 'afEquipmentType', key: 'equipClass' },
        { id: 'afEquipment', key: 'equipment' },
        { id: 'afFolderType', key: 'folderLabel' },
      ];
    }

    function hasAdvancedCriteria(criteria) {
      const keys = ['site', 'unit', 'equipment', 'equipClass', 'folderType', 'labelWildcard'];
      return keys.some(key => ((criteria[key] || '').trim().length > 0));
    }

    function matchesAdvancedCriteria(context, nodeLabel, criteria) {
      // For equipment matching, extract tag and name and combine them
      const equipmentLabel = context.equipTag && context.equipName 
        ? `${context.equipTag} — ${context.equipName}` 
        : context.equipTag || context.equipName || '';
      
      return (
        wildcardMatch(context.site, criteria.site) &&
        wildcardMatch(context.unit, criteria.unit) &&
        wildcardMatch(equipmentLabel, criteria.equipment) &&
        wildcardMatch(context.equipClass, criteria.equipClass) &&
        (wildcardMatch(context.folderType, criteria.folderType) || wildcardMatch(context.folderLabel, criteria.folderType)) &&
        wildcardMatch(nodeLabel, criteria.labelWildcard)
      );
    }

    function getMatchingAdvancedFolderIds(criteria) {
      if (!Array.isArray(TREE)) return [];
      const ids = [];

      function walk(node, path = []) {
        const branch = [...path, node];
        if (node.type === 'folder') {
          const context = parseAdvancedContext(node, branch);
          if (matchesAdvancedCriteria(context, node.label, criteria)) {
            ids.push(node.id);
          }
        }
        (node.children || []).forEach(child => walk(child, branch));
      }

      TREE.forEach(node => walk(node, []));
      return ids;
    }

    function renderAdvancedDocsView(folderIds) {
      activeFolder = null;
      activeNodeId = null;
      setFolderControlBadge(null);
      const docs = getDocsForFolderIds(folderIds);
      const query = document.getElementById('docSearch')?.value || '';

      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
      document.getElementById('breadcrumb').innerHTML = '<span class="text-slate-500">Advanced filter</span>';
      document.getElementById('folderTitle').textContent = 'Filtered documents';
      document.getElementById('folderMeta').textContent = `${docs.length} document(s) across ${folderIds.length} matching folder(s)`;

      const statsBar = document.getElementById('statsBar');
      statsBar.classList.add('hidden');
      document.getElementById('emptyPlaceholder').classList.add('hidden');
      document.getElementById('tableWrapper').classList.remove('hidden');

      renderDocTable(docs, query, '', false);
    }

    function refreshAdvancedFilterDropdowns() {
      const rows = getAdvancedFilterRows();
      const criteria = readAdvancedFilterCriteria();
      const fields = getAdvancedDropdownFields();

      const formatEquipmentTypeLabel = (value) => {
        return (value || '')
          .split('-')
          .filter(Boolean)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      };

      // Enforce sequential ordering: Site → Unit → Equipment → Equipment Type
      const siteSelected = criteria.site && criteria.site.trim().length > 0;
      const unitSelected = criteria.unit && criteria.unit.trim().length > 0;
      const equipmentSelected = criteria.equipment && criteria.equipment.trim().length > 0;
      
      fields.forEach(field => {
        const selectEl = document.getElementById(field.id);
        if (!selectEl) return;
        const currentValue = selectEl.value || '';

        // If Unit field and no Site selected, disable it and clear
        if (field.id === 'afUnit' && !siteSelected) {
          selectEl.disabled = true;
          selectEl.innerHTML = '<option value="">Select Site first</option>';
          selectEl.value = '';
          return;
        }
        
        // If Equipment field and no Unit selected, disable it and clear
        if (field.id === 'afEquipment' && !unitSelected) {
          selectEl.disabled = true;
          selectEl.innerHTML = '<option value="">Select Unit first</option>';
          selectEl.value = '';
          return;
        }
        
        // If Equipment Type field and no Site or Unit selected, disable it and clear
        if (field.id === 'afEquipmentType' && (!siteSelected || !unitSelected)) {
          selectEl.disabled = true;
          selectEl.innerHTML = '<option value="">Select Site and Unit first</option>';
          selectEl.value = '';
          return;
        }
        
        selectEl.disabled = false;

        const candidateRows = rows.filter(row => {
          return fields.every(other => {
            const selected = criteria[other.key];
            if (!selected || other.key === field.key) return true;
            if (other.key === 'equipment') {
              // Match combined equipment label
              const combined = row.equipTag && row.equipName ? `${row.equipTag} — ${row.equipName}` : '';
              return combined.toLowerCase() === selected.toLowerCase();
            }
            return (row[other.key] || '').toLowerCase() === selected.toLowerCase();
          }) && wildcardMatch(row.label || '', criteria.labelWildcard);
        });

        let options = [];
        if (field.id === 'afEquipment') {
          // Combine tag and name for Equipment field
          const equipmentSet = new Set();
          candidateRows.forEach(row => {
            if (row.equipTag && row.equipName) {
              equipmentSet.add(`${row.equipTag} — ${row.equipName}`);
            }
          });
          options = Array.from(equipmentSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        } else {
          options = Array.from(new Set(candidateRows.map(row => row[field.key]).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        }

        selectEl.innerHTML = '<option value="">Any</option>' +
          options.map(opt => {
            const display = field.id === 'afEquipmentType' ? formatEquipmentTypeLabel(opt) : opt;
            return `<option value="${opt}">${display}</option>`;
          }).join('');

        if (currentValue && options.includes(currentValue)) {
          selectEl.value = currentValue;
        }
      });
    }

    function applyAdvancedTreeFilter(criteria) {
      if (!Array.isArray(TREE)) return;
      const hasCriteria = hasAdvancedCriteria(criteria);
      if (!hasCriteria) {
        const treeSearch = document.getElementById('treeSearch');
        applyTreeFilter(treeSearch ? treeSearch.value : '');
        return;
      }

      const visible = new Set();
      const expanded = new Set();

      function visit(node, path = []) {
        const branch = [...path, node];
        const context = parseAdvancedContext(node, branch);
        const selfMatch = matchesAdvancedCriteria(context, node.label, criteria);

        let childMatch = false;

        (node.children || []).forEach(child => {
          if (visit(child, branch)) childMatch = true;
        });

        const showNode = selfMatch || childMatch;
        if (showNode) visible.add(node.id);
        if (showNode && node.children && node.children.length) expanded.add(node.id);
        return showNode;
      }

      TREE.forEach(node => visit(node, []));

      document.querySelectorAll('[id^="tn-"]').forEach(nodeEl => {
        const id = nodeEl.id.replace('tn-', '');
        nodeEl.style.display = visible.has(id) ? '' : 'none';
      });

      collapseAllFolders();
      expanded.forEach(id => setTreeExpanded(id, true));
    }

    function setAdvancedFilterButtonState(open) {
      const btn = document.getElementById('advancedFilterBtn');
      if (!btn) return;
      btn.classList.toggle('bg-blue-600', open);
      btn.classList.toggle('text-white', open);
      btn.classList.toggle('border-blue-600', open);
      btn.classList.toggle('hover:bg-blue-700', open);
      btn.classList.toggle('text-slate-600', !open);
      btn.classList.toggle('border-slate-200', !open);
      btn.classList.toggle('hover:bg-slate-50', !open);
    }

    function openAdvancedFilterModal() {
      const modal = document.getElementById('advancedFilterModal');
      if (!modal) return;
      refreshAdvancedFilterDropdowns();
      modal.classList.remove('hidden');
      setAdvancedFilterButtonState(true);
    }

    function closeAdvancedFilterModal() {
      const modal = document.getElementById('advancedFilterModal');
      if (!modal) return;
      modal.classList.add('hidden');
      setAdvancedFilterButtonState(false);
    }

    function readAdvancedFilterCriteria() {
      return {
        site: document.getElementById('afSite')?.value.trim() || '',
        unit: document.getElementById('afUnit')?.value.trim() || '',
        equipment: document.getElementById('afEquipment')?.value.trim() || '',
        equipClass: document.getElementById('afEquipmentType')?.value.trim() || '',
        folderType: document.getElementById('afFolderType')?.value.trim() || '',
        labelWildcard: document.getElementById('afLabelWildcard')?.value.trim() || '',
        displayAllDocs: document.getElementById('afDisplayAllDocs')?.checked || false,
      };
    }

    function clearAdvancedFilterInputs() {
      ['afSite', 'afUnit', 'afEquipment', 'afEquipmentType', 'afFolderType', 'afLabelWildcard']
        .forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
      const displayAllDocs = document.getElementById('afDisplayAllDocs');
      if (displayAllDocs) displayAllDocs.checked = false;
      refreshAdvancedFilterDropdowns();
    }

    function toggleNode(id, event) {
      if (event) event.stopPropagation();
      const tc = document.getElementById('tc-' + id);
      const cv = document.getElementById('cv-' + id);
      if (!tc) return;
      tc.classList.toggle('open');
      if (cv) cv.classList.toggle('open');
    }

    function captureHistoryState() {
      return {
        activeFolder,
        activeNodeId,
        treeSearch: document.getElementById('treeSearch')?.value || '',
        docSearch: document.getElementById('docSearch')?.value || '',
      };
    }

    function applyHistoryStateFilters(state) {
      const treeSearch = document.getElementById('treeSearch');
      if (treeSearch) {
        treeSearch.value = state.treeSearch || '';
        applyTreeFilter(treeSearch.value);
      }

      const docSearch = document.getElementById('docSearch');
      if (docSearch) {
        docSearch.value = state.docSearch || '';
        if (docSearch.value && activeFolder) {
          docSearch.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }

    function saveViewState() {
      viewHistory.push(captureHistoryState());
      forwardHistory = [];  // Clear forward history when navigating to new view
      updateBackButtonState();
    }

    function goBack() {
      if (viewHistory.length === 0) return;

      // Save current state to forward history
      forwardHistory.push(captureHistoryState());
      
      const state = viewHistory.pop();
      restoreViewState(state);
      updateBackButtonState();
    }

    function goForward() {
      if (forwardHistory.length === 0) return;

      // Save current state to back history
      viewHistory.push(captureHistoryState());
      
      const state = forwardHistory.pop();
      restoreViewState(state);
      updateBackButtonState();
    }

    function restoreViewState(state) {
      if (!state || typeof state !== 'object') {
        renderHomeLanding();
        return;
      }

      // Rebuild virtual views directly rather than relying on serialized panel HTML.
      if (state.activeNodeId === HOME_VIEW_ID) {
        renderHomeLanding();
        applyHistoryStateFilters(state);
        return;
      }
      if (state.activeNodeId === PLANT_SELECTION_VIEW_ID) {
        renderPlantSelectionView();
        applyHistoryStateFilters(state);
        return;
      }
      if (state.activeNodeId === BEST_PRACTICES_VIEW_ID) {
        renderBestPracticesLanding();
        applyHistoryStateFilters(state);
        return;
      }
      if (state.activeNodeId === TRAINING_VIEW_ID) {
        renderTrainingLanding();
        applyHistoryStateFilters(state);
        return;
      }
      if (typeof state.activeNodeId === 'string' && state.activeNodeId.startsWith(BEST_PRACTICES_DISCIPLINE_PREFIX)) {
        const disciplineKey = state.activeNodeId.replace(BEST_PRACTICES_DISCIPLINE_PREFIX, '');
        isRestoringHistory = true;
        openBestPracticesDiscipline(disciplineKey);
        isRestoringHistory = false;
        applyHistoryStateFilters(state);
        return;
      }
      if (typeof state.activeNodeId === 'string' && state.activeNodeId.startsWith(TRAINING_FOLDER_PREFIX)) {
        const folderKey = state.activeNodeId.replace(TRAINING_FOLDER_PREFIX, '');
        isRestoringHistory = true;
        openTrainingFolder(folderKey);
        isRestoringHistory = false;
        applyHistoryStateFilters(state);
        return;
      }

      activeFolder = state.activeFolder;
      activeNodeId = state.activeNodeId || null;
      setFolderControlBadge(activeFolder ? findNode(activeFolder) : null);

      if (activeNodeId
        && activeNodeId !== HOME_VIEW_ID
        && activeNodeId !== PLANT_SELECTION_VIEW_ID
        && activeNodeId !== BEST_PRACTICES_VIEW_ID
        && activeNodeId !== TRAINING_VIEW_ID
        && !activeNodeId.startsWith(BEST_PRACTICES_DISCIPLINE_PREFIX)
        && !activeNodeId.startsWith(TRAINING_FOLDER_PREFIX)
        && !activeNodeId.startsWith('__home_section__')) {
        isRestoringHistory = true;
        selectNode(activeNodeId);
        isRestoringHistory = false;
      }

      applyHistoryStateFilters(state);
    }

    function updateBackButtonState() {
      const backBtn = document.getElementById('backBtn');
      const forwardBtn = document.getElementById('forwardBtn');
      if (!backBtn || !forwardBtn) return;
      
      if (viewHistory.length > 0) {
        backBtn.classList.remove('hidden');
      } else {
        backBtn.classList.add('hidden');
      }
      
      if (forwardHistory.length > 0) {
        forwardBtn.classList.remove('hidden');
      } else {
        forwardBtn.classList.add('hidden');
      }
    }

    function selectFolder(id) {
      // Deactivate previous
      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));

      // Activate new
      const label = document.getElementById('tl-' + id);
      if (label) label.classList.add('active');

      // Save current view state before changing
      if (!isRestoringHistory && activeNodeId !== null) {
        saveViewState();
      }

      // Expand parent equip node if not open
      const node = findNode(id);
      activeFolder = id;
      activeNodeId = id;
      renderMainPane(node);
    }

    function selectNode(id) {
      const node = findNode(id);
      if (!node) return;
      if (node.type === 'folder' || node.type === 'incident') {
        selectFolder(id);
        return;
      }
      if (node.type === 'equip') {
        selectEquip(id);
        return;
      }

      document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
      const label = document.getElementById('tl-' + id);
      if (label) label.classList.add('active');

      if (!isRestoringHistory && activeNodeId !== null) {
        saveViewState();
      }
      activeFolder = null;
      activeNodeId = id;
      renderHierarchyPane(node);
    }

    function selectEquip(id) {
            if (!isRestoringHistory && activeNodeId !== null) {
              saveViewState();
            }
            // Set active highlight (but don't mark a folder active)
            document.querySelectorAll('.tree-node-label.active').forEach(el => el.classList.remove('active'));
            const label = document.getElementById('tl-' + id);
            if (label) label.classList.add('active');
            activeFolder = null;
            activeNodeId = id;

            const node = findNode(id);
            if (!node) return;

            // Build breadcrumb
            const ancestors = getAncestors(id) || [];
            document.getElementById('breadcrumb').innerHTML = buildBreadcrumbHTML(ancestors);

            document.getElementById('folderTitle').textContent = node.label;
            setFolderControlBadge(null);
            document.getElementById('folderMeta').textContent = 'Equipment Summary — select a document folder below to view documents';
            document.getElementById('statsBar').classList.add('hidden');
            document.getElementById('tableWrapper').classList.add('hidden');
            document.getElementById('emptyPlaceholder').classList.add('hidden');

            const parts = Array.isArray(JDE_PARTS?.[id]) ? JDE_PARTS[id] : [];
            const wos   = Array.isArray(MAXIMO_WOS?.[id]) ? MAXIMO_WOS[id] : [];
            const totalDocs = getDocsForEquipmentId(id).length;
            const openWOs = wos.filter(w => w.status === 'INPRG' || w.status === 'WPCOND' || w.status === 'WAPPR').length;
            const sheet = EQUIP_DATASHEET[id] || null;
            const folderChildren = getTreeChildren(node).filter(ch => ch.type === 'folder');

            const equipPanel = document.getElementById('emptyPlaceholder');
            setEmptyPlaceholderMode('content');
            equipPanel.classList.remove('hidden');
            equipPanel.innerHTML = `
              <div class="w-full text-left space-y-4">

                ${folderChildren.length ? `
                <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div class="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Subfolders</div>
                  <div class="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                    ${folderChildren.map(child => {
                      const childDocs = getDocsForFolderId(child.id).length;
                      return `<button type="button" onclick="selectNode('${child.id}')" class="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2.5">
                        <span class="mt-0.5">${TYPE_ICONS.folder}</span>
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-medium text-slate-800 truncate">${child.label}</div>
                        </div>
                        <div class="text-xs text-slate-500 whitespace-nowrap">${childDocs} document${childDocs !== 1 ? 's' : ''}</div>
                      </button>`;
                    }).join('')}
                  </div>
                </div>
                ` : ''}

                <!-- KPI strip -->
                <div class="grid grid-cols-3 gap-3">
                  <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div class="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Total Documents</div>
                    <div class="text-2xl font-bold text-slate-800">${totalDocs}</div>
                    <div class="text-xs text-slate-400 mt-0.5">Across all folders</div>
                  </div>
                  <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div class="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Maximo WOs
                    </div>
                    <div class="text-2xl font-bold text-slate-800">${wos.length}</div>
                    <div class="text-xs ${openWOs > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'} mt-0.5">${openWOs} open / active</div>
                  </div>
                  <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div class="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>JDE Spare Parts
                    </div>
                    <div class="text-2xl font-bold text-slate-800">${parts.length}</div>
                    <div class="text-xs ${parts.some(p=>p.status!=='Active') ? 'text-amber-600 font-medium' : 'text-slate-400'} mt-0.5">
                      ${parts.filter(p=>p.status!=='Active').length > 0 ? parts.filter(p=>p.status!=='Active').length + ' requiring attention' : 'All in stock'}
                    </div>
                  </div>
                </div>

                <!-- General Datasheet -->
                ${sheet ? `
                <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div class="flex items-center justify-between mb-3">
                    <div class="text-xs font-semibold text-slate-700 uppercase tracking-wide">Equipment Datasheet</div>
                    <span class="badge-status bg-slate-100 text-slate-600">${sheet.tag}</span>
                  </div>
                  <div class="grid grid-cols-3 gap-x-4 gap-y-2 text-xs">${renderDatasheetFields(sheet)}</div>
                </div>
                ` : ''}

                <!-- Two-column: Maximo + JDE -->
                <div class="grid grid-cols-2 gap-4">

                  <!-- Maximo Work Orders -->
                  <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span class="text-xs font-semibold text-slate-700 uppercase tracking-wide">Maximo — Work Orders</span>
                      </div>
                      <span class="text-xs text-slate-400">CMMS</span>
                    </div>
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wide">
                          <th class="px-3 py-2 text-left">WO #</th>
                          <th class="px-3 py-2 text-left">Description</th>
                          <th class="px-3 py-2 text-left">Type</th>
                          <th class="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-50">
                        ${wos.map(wo => {
                          const s = WO_STATUS_STYLE[wo.status] || 'bg-slate-100 text-slate-500';
                          const sl = (WO_STATUS_STYLE[wo.status] || {}).label || wo.status;
                          return `<tr class="hover:bg-slate-50 transition-colors">
                            <td class="px-3 py-2 font-mono text-blue-600 font-medium">${wo.wo}</td>
                            <td class="px-3 py-2 text-slate-700 max-w-[160px] truncate" title="${wo.desc}">${wo.desc}</td>
                            <td class="px-3 py-2"><span class="badge-status bg-slate-100 text-slate-600">${wo.type}</span></td>
                            <td class="px-3 py-2"><span class="badge-status ${s}">${sl}</span></td>
                          </tr>`;
                        }).join('')}
                      </tbody>
                    </table>
                    ${wos.length === 0 ? '<div class="px-4 py-6 text-center text-slate-300 text-xs">No work orders found</div>' : ''}
                  </div>

                  <!-- JDE Spare Parts -->
                  <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span class="text-xs font-semibold text-slate-700 uppercase tracking-wide">JD Edwards — Spare Parts</span>
                      </div>
                      <span class="text-xs text-slate-400">Branch: WHM-01</span>
                    </div>
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wide">
                          <th class="px-3 py-2 text-left">Part No.</th>
                          <th class="px-3 py-2 text-left">Description</th>
                          <th class="px-3 py-2 text-center">Qty</th>
                          <th class="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-50">
                        ${parts.map(p => {
                          const sc = JDE_STOCK_STYLE[p.status] || 'bg-slate-100 text-slate-500';
                          return `<tr class="hover:bg-slate-50 transition-colors">
                            <td class="px-3 py-2 font-mono text-slate-700 font-medium">${p.partNo}</td>
                            <td class="px-3 py-2 text-slate-700 max-w-[160px] truncate" title="${p.desc}">${p.desc}</td>
                            <td class="px-3 py-2 text-center font-semibold text-slate-800">${p.qty} <span class="text-slate-400 font-normal">${p.uom}</span></td>
                            <td class="px-3 py-2"><span class="badge-status ${sc}">${p.status}</span></td>
                          </tr>`;
                        }).join('')}
                      </tbody>
                    </table>
                    ${parts.length === 0 ? '<div class="px-4 py-6 text-center text-slate-300 text-xs">No spare parts linked</div>' : ''}
                  </div>
                </div>

                <p class="text-xs text-slate-400 text-center pb-2">
                  Integration data shown is illustrative. In production, records would be fetched live via JDE and Maximo APIs.
                </p>
              </div>`;
    }

    function findNode(id, nodes = TREE) {
      if (NODE_REGISTRY.has(id)) return NODE_REGISTRY.get(id);
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) { const r = findNode(id, n.children); if (r) return r; }
      }
      return null;
    }

    function getAncestors(id, nodes = TREE, path = []) {
      const registered = NODE_REGISTRY.get(id);
      if (registered && Array.isArray(registered._path)) return registered._path;
      for (const n of nodes) {
        if (n.id === id) return [...path, n];
        if (n.children) {
          const r = getAncestors(id, n.children, [...path, n]);
          if (r) return r;
        }
      }
      return null;
    }

    function buildBreadcrumbHTML(ancestors = []) {
      return ancestors.map((a, i) => {
        const isLast = i === ancestors.length - 1;
        const escapedId = (a.id || '').replace(/'/g, "\\'");
        const label = a.label || '';
        if (isLast) {
          return `${i > 0 ? '<span class="breadcrumb-sep">/</span>' : ''}<span class="text-slate-700 font-medium">${label}</span>`;
        }
        return `${i > 0 ? '<span class="breadcrumb-sep">/</span>' : ''}<button type="button" onclick="selectNode('${escapedId}')" class="text-slate-400 hover:text-blue-600 transition-colors">${label}</button>`;
      }).join('');
    }

    // ─── Main Pane ─────────────────────────────────────────────────────────────
    function renderMainPane(node) {
      if (!node) return;
      if (node.type === 'folder' && getFolderTypeCode(node.id) === 'RH') {
        renderRepairHistoryPane(node);
        return;
      }

      const ancestors = getAncestors(node.id) || [];
      const breadcrumbEl = document.getElementById('breadcrumb');
      breadcrumbEl.innerHTML = buildBreadcrumbHTML(ancestors);

      document.getElementById('folderTitle').textContent = node.label;
      setFolderControlBadge(node);

      const docs = node.type === 'incident'
        ? getIncidentDocsForNode(node)
        : getDocsForFolderId(node.id);
      document.getElementById('folderMeta').textContent =
        `${docs.length} document${docs.length !== 1 ? 's' : ''} · Last updated ${docs.length ? docs.slice().sort((a,b)=>b.date.localeCompare(a.date))[0].date : '—'}`;

      // Stats bar
      const statsBar = document.getElementById('statsBar');
      statsBar.classList.remove('hidden');
      document.getElementById('statCount').textContent = docs.length;
      document.getElementById('statSize').textContent = docs.length
        ? docs.reduce((acc, d) => acc + parseFloat(d.size) || 0, 0).toFixed(1) + ' MB est.'
        : '0';
      document.getElementById('statLastMod').textContent = docs.length
        ? docs.slice().sort((a,b)=>b.date.localeCompare(a.date))[0].date : '—';

      document.getElementById('emptyPlaceholder').classList.add('hidden');
      document.getElementById('tableWrapper').classList.remove('hidden');

      renderDocTable(docs, '', node.type === 'incident' ? node.parentFolderId : node.id, !!getFolderPolicy(node)?.controlled);
    }

    function renderRepairHistoryPane(node) {
      const ancestors = getAncestors(node.id) || [];
      const breadcrumbEl = document.getElementById('breadcrumb');
      breadcrumbEl.innerHTML = buildBreadcrumbHTML(ancestors);

      document.getElementById('folderTitle').textContent = node.label;
      setFolderControlBadge(node);

      const incidentNodes = getIncidentNodesForRepairFolder(node.id);
      const allRepairDocs = getDocsForFolderId(node.id);
      const latestDate = allRepairDocs.length
        ? allRepairDocs.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0].date
        : '—';

      document.getElementById('folderMeta').textContent =
        `${incidentNodes.length} past failure${incidentNodes.length !== 1 ? 's' : ''} · ${allRepairDocs.length} document${allRepairDocs.length !== 1 ? 's' : ''}`;

      const statsBar = document.getElementById('statsBar');
      statsBar.classList.remove('hidden');
      document.getElementById('statCount').textContent = incidentNodes.length;
      document.getElementById('statSize').textContent = `${allRepairDocs.length} linked docs`;
      document.getElementById('statLastMod').textContent = latestDate;

      document.getElementById('tableWrapper').classList.add('hidden');
      const panel = document.getElementById('emptyPlaceholder');
      setEmptyPlaceholderMode('content');
      panel.classList.remove('hidden');

      panel.innerHTML = `
        <div class="w-full text-left space-y-4">
          ${buildChildNodeCards(node)}
          ${incidentNodes.length === 0 ? `
            <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div class="text-sm text-slate-500">No past failures are recorded yet for this equipment.</div>
            </div>
          ` : ''}
        </div>`;
    }

    function renderDocTable(docs, query, folderContextId = '', forceControlled = false) {
      const tbody = document.getElementById('documentList');
      const noResults = document.getElementById('noResults');
      const filtered = query
        ? docs.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
        : docs;

      tbody.innerHTML = '';
      if (!filtered.length) {
        noResults.textContent = 'No documents found for this section.';
        noResults.classList.remove('hidden');
        return;
      }
      noResults.textContent = 'No documents match your filter.';
      noResults.classList.add('hidden');

      filtered.forEach(doc => {
        const ext = (doc.ext || 'file').toLowerCase();
        const extMeta = EXT_ICONS[ext] || { icon: ext.toUpperCase().slice(0,4), color: 'bg-slate-100 text-slate-600' };
        const statusCls = STATUS_STYLE[doc.status] || 'bg-slate-100 text-slate-500';
        const statusData = getStatusTooltipData(doc);
        const deleteFolderId = folderContextId || doc.folder || activeFolder || '';
        const canDeleteDoc = !forceControlled && !currentFolderControlled && canDeleteFolderId(deleteFolderId);
        const deleteButtonHtml = !canDeleteDoc
          ? `<button disabled aria-disabled="true" title="Controlled folder" class="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-100 text-slate-400 font-medium opacity-60 cursor-not-allowed pointer-events-none select-none shadow-none">Delete</button>`
          : `<button onclick="deleteDoc('${doc.id}')" class="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-50 font-medium transition-colors">Delete</button>`;
        const tr = document.createElement('tr');
        tr.className = 'doc-row transition-colors';
        tr.innerHTML = `
          <td class="pl-4 pr-1 py-2.5">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${extMeta.color}">${extMeta.icon}</span>
          </td>
          <td class="px-4 py-2.5">
            <div class="font-medium text-slate-800 text-sm truncate max-w-xs" title="${doc.name}">${doc.name}</div>
            <div class="text-xs text-slate-400 mt-0.5">Uploaded by ${doc.uploader || '—'}</div>
          </td>
          <td class="px-4 py-2.5 text-xs text-slate-500">${doc.rev || '—'}</td>
          <td class="px-4 py-2.5">
            <span class="badge-status ${extMeta.color}">${ext.toUpperCase()}</span>
          </td>
          <td class="px-4 py-2.5 text-xs text-slate-500">${doc.size || '—'}</td>
          <td class="px-4 py-2.5 text-xs text-slate-500">${doc.date || '—'}</td>
          <td class="px-4 py-2.5">
            <span
              class="badge-status ${statusCls} status-tooltip-trigger"
              role="button"
              tabindex="0"
              aria-label="${escapeHtml(statusData.statusLabel)} status details"
            >${escapeHtml(statusData.statusLabel)}</span>
          </td>
          <td class="px-4 py-2.5 text-right">
            <div class="flex items-center justify-end gap-1">
              <button onclick="previewDoc('${doc.id}')"
                class="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50 font-medium transition-colors">View</button>
              ${deleteButtonHtml}
            </div>
          </td>`;
        tbody.appendChild(tr);

        const statusTrigger = tr.querySelector('.status-tooltip-trigger');
        if (statusTrigger) {
          statusTrigger.addEventListener('mouseenter', event => showStatusTooltip(doc, event, statusTrigger));
          statusTrigger.addEventListener('mousemove', event => moveStatusTooltip(event, statusTrigger));
          statusTrigger.addEventListener('mouseleave', hideStatusTooltip);
          statusTrigger.addEventListener('focus', event => showStatusTooltip(doc, event, statusTrigger));
          statusTrigger.addEventListener('blur', hideStatusTooltip);
          statusTrigger.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              showStatusTooltip(doc, event, statusTrigger);
            }
          });
        }
      });
    }

    // ─── Document Actions ──────────────────────────────────────────────────────
    function deleteDoc(id) {
      const doc = allDocs.find(d => d.id === id);
      if (!doc) return;
      const folderId = doc.folder || activeFolder || '';
      if (!canDeleteFolderId(folderId)) {
        alert('Delete is disabled for controlled folders.');
        return;
      }
      if (!confirm('Delete this document?')) return;
      allDocs = allDocs.filter(d => d.id !== id);
      persist();
      if (activeFolder) {
        const node = findNode(activeFolder);
        renderMainPane(node);
      }
      refreshTree();
    }

    function previewDoc(id) {
      const doc = allDocs.find(d => d.id === id);
      if (!doc) return;
      document.getElementById('previewTitle').textContent = doc.name;
      document.getElementById('previewMeta').textContent =
        `${doc.ext?.toUpperCase() || 'FILE'} · ${doc.size || '—'} · ${doc.date || '—'} · ${doc.rev || '—'}`;
      const statusCls = STATUS_STYLE[doc.status] || 'bg-slate-100 text-slate-500';
      document.getElementById('previewStatus').innerHTML =
        `<span class="badge-status ${statusCls}">${doc.status}</span>`;

      document.getElementById('previewBody').innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="bg-slate-50 rounded-lg p-3">
            <div class="text-slate-400 font-semibold uppercase tracking-wide mb-1">Document Info</div>
            <div class="space-y-1">
              <div><span class="text-slate-500">Title:</span> <span class="text-slate-800 font-medium">${doc.name}</span></div>
              <div><span class="text-slate-500">Revision:</span> <span class="text-slate-800">${doc.rev || '—'}</span></div>
              <div><span class="text-slate-500">File Type:</span> <span class="text-slate-800">${doc.ext?.toUpperCase() || '—'}</span></div>
              <div><span class="text-slate-500">File Size:</span> <span class="text-slate-800">${doc.size || '—'}</span></div>
            </div>
          </div>
          <div class="bg-slate-50 rounded-lg p-3">
            <div class="text-slate-400 font-semibold uppercase tracking-wide mb-1">Metadata</div>
            <div class="space-y-1">
              <div><span class="text-slate-500">Status:</span> <span class="text-slate-800">${doc.status || '—'}</span></div>
              <div><span class="text-slate-500">Date:</span> <span class="text-slate-800">${doc.date || '—'}</span></div>
              <div><span class="text-slate-500">Uploader:</span> <span class="text-slate-800">${doc.uploader || '—'}</span></div>
              <div><span class="text-slate-500">Equipment:</span> <span class="text-slate-800">${displayEquipmentId(getEquipmentIdFromFolderId(doc.folder)) || '—'}</span></div>
            </div>
          </div>
        </div>
        <div class="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 mt-1 flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 8v4l2 2"/>
          </svg>
          In a production DMS, file preview (PDF renderer, image viewer, etc.) would appear here.
        </div>
        ${buildLinkedRecordsHTML(doc.folder)}`;

      if (doc.rawData) {
        document.getElementById('previewDownloadBtn').onclick = () => {
          const a = document.createElement('a');
          a.href = doc.rawData;
          a.download = doc.name;
          a.click();
        };
        document.getElementById('previewDownloadBtn').classList.remove('hidden');
      } else {
        document.getElementById('previewDownloadBtn').classList.add('hidden');
      }

      document.getElementById('previewModal').classList.remove('hidden');
    }

    function buildLinkedRecordsHTML(folderId) {
      if (!folderId) return '';
      const folderTarget = getDocumentTarget(folderId);
      const effectiveFolderId = folderTarget.folder;
      if (!effectiveFolderId) return '';
      const equipId = getEquipmentIdFromFolderId(effectiveFolderId);
      const folderType = getFolderTypeCode(effectiveFolderId);
      const folderPolicy = getFolderPolicyByFolderId(effectiveFolderId);

      const fallbackShowJDE = ['TD', 'MP', 'OP'].includes(folderType);
      const fallbackShowMaximo = ['RH', 'MOC', 'MP', 'OP'].includes(folderType);
      const showJDE    = folderPolicy ? !!folderPolicy.integrations?.jde : fallbackShowJDE;
      const showMaximo = folderPolicy ? !!folderPolicy.integrations?.maximo : fallbackShowMaximo;
      if (!showJDE && !showMaximo) return '';

      const jdeParts = Array.isArray(JDE_PARTS?.[equipId]) ? JDE_PARTS[equipId].slice(0, 4) : [];
      const maxWOs   = Array.isArray(MAXIMO_WOS?.[equipId]) ? MAXIMO_WOS[equipId].slice(0, 4) : [];

      let html = `<div class="border-t border-slate-100 pt-3 mt-1">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Linked Records</div>
        <div class="space-y-2">`;

      if (showMaximo && maxWOs.length) {
        html += `<div class="bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
          <div class="px-3 py-1.5 flex items-center gap-1.5 border-b border-slate-100 bg-slate-100">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span class="text-xs font-semibold text-slate-600">Maximo Work Orders — ${equipId}</span>
          </div>
          <table class="w-full text-xs">
            <tbody class="divide-y divide-slate-100">
              ${maxWOs.map(wo => {
                const s = WO_STATUS_STYLE[wo.status] || {};
                return `<tr class="hover:bg-white transition-colors">
                  <td class="px-3 py-1.5 font-mono text-blue-600 font-medium w-28">${wo.wo}</td>
                  <td class="px-3 py-1.5 text-slate-700 truncate max-w-[180px]">${wo.desc}</td>
                  <td class="px-3 py-1.5 w-20"><span class="badge-status bg-slate-100 text-slate-500">${wo.type}</span></td>
                  <td class="px-3 py-1.5 w-28"><span class="badge-status ${s.cls || 'bg-slate-100 text-slate-500'}">${s.label || wo.status}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
      }

      if (showJDE && jdeParts.length) {
        html += `<div class="bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
          <div class="px-3 py-1.5 flex items-center gap-1.5 border-b border-slate-100 bg-slate-100">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span class="text-xs font-semibold text-slate-600">JD Edwards Spare Parts — ${equipId} (Branch WHM-01)</span>
          </div>
          <table class="w-full text-xs">
            <tbody class="divide-y divide-slate-100">
              ${jdeParts.map(p => {
                const sc = JDE_STOCK_STYLE[p.status] || 'bg-slate-100 text-slate-500';
                return `<tr class="hover:bg-white transition-colors">
                  <td class="px-3 py-1.5 font-mono text-slate-700 font-medium w-24">${p.partNo}</td>
                  <td class="px-3 py-1.5 text-slate-700 truncate max-w-[200px]">${p.desc}</td>
                  <td class="px-3 py-1.5 text-center w-16 font-semibold text-slate-800">${p.qty} <span class="text-slate-400 font-normal">${p.uom}</span></td>
                  <td class="px-3 py-1.5 w-24"><span class="badge-status ${sc}">${p.status}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
      }

      html += `</div></div>`;
      return html;
    }

    function closePreviewModal() {
      document.getElementById('previewModal').classList.add('hidden');
    }

    // ─── Upload ────────────────────────────────────────────────────────────────
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        if (uploadBtn.disabled || !activeFolder || currentPrimaryActionMode === 'default') return;
        if (currentPrimaryActionMode === 'request-changes') {
          const request = prompt('Enter the requested change for this controlled folder:');
          if (!request || !request.trim()) return;
          alert('Change request submitted for review.');
          return;
        }
        if (currentPrimaryActionMode === 'create-new') {
          const menu = document.getElementById('createNewMenu');
          if (!menu) return;
          menu.classList.toggle('hidden');
          return;
        }
      });
    }

    const createNewFile = document.getElementById('createNewFile');
    if (createNewFile) {
      createNewFile.addEventListener('click', () => {
        closeCreateNewMenu();
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.click();
      });
    }

    const createNewFolder = document.getElementById('createNewFolder');
    if (createNewFolder) {
      createNewFolder.addEventListener('click', () => {
        closeCreateNewMenu();
        const folderInput = document.getElementById('folderInput');
        if (folderInput) folderInput.click();
      });
    }

    const createNewLink = document.getElementById('createNewLink');
    if (createNewLink) {
      createNewLink.addEventListener('click', () => {
        closeCreateNewMenu();
        const target = getDocumentTarget(activeFolder);
        if (!target.folder) {
          alert('Select a document folder first.');
          return;
        }

        const linkUrl = prompt('Enter URL:');
        if (!linkUrl || !linkUrl.trim()) return;

        try {
          new URL(linkUrl);
        } catch {
          alert('Enter a valid URL.');
          return;
        }

        const linkTitle = prompt('Enter link title:', 'Reference Link') || 'Reference Link';
        allDocs.push({
          id: 'u' + Date.now() + Math.random().toString(36).slice(2,6),
          folder: target.folder,
          incidentKey: target.incidentKey || undefined,
          name: `${linkTitle}.url`,
          rev: 'Rev 0',
          ext: 'url',
          size: 'URL',
          date: new Date().toISOString().slice(0,10),
          status: 'For Review',
          uploader: 'Current User',
          rawData: null,
        });
        persist();
        refreshTree();
        if (activeFolder) renderMainPane(findNode(activeFolder));
      });
    }

    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        pendingFiles = [...e.target.files];
        confirmUpload();
        e.target.value = '';
      });
    }

    const folderInput = document.getElementById('folderInput');
    if (folderInput) {
      folderInput.addEventListener('change', (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        pendingFiles = [...e.target.files];
        confirmUpload();
        e.target.value = '';
      });
    }

    const dropZone = document.getElementById('dropZone');
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drop-active'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-active'));
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drop-active');
        addPendingFiles([...e.dataTransfer.files]);
      });
    }

    function addPendingFiles(files) {
      pendingFiles = [...pendingFiles, ...files];
      renderPendingList();
    }

    function renderPendingList() {
      const ul = document.getElementById('uploadFileList');
      if (!ul) return;
      ul.innerHTML = pendingFiles.map((f, i) => `
        <div class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span class="text-slate-700 font-medium truncate max-w-[260px]">${f.name}</span>
          </div>
          <div class="flex items-center gap-2 text-slate-400 flex-shrink-0">
            <span>${(f.size/1024).toFixed(1)} KB</span>
            <button onclick="removePending(${i})" class="hover:text-red-500">✕</button>
          </div>
        </div>`).join('');
      const confirmBtn = document.getElementById('confirmUploadBtn');
      if (confirmBtn) confirmBtn.disabled = pendingFiles.length === 0;
    }

    function removePending(i) { pendingFiles.splice(i, 1); renderPendingList(); }

    function closeUploadModal() {
      const uploadModal = document.getElementById('uploadModal');
      if (uploadModal) uploadModal.classList.add('hidden');
      closeCreateNewMenu();
      pendingFiles = [];
      renderPendingList();
    }

    function confirmUpload() {
      const target = getDocumentTarget(activeFolder);
      const folder = target.folder;
      let processed = 0;
      if (!pendingFiles.length || !folder) return;

      pendingFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const ext = file.name.split('.').pop().toLowerCase();
          allDocs.push({
            id: 'u' + Date.now() + Math.random().toString(36).slice(2,6),
            folder,
            incidentKey: target.incidentKey || undefined,
            name: file.name,
            rev: 'Rev 0',
            ext,
            size: (file.size / 1024).toFixed(1) + ' KB',
            date: new Date().toISOString().slice(0,10),
            status: 'For Review',
            uploader: 'Current User',
            rawData: ev.target.result,
          });
          processed++;
          if (processed === pendingFiles.length) {
            persist();
            refreshTree();
            closeUploadModal();
            if (activeFolder === folder) renderMainPane(findNode(folder));
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // ─── Search ────────────────────────────────────────────────────────────────
    document.getElementById('docSearch').addEventListener('input', (e) => {
      if (!activeFolder) return;
      const docs = getDocsForFolderId(activeFolder);
      renderDocTable(docs, e.target.value, activeFolder);
    });

    function wildcardToRegExp(pattern) {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      const regexPattern = '^' + escaped.replace(/\*/g, '.*') + '$';
      return new RegExp(regexPattern, 'i');
    }

    document.getElementById('globalSearch').addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (!q) {
        if (activeNodeId) selectNode(activeNodeId);
        return;
      }
      // Show all matching docs across all folders
      if (activeNodeId !== null) saveViewState();
      const matcher = wildcardToRegExp(q.includes('*') ? q : `*${q}*`);
      const matches = allDocs.filter(d => matcher.test(d.name));
      document.getElementById('folderTitle').textContent = `Search results for "${e.target.value}"`;
      setFolderControlBadge(null);
      document.getElementById('folderMeta').textContent = `${matches.length} document(s) found across all folders`;
      document.getElementById('breadcrumb').innerHTML = '<span class="text-slate-500">Global search</span>';
      document.getElementById('statsBar').classList.add('hidden');
      document.getElementById('emptyPlaceholder').classList.add('hidden');
      document.getElementById('tableWrapper').classList.remove('hidden');
      renderDocTable(matches, '');
      activeFolder = null;
      activeNodeId = null;
    });

    // ─── Tree Filter ───────────────────────────────────────────────────────────
    document.getElementById('treeSearch').addEventListener('input', (e) => {
      applyTreeFilter(e.target.value || '');
    });

    const resetDisplayBtn = document.getElementById('resetDisplayBtn');
    if (resetDisplayBtn) {
      resetDisplayBtn.addEventListener('click', () => {
        resetDisplay();
      });
    }

    const logoResetBtn = document.getElementById('logoResetBtn');
    if (logoResetBtn) {
      logoResetBtn.addEventListener('click', () => {
        resetDisplay();
      });
    }

    const advancedFilterBtn = document.getElementById('advancedFilterBtn');
    if (advancedFilterBtn) {
      advancedFilterBtn.addEventListener('click', () => {
        openAdvancedFilterModal();
      });
    }

    const advancedFilterClose = document.getElementById('advancedFilterClose');
    if (advancedFilterClose) {
      advancedFilterClose.addEventListener('click', () => closeAdvancedFilterModal());
    }

    const advancedFilterModal = document.getElementById('advancedFilterModal');
    if (advancedFilterModal) {
      advancedFilterModal.addEventListener('click', (e) => {
        if (e.target === advancedFilterModal) closeAdvancedFilterModal();
      });
    }

    getAdvancedDropdownFields().forEach(field => {
      const selectEl = document.getElementById(field.id);
      if (selectEl) {
        selectEl.addEventListener('change', () => {
          // Enforce sequential selection: if Site changes, clear dependent fields
          if (field.id === 'afSite') {
            const unitEl = document.getElementById('afUnit');
            const equipmentEl = document.getElementById('afEquipment');
            const equipmentTypeEl = document.getElementById('afEquipmentType');
            if (unitEl) unitEl.value = '';
            if (equipmentEl) equipmentEl.value = '';
            if (equipmentTypeEl) equipmentTypeEl.value = '';
          }
          // If Unit changes, clear dependent fields
          if (field.id === 'afUnit') {
            const equipmentEl = document.getElementById('afEquipment');
            const equipmentTypeEl = document.getElementById('afEquipmentType');
            if (equipmentEl) equipmentEl.value = '';
            if (equipmentTypeEl) equipmentTypeEl.value = '';
          }
          refreshAdvancedFilterDropdowns();
        });
      }
    });

    const afLabelWildcard = document.getElementById('afLabelWildcard');
    if (afLabelWildcard) {
      afLabelWildcard.addEventListener('input', () => {
        refreshAdvancedFilterDropdowns();
      });
    }

    const advancedFilterApply = document.getElementById('advancedFilterApply');
    if (advancedFilterApply) {
      advancedFilterApply.addEventListener('click', () => {
        const criteria = readAdvancedFilterCriteria();
        const treeSearch = document.getElementById('treeSearch');
        if (treeSearch) treeSearch.value = '';
        applyAdvancedTreeFilter(criteria);
        if (criteria.displayAllDocs) {
          if (activeNodeId !== null) saveViewState();
          const matchingFolderIds = getMatchingAdvancedFolderIds(criteria);
          renderAdvancedDocsView(matchingFolderIds);
          activeFolder = null;
          activeNodeId = null;
        }
        closeAdvancedFilterModal();
      });
    }

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        goBack();
      });
    }

    const forwardBtn = document.getElementById('forwardBtn');
    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => {
        goForward();
      });
    }

    const advancedFilterClear = document.getElementById('advancedFilterClear');
    if (advancedFilterClear) {
      advancedFilterClear.addEventListener('click', () => {
        clearAdvancedFilterInputs();
        const treeSearch = document.getElementById('treeSearch');
        if (treeSearch) treeSearch.value = '';
        applyTreeFilter('');
      });
    }

    // ─── Sidebar Resize ────────────────────────────────────────────────────────
    const resizer   = document.getElementById('resizer');
    const sidebar   = document.getElementById('sidebar');
    let isResizing  = false;
    let startX, startW;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newW = Math.max(180, Math.min(480, startW + (e.clientX - startX)));
      sidebar.style.width = newW + 'px';
    });
    document.addEventListener('mouseup', () => {
      isResizing = false;
      resizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });

    // ─── Persistence ───────────────────────────────────────────────────────────
    function persist() {
      try { localStorage.setItem('dms_poc_docs', JSON.stringify(allDocs)); }
      catch { console.warn('localStorage quota exceeded'); }
    }

    function refreshTree() {
      // Re-render tree to update doc counts
      renderTree();
      // Re-apply active state
      if (activeFolder) {
        const lbl = document.getElementById('tl-' + activeFolder);
        if (lbl) lbl.classList.add('active');
      }
    }

    // ─── Keyboard shortcuts ────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePreviewModal();
        closeUploadModal();
        closeAdvancedFilterModal();
      }
    });

    document.addEventListener('click', (e) => {
      const wrapper = document.getElementById('createNewWrapper');
      if (!wrapper) return;
      if (!wrapper.contains(e.target)) {
        closeCreateNewMenu();
      }
    });

    // ─── Init ─────────────────────────────────────────────────────────────────
    renderTree();
    setFolderControlBadge(null);
    refreshAdvancedFilterDropdowns();
    renderHomeLanding();
    initAiChat();
    
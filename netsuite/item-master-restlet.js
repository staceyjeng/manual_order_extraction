/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 *
 * Runs a saved search and returns all results as JSON.
 * Accepts optional ?searchId= param; defaults to customsearchitem_master.
 * Deploy as a RESTlet, then add the external URL to .env as NS_RESTLET_ITEMMASTER.
 */
define(['N/search'], (search) => {

  const get = (params) => {
    try {
      const searchId = (params && params.searchId) ? params.searchId : 'customsearchitem_master';
      const s = search.load({ id: searchId });
      const items = [];

      const allCols = s.columns;
      const safeCols = allCols.filter(col => !String(col.name || '').toLowerCase().includes('cseg'));
      const skippedCols = allCols.filter(col => String(col.name || '').toLowerCase().includes('cseg'));
      s.columns = safeCols;

      // Auto-strip filters that are invalid in the scripting context.
      // Handles both Filter objects ({name}) and array-format filters (['fieldname', op, val]).
      // Falls back to no filters if still failing after 20 attempts.
      const getFilterName = f => Array.isArray(f) ? String(f[0] || '').toLowerCase() : String(f.name || '').toLowerCase();
      let filters = (s.filters || []).filter(f => f !== 'and' && f !== 'or' && !Array.isArray(f) ? true : !Array.isArray(f) || f.length > 0);
      let pagedData;
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          s.filters = filters;
          pagedData = s.runPaged({ pageSize: 1000 });
          break;
        } catch (fe) {
          const match = fe.message.match(/syntax:\s*(\S+)/i);
          if (match) {
            const badField = match[1].toLowerCase();
            filters = filters.filter(f => getFilterName(f) !== badField && f !== 'and' && f !== 'or');
          } else if (attempt < 19) {
            filters = [];
          } else {
            throw fe;
          }
        }
      }
      if (!pagedData) {
        s.filters = [];
        pagedData = s.runPaged({ pageSize: 1000 });
      }

      pagedData.pageRanges.forEach(pageRange => {
        pagedData.fetch({ index: pageRange.index }).data.forEach(result => {
          const row = { 'Internal ID': result.id || '' };
          safeCols.forEach(col => {
            const key = col.label || col.name;
            try {
              const name = String(col.name || '').toLowerCase();
              if (name.includes('cseg')) {
                row[key] = result.getValue(col) || '';
              } else {
                row[key] = result.getText(col) || result.getValue(col) || '';
              }
            } catch(_) {
              row[key] = '';
            }
          });
          skippedCols.forEach(col => {
            row[col.label || col.name] = '';
          });
          items.push(row);
        });
      });

      return { count: items.length, items };
    } catch (e) {
      return { error: e.message, items: [] };
    }
  };

  return { get };
});

/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 *
 * Runs the customsearchclaude_items saved search and returns all results as JSON.
 * Deploy as a RESTlet, then add the external URL to .env as NS_RESTLET_ITEMMASTER.
 */
define(['N/search'], (search) => {

  const get = () => {
    try {
      const s = search.load({ id: 'customsearchclaude_items' });
      const items = [];

      const pagedData = s.runPaged({ pageSize: 1000 });
      pagedData.pageRanges.forEach(pageRange => {
        pagedData.fetch({ index: pageRange.index }).data.forEach(result => {
          const row = {};
          s.columns.forEach(col => {
            row[col.label || col.name] = result.getText(col) || result.getValue(col) || '';
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

const parsePagination = (params) => {
  const page = parseInt(params.page ?? 0, 10);
  const limit = parseInt(params.limit ?? 20, 10);

  if (isNaN(page) || page < 0) {
    throw new Error("Invalid param: page must be >= 0");
  }
  if (isNaN(limit) || limit <= 0) {
    throw new Error("Invalid param: limit must be > 0");
  }

  return {
    page,
    limit,
    skip: page * limit,
  };
};

const buildMetadata = ({ page, limit, totalCount }) => {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    page,
    limit,
    page_count: totalPages,
    total_count: totalCount
  };
}

const sortFinalOrderRecords = (records, skip, limit, inputText) => {
    console.log("Records before pagination: ", records.length);

    console.log(inputText)
    records = (typeof inputText === 'string' && inputText.trim() !== '') ? records.filter(r => containsValue(r, inputText)) : records;

    return { totalCount: records.length, records: records.slice(skip, skip + limit) };
};


const containsValue = (node, needle) => {
  const norm = s => s?.normalize?.('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? '';
  const n = norm(String(needle));
  const visit = v =>
    v == null ? false
    : (typeof v !== 'object' || v instanceof Date) ? norm(String(v)).includes(n)
    : Array.isArray(v) ? v.some(visit)
    : Object.values(v).some(visit);
  return visit(node);
}

module.exports = { parsePagination, buildMetadata, sortFinalOrderRecords };
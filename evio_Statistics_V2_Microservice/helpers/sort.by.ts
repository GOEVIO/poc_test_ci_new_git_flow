

const parsePagination = (params: any) => {
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

const buildMetadata = ({ page, limit, totalCount }: { page: number; limit: number; totalCount: number }) => {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    page,
    limit,
    page_count: totalPages,
    total_count: totalCount
  };
}

/**
 * Retrieves a nested value from an object by a given path.
 * The path is a string of property names separated by dots.
 * If any part of the path is undefined, the function returns undefined.
 * @param {any} obj - the object to retrieve the value from
 * @param {string} path - the path to the value to retrieve
 * @returns {any} the value at the given path, or undefined if not found
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}


/**
 * Parse a duration string in the format "Xm Ys" into seconds.
 * Returns 0 if the string is not in the correct format.
 * @param {string} str - the duration string to parse
 * @returns {number} the duration in seconds
 */
function parseDuration(str: string): number {
  if (!str) return 0;
  const match = str.match(/(?:(\d+)h)?\s*(?:(\d+)m)?\s*(\d+)s/);
  if (!match) return 0;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Returns true if the given string matches the format "Xm Ys" where X and Y are numbers.
 * @param {string} str - the string to match
 * @returns {boolean} true if the string matches the format, false otherwise
 */
function matchTimeString (str: string): boolean {
  return str.match(/(?:(\d+)h)?\s*(?:(\d+)m)?\s*(\d+)s/) !== null;
}

const sortFieldMap: Record<string, string> = {
  startDate: 'startDate',
  group: 'fleet.name',
  licensePlate: 'ev.licensePlate',
  network: 'charger.network',
  duration: 'timeChargedInMin',
  energy: 'totalPower',
  charger: 'charger.name',
  cost: 'totalPrice.excl_vat',
  costWithIva: 'totalPrice.incl_vat',
  method: 'authType',
  overcost: 'overcost',
  overtime: 'efficiency',
  status: 'sessionBillingInfo.sameUser.status',
  user: 'user.name'
};


/**
 * Sorts an array of records based on a given field and order.
 * Supports sorting by nested fields and dynamic sorting.
 * @param {any[]} records - the array of records to sort
 * @param {object} params - the parameters for sorting:
 *  - sortBy: the field to sort by
 *  - sortOrder: the order of the sort (asc or desc)
 *  - startDate: the start date for filtering records (optional)
 *  - endDate: the end date for filtering records (optional)
 * @returns {any[]} the sorted array of records
 */
export const sortby =  (
  records: any[],
  params: any
) => {
  try {
    const { sortBy, sortOrder, startDate, inputText } = params;
    const { page, limit, skip } = parsePagination(params);

    const order = sortOrder === 'asc' ? 1 : -1;

    if (!sortBy) {
      console.error('[sortby] Error - Missing sortBy parameter');
      return records;
    }

    let filteredRecords = records;

    // Filtro por startDate se fornecido
    if (startDate) {
      filteredRecords = filteredRecords.filter(
        (r: any) => new Date(r.createdAt) >= new Date(startDate)
      );
    }

    // Resolve o campo real a ser usado para sort
    const sortField = sortFieldMap[sortBy] || sortBy;

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

    const isNumericLike = (v: any) =>
      typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)));

    const looksLikeDateField = (field: string) =>
      /date|time|_at$/i.test(field) || field === "startDate";

    const compareValues = (aVal: any, bVal: any, field: string, order: 1 | -1) => {
      const A = aVal ?? null;
      const B = bVal ?? null;

      // Missing values vão para o fim
      if (A == null && B == null) return 0;
      if (A == null) return 1 * order;
      if (B == null) return -1 * order;

      // Durations tipo "1h 20m"
      if (typeof A === "string" && typeof B === "string" && matchTimeString(A) && matchTimeString(B)) {
        return (parseDuration(A) - parseDuration(B)) * order;
      }

      // Datas (por campo ou valor)
      if (
        looksLikeDateField(field) ||
        (!isNumericLike(A) && !isNumericLike(B) && (new Date(A)).toString() !== "Invalid Date" && (new Date(B)).toString() !== "Invalid Date")
      ) {
        const ta = new Date(A).getTime();
        const tb = new Date(B).getTime();
        if (isNaN(ta) && isNaN(tb)) return 0;
        if (isNaN(ta)) return 1 * order;
        if (isNaN(tb)) return -1 * order;
        return (ta - tb) * order;
      }

      // Números
      if (isNumericLike(A) && isNumericLike(B)) {
        return (Number(A) - Number(B)) * order;
      }

      // Strings (natural sort, case-insensitive)
      return collator.compare(String(A), String(B)) * order;
    };

    let sortedRecords = filteredRecords.sort((a: any, b: any) => {
      const aValue = getNestedValue(a, sortField); // sem "?? 0"
      const bValue = getNestedValue(b, sortField);
      return compareValues(aValue, bValue, sortField, order as 1 | -1);
    });

    sortedRecords = (typeof inputText === 'string' && inputText.trim() !== '') ? sortedRecords.filter(r => containsValue(r, inputText)) : sortedRecords;

    let metadata = buildMetadata({ page, limit, totalCount: sortedRecords.length });

    return {
      metadata,
      records: sortedRecords.slice(skip, (skip + limit) || sortedRecords.length)
    };
  } catch (error: any) {
    console.error('[sortby] Error', error?.message ?? error);
    return records;
  }
};


function containsValue(node: any, needle: string) {
  const norm = (s: any) => s?.normalize?.('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? '';
  const n = norm(String(needle));
  const visit = (v: any) =>
    v == null ? false
    : (typeof v !== 'object' || v instanceof Date) ? norm(String(v)).includes(n)
    : Array.isArray(v) ? v.some(visit)
    : Object.values(v).some(visit);
  return visit(node);
}
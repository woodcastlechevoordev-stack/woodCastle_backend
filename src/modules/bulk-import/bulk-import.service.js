const XLSX = require('xlsx');
const prisma = require('../../config/db');
const { toSlug } = require('../../utils/helpers');
const { createError } = require('../../middleware/errorHandler');

const PREVIEW_TTL_MS = 60 * 60 * 1000; // 1 hour

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (!key) return;
    const cell = row[index];
    obj[key] =
      cell === undefined || cell === null || cell === ''
        ? ''
        : typeof cell === 'string'
          ? cell.trim()
          : cell;
  });
  return obj;
}

function sheetToRowsByIndex(workbook, sheetIndex) {
  const names = workbook.SheetNames || [];
  const found = names[sheetIndex];
  if (!found) return { sheetName: null, rows: [] };

  const sheet = workbook.Sheets[found];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (!matrix.length) return { sheetName: found, rows: [] };

  const headers = matrix[0];
  const rows = matrix
    .slice(1)
    .map((row, i) => ({
      rowNumber: i + 2, // Excel row (1-indexed, header is row 1)
      data: rowToObject(headers, row),
    }))
    .filter(({ data }) => Object.values(data).some((v) => v !== '' && v !== null));

  return { sheetName: found, rows };
}

function getField(data, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (data[key] !== undefined && data[key] !== '') return data[key];
  }
  return '';
}

function parseBoolean(value, defaultValue = true) {
  if (value === '' || value === null || value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'active'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'inactive'].includes(normalized)) return false;
  return null;
}

function parsePrice(value) {
  if (value === '' || value === null || value === undefined) return { ok: true, value: null };
  const num = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (Number.isNaN(num)) return { ok: false, value: null };
  return { ok: true, value: num };
}

function parseImages(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  // Spec: multiple URLs separated by pipe (|); first is primary, rest are gallery
  return String(value)
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildPreviewPayload(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const errors = [];

  // Sheet order matters: 1st = Categories, 2nd = Products; further sheets ignored
  const categorySheet = sheetToRowsByIndex(workbook, 0);
  const productSheet = sheetToRowsByIndex(workbook, 1);

  if (!categorySheet.sheetName && !productSheet.sheetName) {
    throw createError(
      400,
      'Workbook must include Categories (sheet 1) and/or Products (sheet 2)'
    );
  }

  const categories = [];
  const categoryNameSet = new Set();
  const categorySlugSet = new Set();

  for (const { rowNumber, data } of categorySheet.rows) {
    const name = String(getField(data, ['category name', 'name']) || '').trim();
    const parentCategoryName = String(
      getField(data, [
        'parent category name',
        'parent category',
        'parent',
      ]) || ''
    ).trim();
    const slugRaw = String(getField(data, ['slug', 'category slug']) || '').trim();
    const imageUrl =
      String(getField(data, ['image url', 'image', 'banner image']) || '').trim() ||
      null;
    const metaTitle =
      String(getField(data, ['meta title', 'metatitle']) || '').trim() || null;
    const metaDescription =
      String(getField(data, ['meta description', 'metadescription']) || '').trim() ||
      null;

    if (!name) {
      errors.push({
        row: rowNumber,
        sheet: 'Categories',
        field: 'Category Name',
        message: 'Category Name is required',
      });
      continue;
    }

    const slug = slugRaw || toSlug(name);
    const nameKey = name.toLowerCase();

    if (categoryNameSet.has(nameKey)) {
      errors.push({
        row: rowNumber,
        sheet: 'Categories',
        field: 'Category Name',
        message: `Duplicate category name in sheet: ${name}`,
      });
      continue;
    }
    if (categorySlugSet.has(slug)) {
      errors.push({
        row: rowNumber,
        sheet: 'Categories',
        field: 'Slug',
        message: `Duplicate category slug in sheet: ${slug}`,
      });
      continue;
    }

    categoryNameSet.add(nameKey);
    categorySlugSet.add(slug);

    categories.push({
      rowNumber,
      name,
      slug,
      parentCategoryName: parentCategoryName || null,
      imageUrl,
      metaTitle,
      metaDescription,
    });
  }

  const products = [];
  const productSlugSet = new Set();

  for (const { rowNumber, data } of productSheet.rows) {
    const name = String(getField(data, ['product name', 'name']) || '').trim();
    const categoryName = String(
      getField(data, ['category name', 'category', 'subcategory', 'subcategory name']) ||
        ''
    ).trim();
    const description = String(getField(data, ['description']) || '').trim();
    const slugRaw = String(getField(data, ['slug', 'product slug']) || '').trim();
    const images = parseImages(getField(data, ['image url', 'image urls', 'images']));
    const priceRaw = getField(data, ['price']);
    const isActiveRaw = getField(data, ['is active', 'active', 'status']);
    const metaTitle =
      String(getField(data, ['meta title', 'metatitle']) || '').trim() || null;
    const metaDescription =
      String(getField(data, ['meta description', 'metadescription']) || '').trim() ||
      null;

    let rowHasError = false;

    if (!name) {
      errors.push({
        row: rowNumber,
        sheet: 'Products',
        field: 'Product Name',
        message: 'Product Name is required',
      });
      rowHasError = true;
    }
    if (!categoryName) {
      errors.push({
        row: rowNumber,
        sheet: 'Products',
        field: 'Category Name',
        message: 'Category Name is required',
      });
      rowHasError = true;
    }
    if (!description) {
      errors.push({
        row: rowNumber,
        sheet: 'Products',
        field: 'Description',
        message: 'Description is required',
      });
      rowHasError = true;
    }
    if (!images.length) {
      errors.push({
        row: rowNumber,
        sheet: 'Products',
        field: 'Image URL',
        message: 'Primary Image URL is required',
      });
      rowHasError = true;
    }

    const priceResult = parsePrice(priceRaw);
    if (!priceResult.ok) {
      errors.push({
        row: rowNumber,
        sheet: 'Products',
        field: 'Price',
        message: 'Price must be numeric',
      });
      rowHasError = true;
    }

    const isActive = parseBoolean(isActiveRaw, true);
    if (isActive === null) {
      errors.push({
        row: rowNumber,
        sheet: 'Products',
        field: 'Is Active',
        message: 'Is Active must be true/false (or blank for true)',
      });
      rowHasError = true;
    }

    if (rowHasError) continue;

    const slug = slugRaw || toSlug(name);
    if (productSlugSet.has(slug)) {
      errors.push({
        row: rowNumber,
        sheet: 'Products',
        field: 'Slug',
        message: `Duplicate product slug in sheet: ${slug}`,
      });
      continue;
    }
    productSlugSet.add(slug);

    products.push({
      rowNumber,
      name,
      slug,
      description,
      categoryName,
      images,
      price: priceResult.value,
      isActive,
      metaTitle,
      metaDescription,
    });
  }

  return { categories, products, errors };
}

async function annotateAgainstDatabase(parsed) {
  const existingCategories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
    },
  });
  const existingProducts = await prisma.product.findMany({
    select: { id: true, slug: true },
  });

  const categoryBySlug = new Map(existingCategories.map((c) => [c.slug, c]));
  const categoryByName = new Map(
    existingCategories.map((c) => [c.name.toLowerCase(), c])
  );
  const productBySlug = new Map(existingProducts.map((p) => [p.slug, p]));

  // Sheet categories keyed by name (case-insensitive)
  const sheetCategoryByName = new Map(
    parsed.categories.map((c) => [c.name.toLowerCase(), c])
  );

  // Top-level names from sheet (no Parent Category) + DB (parentId null)
  const topLevelNames = new Set([
    ...existingCategories
      .filter((c) => !c.parentId)
      .map((c) => c.name.toLowerCase()),
    ...parsed.categories
      .filter((c) => !c.parentCategoryName)
      .map((c) => c.name.toLowerCase()),
  ]);

  // Subcategory names: sheet rows with Parent Category, or DB with parentId
  const subcategoryNames = new Set([
    ...existingCategories
      .filter((c) => c.parentId)
      .map((c) => c.name.toLowerCase()),
    ...parsed.categories
      .filter((c) => c.parentCategoryName)
      .map((c) => c.name.toLowerCase()),
  ]);

  const errors = [...parsed.errors];

  const categories = [];
  for (const cat of parsed.categories) {
    if (cat.parentCategoryName) {
      const parentKey = cat.parentCategoryName.toLowerCase();
      const parentInSheet = sheetCategoryByName.get(parentKey);
      const parentInDb = categoryByName.get(parentKey);

      if (!parentInSheet && !parentInDb) {
        errors.push({
          row: cat.rowNumber,
          sheet: 'Categories',
          field: 'Parent Category Name',
          message: `Parent Category Name "${cat.parentCategoryName}" not found in database or Categories sheet`,
        });
        continue;
      }

      // Parent must be top-level (not itself a subcategory)
      if (parentInSheet?.parentCategoryName) {
        errors.push({
          row: cat.rowNumber,
          sheet: 'Categories',
          field: 'Parent Category Name',
          message: `Parent Category Name "${cat.parentCategoryName}" must be a top-level category`,
        });
        continue;
      }
      if (parentInDb?.parentId) {
        errors.push({
          row: cat.rowNumber,
          sheet: 'Categories',
          field: 'Parent Category Name',
          message: `Parent Category Name "${cat.parentCategoryName}" must be a top-level category`,
        });
        continue;
      }

      if (!topLevelNames.has(parentKey)) {
        errors.push({
          row: cat.rowNumber,
          sheet: 'Categories',
          field: 'Parent Category Name',
          message: `Parent Category Name "${cat.parentCategoryName}" must be a top-level category`,
        });
        continue;
      }
    }

    const existing = categoryBySlug.get(cat.slug);
    categories.push({
      ...cat,
      action: existing ? 'update' : 'create',
      existingId: existing?.id || null,
    });
  }

  const validProducts = [];
  for (const product of parsed.products) {
    const nameKey = product.categoryName.toLowerCase();

    if (!subcategoryNames.has(nameKey)) {
      if (topLevelNames.has(nameKey) || categoryByName.has(nameKey) || sheetCategoryByName.has(nameKey)) {
        errors.push({
          row: product.rowNumber,
          sheet: 'Products',
          field: 'Category Name',
          message: `Category "${product.categoryName}" is a top-level category — products must be assigned to a subcategory`,
        });
      } else {
        errors.push({
          row: product.rowNumber,
          sheet: 'Products',
          field: 'Category Name',
          message: `Subcategory "${product.categoryName}" not found in database or Categories sheet`,
        });
      }
      continue;
    }

    const existing = productBySlug.get(product.slug);
    validProducts.push({
      ...product,
      action: existing ? 'update' : 'create',
      existingId: existing?.id || null,
    });
  }

  return {
    categories,
    products: validProducts,
    errors,
    summary: {
      categoriesToCreate: categories.filter((c) => c.action === 'create').length,
      categoriesToUpdate: categories.filter((c) => c.action === 'update').length,
      productsToCreate: validProducts.filter((p) => p.action === 'create').length,
      productsToUpdate: validProducts.filter((p) => p.action === 'update').length,
      errorCount: errors.length,
    },
  };
}

async function preview(file, adminId) {
  if (!file?.buffer) {
    throw createError(400, 'xlsx file is required (field name: file)');
  }

  const fileName = file.originalname || 'upload.xlsx';
  if (!/\.xlsx$/i.test(fileName)) {
    throw createError(400, 'Only .xlsx files are supported');
  }

  const parsed = buildPreviewPayload(file.buffer);
  const annotated = await annotateAgainstDatabase(parsed);

  const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS);

  const pending = await prisma.pendingBulkImport.create({
    data: {
      fileName,
      importedBy: adminId,
      payload: {
        categories: annotated.categories,
        products: annotated.products,
      },
      errors: annotated.errors,
      expiresAt,
    },
  });

  return {
    importId: pending.id,
    fileName,
    expiresAt,
    summary: annotated.summary,
    categories: annotated.categories,
    products: annotated.products,
    errors: annotated.errors,
  };
}

async function confirm(importId, adminId) {
  if (!importId) throw createError(400, 'importId is required');

  const pending = await prisma.pendingBulkImport.findUnique({
    where: { id: importId },
  });

  if (!pending) throw createError(404, 'Import preview not found');
  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.pendingBulkImport.delete({ where: { id: importId } }).catch(() => {});
    throw createError(410, 'Import preview expired — please re-upload');
  }

  const payload = pending.payload || {};
  const categories = payload.categories || [];
  const products = payload.products || [];
  const previewErrors = Array.isArray(pending.errors) ? pending.errors : [];

  if (previewErrors.length > 0) {
    throw createError(
      400,
      `Cannot confirm import with ${previewErrors.length} validation error(s). Fix the sheet and re-upload.`
    );
  }

  const commitErrors = [];
  let successCount = 0;

  // Process top-level categories first, then subcategories, so parents exist
  const topLevelCats = categories.filter((c) => !c.parentCategoryName);
  const subCats = categories.filter((c) => c.parentCategoryName);
  const orderedCategories = [...topLevelCats, ...subCats];

  await prisma.$transaction(
    async (tx) => {
    const categoryIdByName = new Map();

    const existingCats = await tx.category.findMany({
      select: { id: true, name: true, slug: true, parentId: true },
    });
    for (const cat of existingCats) {
      categoryIdByName.set(cat.name.toLowerCase(), cat.id);
    }

    for (const cat of orderedCategories) {
      try {
        let parentId = null;
        if (cat.parentCategoryName) {
          parentId = categoryIdByName.get(cat.parentCategoryName.toLowerCase()) || null;
          if (!parentId) {
            commitErrors.push({
              row: cat.rowNumber,
              sheet: 'Categories',
              field: 'Parent Category Name',
              message: `Parent Category Name "${cat.parentCategoryName}" not found at commit time`,
            });
            continue;
          }
        }

        const data = {
          name: cat.name,
          slug: cat.slug,
          imageUrl: cat.imageUrl,
          metaTitle: cat.metaTitle,
          metaDescription: cat.metaDescription,
          parentId,
        };

        if (cat.action === 'update' && cat.existingId) {
          const updated = await tx.category.update({
            where: { id: cat.existingId },
            data,
          });
          categoryIdByName.set(updated.name.toLowerCase(), updated.id);
        } else {
          const created = await tx.category.create({ data });
          categoryIdByName.set(created.name.toLowerCase(), created.id);
        }
        successCount += 1;
      } catch (err) {
        commitErrors.push({
          row: cat.rowNumber,
          sheet: 'Categories',
          field: 'slug',
          message: err.message || 'Failed to save category',
        });
      }
    }

    // Refresh map in case sheet order / existing DB changed
    const allCats = await tx.category.findMany({
      select: { id: true, name: true, parentId: true },
    });
    for (const cat of allCats) {
      categoryIdByName.set(cat.name.toLowerCase(), cat.id);
    }

    for (const product of products) {
      try {
        const categoryId = categoryIdByName.get(product.categoryName.toLowerCase());
        if (!categoryId) {
          commitErrors.push({
            row: product.rowNumber,
            sheet: 'Products',
            field: 'Category Name',
            message: `Category "${product.categoryName}" not found at commit time`,
          });
          continue;
        }

        const data = {
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          images: product.images,
          categoryId,
          isActive: product.isActive,
          metaTitle: product.metaTitle,
          metaDescription: product.metaDescription,
        };

        if (product.action === 'update' && product.existingId) {
          await tx.product.update({
            where: { id: product.existingId },
            data,
          });
        } else {
          await tx.product.create({ data });
        }
        successCount += 1;
      } catch (err) {
        commitErrors.push({
          row: product.rowNumber,
          sheet: 'Products',
          field: 'slug',
          message: err.message || 'Failed to save product',
        });
      }
    }
  },
    {
      maxWait: 15_000,
      timeout: 120_000, // bulk sheets can exceed Prisma's default 5s
    }
  );

  const totalRows = categories.length + products.length;
  const errorCount = commitErrors.length;

  const log = await prisma.bulkImportLog.create({
    data: {
      fileName: pending.fileName,
      importedBy: adminId || pending.importedBy,
      totalRows,
      successCount,
      errorCount,
      errorDetails: commitErrors.length ? commitErrors : null,
    },
  });

  await prisma.pendingBulkImport.delete({ where: { id: importId } }).catch(() => {});

  // Clean expired previews opportunistically
  await prisma.pendingBulkImport
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});

  return {
    importLogId: log.id,
    fileName: log.fileName,
    totalRows,
    successCount,
    errorCount,
    errors: commitErrors,
  };
}

async function history() {
  return prisma.bulkImportLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

module.exports = { preview, confirm, history };

import { databases, storage, DATABASE_ID, COLLECTION_ID, BUCKET_ID, Query } from './appwrite';

// Get medicines with pagination, filters, and sorting
export const getMedicines = async ({
  searchTerm = '',
  limit = 10,
  offset = 0,
  filters = {},
  sortField = 'name',
  sortOrder = 'ASC'
}) => {
  const queries = [
    Query.limit(limit),
    Query.offset(offset),
    Query.order(sortField, sortOrder === 'ASC' ? 'asc' : 'desc')
  ];

  // Add search query if searchTerm exists
  if (searchTerm) {
    queries.push(Query.search('name', searchTerm));
  }

  // Add filters
  if (filters.category) {
    queries.push(Query.equal('category', filters.category));
  }
  if (filters.minPrice) {
    queries.push(Query.greaterThanEqual('price', filters.minPrice));
  }
  if (filters.maxPrice) {
    queries.push(Query.lessThanEqual('price', filters.maxPrice));
  }

  return await databases.listDocuments(
    DATABASE_ID,
    COLLECTION_ID,
    queries
  );
};

// Get file preview URL
export const getFilePreview = (fileId) => {
  return storage.getFilePreview(BUCKET_ID, fileId);
};

// Upload medicine image
export const uploadImage = async (file) => {
  return await storage.createFile(
    BUCKET_ID,
    'unique()',
    file
  );
};

// Get all categories for filter
export const getCategories = async () => {
  const response = await databases.listDocuments(
    DATABASE_ID,
    COLLECTION_ID,
    [Query.select(['category']), Query.limit(100)]
  );
  
  // Extract unique categories
  const categories = [...new Set(response.documents.map(doc => doc.category))];
  return categories.filter(Boolean); // Remove any undefined/null values
};
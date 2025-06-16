//(services\medicines.js)
import { databases, storage, DATABASE_ID, COLLECTION_ID, BUCKET_ID, Query } from './appwrite';

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
    sortOrder === 'ASC' ? Query.orderAsc(sortField) : Query.orderDesc(sortField)
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

  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      queries
    );
    return response;
  } catch (error) {
    console.error('Error fetching medicines:', error);
    throw error;
  }
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
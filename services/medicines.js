import { databases, databaseId } from '@/lib/appwrite';
import { Query } from 'appwrite';

// Replace with your actual collection ID
const MEDICINES_COLLECTION_ID = 'medicines';

export const getMedicines = async ({
  searchTerm = '',
  limit = 10,
  offset = 0,
  filters = {},
  sortField = 'name',
  sortOrder = 'ASC'
}) => {
  try {
    // Build queries array
    const queries = [];
    
    // Add user ID filter (MOST IMPORTANT - filters by current user)
    if (filters.userID) {
      queries.push(Query.equal('userID', filters.userID));
    }
    
    // Add search term filter
    if (searchTerm) {
      // Search in name or description - adjust field names as needed
      queries.push(Query.or([
        Query.search('name', searchTerm),
        Query.search('description', searchTerm)
      ]));
    }
    
    // Add category filter
    if (filters.category) {
      queries.push(Query.equal('category', filters.category));
    }
    
    // Add price range filters
    if (filters.minPrice !== undefined && filters.minPrice > 0) {
      queries.push(Query.greaterThanEqual('price', filters.minPrice));
    }
    
    if (filters.maxPrice !== undefined && filters.maxPrice < 1000) {
      queries.push(Query.lessThanEqual('price', filters.maxPrice));
    }
    
    // Add pagination
    queries.push(Query.limit(limit));
    queries.push(Query.offset(offset));
    
    // Add sorting
    if (sortOrder === 'ASC') {
      queries.push(Query.orderAsc(sortField));
    } else {
      queries.push(Query.orderDesc(sortField));
    }
    
    // Execute the query
    const response = await databases.listDocuments(
      databaseId,
      MEDICINES_COLLECTION_ID,
      queries
    );
    
    return response;
    
  } catch (error) {
    console.error('Error fetching medicines:', error);
    throw error;
  }
};

export const getCategories = async () => {
  try {
    // Get unique categories from medicines collection
    const response = await databases.listDocuments(
      databaseId,
      MEDICINES_COLLECTION_ID,
      [Query.select(['category'])]
    );
    
    // Extract unique categories
    const categories = [...new Set(
      response.documents.map(doc => doc.category).filter(Boolean)
    )];
    
    return categories;
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

export const getFilePreview = (fileId) => {
  // This function is imported but not used in your component
  // You can implement it if needed for file previews
  if (!fileId) return null;
  return `https://fra.cloud.appwrite.io/v1/storage/buckets/medicines-images/files/${fileId}/view?project=68424153002403801f6b&mode=admin`;
};
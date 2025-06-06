import { databases, DATABASE_ID, COLLECTION_ID, Query } from './appwrite';

export const createMedicine = async (medicineData) => {
  return await databases.createDocument(
    DATABASE_ID,
    COLLECTION_ID,
    'unique()', // Auto-generate ID
    medicineData
  );
};

export const searchMedicines = async (searchTerm) => {
  return await databases.listDocuments(
    DATABASE_ID,
    COLLECTION_ID,
    [
      Query.search('name', searchTerm),
      Query.limit(20)
    ]
  );
};

export const getAllMedicines = async () => {
  return await databases.listDocuments(
    DATABASE_ID,
    COLLECTION_ID,
    [Query.limit(20)]
  );
};
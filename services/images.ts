import { storage, BUCKET_ID } from '@/services/appwrite';

export const getMedicineImage = (fileId: string | undefined) => {
  if (!fileId) return null;
  
  try {
    return {
      uri: storage.getFileView(
        BUCKET_ID,
        fileId
      ),
      headers: {
        'X-Appwrite-Project': '68424153002403801f6b' // Votre PROJECT_ID
      }
    };
  } catch (error) {
    console.error('Error getting medicine image:', error);
    return null;
  }
};
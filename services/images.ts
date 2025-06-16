import { storage, BUCKET_ID } from '@/services/appwrite';

export const getMedicineImage = (fileId: string | undefined) => {
  if (!fileId) return null;
  
  try {
    return {
      uri: storage.getFilePreview(
        BUCKET_ID,
        fileId,
        300, // width
        300, // height
        undefined, // gravity
        undefined, // quality
        undefined, // borderWidth
        undefined, // borderColor
        undefined, // borderRadius
        undefined, // opacity
        undefined, // rotation
        undefined, // background
        undefined, // output
      ),
      headers: {
        'X-Appwrite-Project': '68424153002403801f6b'
      }
    };
  } catch (error) {
    console.error('Error getting medicine image:', error);
    return null;
  }
};
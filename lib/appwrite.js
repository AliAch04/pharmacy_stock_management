import { Client, Account, ID, Databases } from 'appwrite';

const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('68424153002403801f6b');

const account = new Account(client);
const databases = new Databases(client);

// Replace with your actual IDs from Appwrite console
const databaseId = 'stock'; 
const usersCollectionId = 'users'; 

export { client, account, ID, databases, databaseId, usersCollectionId };

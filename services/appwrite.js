import { Client, Account, Databases, Query } from 'appwrite';

const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1') // Your Appwrite endpoint
  .setProject('68424153002403801f6b'); // Your project ID

const account = new Account(client);
const databases = new Databases(client);

const DATABASE_ID = 'stock';
const COLLECTION_ID = 'medicines';

export { client, account, databases, DATABASE_ID, COLLECTION_ID, Query };
// lib/appwrite.ts
import { Client, Account, ID } from 'appwrite';

// Replace with your actual values:
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1') // or your self-hosted endpoint
  .setProject('YOUR_PROJECT_ID');              // your Appwrite project ID

const account = new Account(client);

export { client, account, ID };

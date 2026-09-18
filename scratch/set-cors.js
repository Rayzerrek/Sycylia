import { Storage } from '@google-cloud/storage';
import { readFileSync } from 'fs';

const devVars = readFileSync('../backend/.dev.vars', 'utf-8');
const match = devVars.match(/^FIREBASE_ACCOUNT=(.*)$/m);
if (!match) throw new Error('No FIREBASE_ACCOUNT found');
const credentials = JSON.parse(match[1]);

const storage = new Storage({ credentials });

async function setCors() {
  const bucket = storage.bucket('sycylia-54389.firebasestorage.app');
  
  const corsConfiguration = [
    {
      maxAgeSeconds: 3600,
      method: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
      origin: [
        'http://localhost:3000',
        'http://localhost:8787',
        'https://sycylia.rayserrek.workers.dev'
      ],
      responseHeader: ['Content-Type', 'x-goog-acl', 'Authorization']
    },
  ];

  console.log('Setting CORS configuration...');
  try {
    await bucket.setCorsConfiguration(corsConfiguration);
    console.log('CORS configuration successfully updated!');
  } catch (error) {
    console.error('Failed to set CORS:', error);
  }
}

setCors();

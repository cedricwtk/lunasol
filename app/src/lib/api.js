import * as SecureStore from 'expo-secure-store';

// Change this to your server URL in production
const BASE_URL = __DEV__ ? 'http://10.0.2.2:3002' : 'https://your-domain.com';

let authToken = null;

export async function loadToken() {
  authToken = await SecureStore.getItemAsync('token');
}

export async function saveToken(token) {
  authToken = token;
  await SecureStore.setItemAsync('token', token);
}

export async function clearToken() {
  authToken = null;
  await SecureStore.deleteItemAsync('token');
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

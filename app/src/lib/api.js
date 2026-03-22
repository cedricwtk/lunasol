import * as SecureStore from 'expo-secure-store';

// Change this to your server URL in production
export const BASE_URL = 'http://5.161.90.215:3002';


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
  const headers = { ...options.headers };
  // Don't set Content-Type for FormData (let browser set boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

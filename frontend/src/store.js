import { configureStore } from '@reduxjs/toolkit';
import { api } from './services/api';
import authReducer from './feature/auth/authSlice';

// Load state from localStorage
const loadState = () => {
  try {
    const serializedState = localStorage.getItem('authState');
    if (serializedState === null) {
      return undefined;
    }
    return { auth: JSON.parse(serializedState) };
  } catch (err) {
    return undefined;
  }
};

// Save state to localStorage
const saveState = (state) => {
  try {
    const serializedState = JSON.stringify(state.auth);
    localStorage.setItem('authState', serializedState);
  } catch (err) {
    // Ignore write errors
  }
};

const preloadedState = loadState();

const store = configureStore({
  reducer: {
    auth: authReducer,
    [api.reducerPath]: api.reducer,
  },
  preloadedState,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

// Subscribe to store changes
store.subscribe(() => {
  saveState(store.getState());
});

export default store;
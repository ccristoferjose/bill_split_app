import { configureStore } from '@reduxjs/toolkit';
import { api } from './services/api';
import authReducer from './feature/auth/authSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export default store;